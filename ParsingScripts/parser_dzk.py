import json
import os
import re
import time
import xml.etree.ElementTree as ET

import spacy
from utils import *
from constants import *

from alive_progress import alive_bar
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import warnings


warnings.filterwarnings("ignore")


NAMESPACE_MAPPINGS = {"ns0": "http://www.tei-c.org/ns/1.0",
                      "xml": "http://www.w3.org/XML/1998/namespace"}

CORPUS_NAME = "DezelniZborKranjski"

prop_nouns = set()

nlp_sl = spacy.load("sl_core_news_md")
nlp_de = spacy.load("de_core_news_md")

# Model for translation
tokenizer = None
model = None
device = "cuda" if torch.cuda.is_available() else "cpu"
USE_FP16 = torch.cuda.is_available()


def ensure_translation_model_loaded(model_name="facebook/nllb-200-distilled-1.3B"):
    global tokenizer, model, device, USE_FP16
    if tokenizer is not None and model is not None:
        return

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    if device == "cuda" and USE_FP16:
        # convert model to fp16 for lower memory usage / faster inference on supported GPUs
        try:
            model.half()
        except Exception:
            print("Warning: could not convert model to fp16")


def translate_text(text, source_lang, target_lang):
    ensure_translation_model_loaded()

    translated_text = ""

    tokenizer.src_lang = source_lang
    with torch.no_grad():
        encoded = tokenizer(text, textreturn_tensors="pt", padding=True, truncation=True, max_length=512).to(device)
        generated_tokens = model.generate(**encoded, forced_bos_token_id=tokenizer.get_lang_id(target_lang))

        translated_text = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)

    return translated_text


# finds all agendas and contents and returns them as a list of dictionaries
def parse_agendas(xml_root, meeting_id):
    agendas = []

    # find all lists with type="agenda"
    for agenda in xml_root.findall(".//ns0:list[@type='preAgenda']", NAMESPACE_MAPPINGS):
        # first we handle agendas
        agenda_items = []
        agenda_index = 0
        for item in agenda:
            if parse_tag(item) == "item":
                agenda_index += 1
                agenda_items.append({
                    "n": agenda_index,
                    "text": item.text
                })

        agendas.append(
            {
                "lang": parse_attribs(agenda)["lang"],
                "items": agenda_items
            }
        )

    # get translations if necessary NOT WORKING
    if len(agendas) == 1:
        if agendas[0]["lang"] == "de":
            print("translating: ", meeting_id, " to sl")
            agenda_sl = []
            for item in agendas[0]["items"]:
                agenda_sl.append({
                    "n": item["n"],
                    "text": translate_text(item["text"], "de", "sl")
                })
            agendas.append({
                "lang": "sl",
                "items": agenda_sl
            })
        elif agendas[0]["lang"] == "sl":
            print("translating: ", meeting_id, " to de")
            agenda_de = []
            for item in agendas[0]["items"]:
                agenda_de.append({
                    "n": item["n"],
                    "text": translate_text(item["text"], "sl", "de")
                })
            agendas.append({
                "lang": "de",
                "items": agenda_de
            })
        else:
            print("parse_agendas(): language '" + agendas[0]["lang"] + "' not supported")
            return []

    return agendas


def batch_lemmatize(texts, lang, sentence_ids=None, batch_size=64, n_process=1):
    if lang == "sl":
        nlp = nlp_sl
    elif lang == "de":
        nlp = nlp_de
    else:
        print(f"batch_lemmatize(): language '{lang}' not supported")
        return [[] for _ in texts]

    if sentence_ids is None:
        sentence_ids = [f"0" for _ in texts]

    results = []

    # Disable components not needed for lemmatization to save memory/CPU
    disable_comps = [c for c in ("parser") if c in nlp.pipe_names]
    with nlp.select_pipes(disable=disable_comps):
        with alive_bar(len(texts), title=f"Lemmatizing ({lang})", force_tty=True) as bar:
            bar(0)
            for doc, sid in zip(nlp.pipe(texts, batch_size=batch_size, n_process=n_process), sentence_ids):
                words = []
                for i, token in enumerate(doc):
                    word = {}
                    word["id"] = sid + "." + str(i + 1) + ".(" + lang + ")"
                    word["type"] = "pc" if token.is_punct else "w"
                    word["lemma"] = token.lemma_
                    word["text"] = token.text
                    word["propn"] = 1 if token.pos_ == "PROPN" else 0

                    # Adjust join attribute (needed to reconstruct the original text)
                    word["join"] = "natural"
                    if i < len(doc) - 1 and not token.whitespace_:
                        word["join"] = "right"

                    words.append(word)
                results.append(words)
                bar()

    return results


def parse_sentence(sentence_root, segment_page, segment_id, speaker):
    global prop_nouns
    sentence_attribs = parse_attribs(sentence_root)
    sentence = {}
    sentence[ID] = sentence_attribs[ID]
    sentence[TRANSLATIONS] = []
    sentence["segment_page"] = segment_page
    sentence[SEGMENT_ID] = segment_id
    sentence[SPEAKER] = speaker

    translation = {}
    translation["lang"] = sentence_attribs["lang"]
    translation[SPEAKER] = sentence[SPEAKER]
    translation["original"] = 1
    translation["text"] = ""
    translation["words"] = []
    # Note: person_entities and location_entities are added later in parse_jsonl()

    # parse original language
    for i, word_root in enumerate(sentence_root):
        word_tag = parse_tag(word_root)

        if word_tag == "w" or word_tag == "pc":
            word = {}
            word_attribs = parse_attribs(word_root)
            word[ID] = word_attribs[ID]
            word["type"] = word_tag
            word["lemma"] = word_attribs["lemma"]
            word["text"] = word_root.text
            word["join"] = word_attribs.get("join", "natural")

            # Determine if the word is a proper noun
            upostag = word_attribs.get("msd").split("|")[0].split("=")[1]
            if upostag == "PROPN":
                word["propn"] = 1
                prop_nouns.add(word["lemma"])
            else:
                word["propn"] = 0

            if not word_tag == "pc" and not word["text"] == "":
                translation["text"] += " "
            translation["text"] += word["text"]

            translation["words"].append(word)

        else:
            print("parse_sentence(): expected child tag 'w' or 'pc', got tag '" + word_tag + "'")
            return False

    # če imamo mogoče xml brez word tagov
    if translation["text"] == "" and sentence_root.text:
        translation["text"] = sentence_root.text

    sentence[TRANSLATIONS].append(translation)
    sentence["original_language"] = translation["lang"]

    return sentence


def parse_note(note_root, segment_page, segment_id, speaker):
    note = {}

    note["type"] = "comment"
    note["text"] = note_root.text
    note["page"] = segment_page
    note[SEGMENT_ID] = segment_id
    note[SPEAKER] = speaker

    return note


def parse_segment(segment_root, speaker):
    sentences = []
    notes = []
    attribs = parse_attribs(segment_root)

    segment_page = attribs["n"] if attribs.get("n") else -1
    segment_id = attribs[ID]

    for child in segment_root:
        child_tag = parse_tag(child)
        if child_tag == "s":
            sentences.append(parse_sentence(child, segment_page, segment_id, speaker))
        elif child_tag == "note":
            notes.append(parse_note(child, segment_page, segment_id, speaker))
        else:
            print("parse_segment(): expected child tag 's' or 'note', got tag '" + child_tag + "'")
            return False

    return sentences, notes


def parse_speeches(xml_root):
    sentences = []
    notes = []
    activeSpeaker = None

    # find debateSection
    debate_section = xml_root.find(".//ns0:div[@type='debateSection']", NAMESPACE_MAPPINGS)
    if debate_section is None:
        return sentences, notes

    def process_node(node, current_speaker):
        node_sentences = []
        node_notes = []

        for child in node:
            tag = parse_tag(child)
            attribs = parse_attribs(child)

            # utterance or paragraph with a segment child
            if (tag == "u" or tag == "p") and len(child) > 0 and parse_tag(child[0]) == "seg":
                # utterances have a speaker, paragraphs do not
                speaker = current_speaker if tag == "u" else None
                parsed_sentences, parsed_notes = parse_segment(child[0], speaker)
                node_sentences.extend(parsed_sentences)
                node_notes.extend(parsed_notes)

            # speaker note updates current speaker for subsequent siblings
            elif tag == "note" and attribs.get("type") == "speaker":
                # sanitize speaker string
                current_speaker = re.sub(r'[^a-zA-ZäöüßÄÖÜčšžČŠŽ. 0-9]', '', child.text)

            # nested div -> recurse one level deeper (and deeper if needed)
            elif tag == "div":
                nested_sentences, nested_notes, current_speaker = process_node(child, current_speaker)
                node_sentences.extend(nested_sentences)
                node_notes.extend(nested_notes)

            # ignore other tags
        return node_sentences, node_notes, current_speaker

    sentences, notes, _ = process_node(debate_section, activeSpeaker)
    return sentences, notes


def translate_sentences(sentences, source_lang, target_lang, chunk_size=10, num_beams=3):
    ensure_translation_model_loaded()

    translations = []

    tokenizer.src_lang = source_lang
    with torch.no_grad():
        with alive_bar(len(sentences), title=f"Translating {source_lang}→{target_lang}", force_tty=True) as bar:
            bar(0)
            for start in range(0, len(sentences), chunk_size):
                end = start + chunk_size
                chunk = sentences[start:end]

            encoded = tokenizer(chunk, return_tensors="pt", padding=True, truncation=True, max_length=512).to(device)
            generated_tokens = model.generate(
                **encoded,
                forced_bos_token_id=get_lang_id(tokenizer, target_lang),
                num_beams=num_beams,
                early_stopping=False,
                length_penalty=1.3,
                max_new_tokens=512,
            )

            decoded = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
            translations.extend(decoded)

            # free intermediate tensors and clear cached GPU memory
            if device == "cuda":
                del encoded, generated_tokens
                torch.cuda.empty_cache()

                bar(len(chunk))

    return translations

# translates the sentences and agendas in a meeting
def translate_meeting(meeting):
    start_time = time.time()

    # init lists for sentences
    de_sentence_ids = []
    de_translations_list = []

    sl_sentence_ids = []
    sl_translations_list = []

    # get all sentences in the meeting and put them in lists according to their language, also get their ids
    for sentence in meeting[SENTENCES]:
        if sentence[TRANSLATIONS][0]["lang"] == "de":
            de_sentence_ids.append(sentence[ID])
            de_translations_list.append(sentence[TRANSLATIONS][0]["text"])
        elif sentence[TRANSLATIONS][0]["lang"] == "sl":
            sl_sentence_ids.append(sentence[ID])
            sl_translations_list.append(sentence[TRANSLATIONS][0]["text"])

    # translate german to slovene
    translations_sl = translate_sentences(de_translations_list, 'deu_Latn', 'slv_Latn')
    mid_time1 = time.time()
    print("translating to sl took " + str(mid_time1 - start_time) + " seconds")

    # lemmatize slovene translations
    lemmatizations_sl = batch_lemmatize(translations_sl, 'sl', de_sentence_ids)
    mid_time2 = time.time()
    print("lemmatizing sl took " + str(mid_time2 - mid_time1) + " seconds")


    for i, (translated_text, lemmatization) in enumerate(zip(translations_sl, lemmatizations_sl)):
        sentence_id = de_sentence_ids[i]
        sentence_index = next((idx for (idx, d) in enumerate(meeting[SENTENCES]) if d[ID] == sentence_id), None)
        if sentence_index is None:
            continue

        translation_entry = {
            "lang": "sl",
            "original": 0,
            SPEAKER: meeting[SENTENCES][sentence_index][SPEAKER],
            PERSON_ENTITIES: meeting[SENTENCES][sentence_index].get(PERSON_ENTITIES, []),
            LOCATION_ENTITIES: meeting[SENTENCES][sentence_index].get(LOCATION_ENTITIES, []),
            "text": translated_text,
            "words": lemmatization
        }

        meeting[SENTENCES][sentence_index][TRANSLATIONS].append(translation_entry)

    # translate slovene to german
    translations_de = translate_sentences(sl_translations_list,'slv_Latn', 'deu_Latn')
    mid_time3 = time.time()
    print("translating to de took " + str(mid_time3 - mid_time2) + " seconds")

    # lemmatize german translations
    lemmatizations_de = batch_lemmatize(translations_de, 'de', sl_sentence_ids)
    mid_time4 = time.time()
    print("lemmatizing de took " + str(mid_time4 - mid_time3) + " seconds")

    for i, (translated_text, lemmatization) in enumerate(zip(translations_de, lemmatizations_de)):
        sentence_id = sl_sentence_ids[i]
        sentence_index = next((idx for (idx, d) in enumerate(meeting[SENTENCES]) if d[ID] == sentence_id), None)
        if sentence_index is None:
            continue

        translation_entry = {
            "lang": "de",
            "original": 0,
            SPEAKER: meeting[SENTENCES][sentence_index][SPEAKER],
            PERSON_ENTITIES: meeting[SENTENCES][sentence_index].get(PERSON_ENTITIES, []),
            LOCATION_ENTITIES: meeting[SENTENCES][sentence_index].get(LOCATION_ENTITIES, []),
            "text": translated_text,
            "words": lemmatization
        }

        meeting[SENTENCES][sentence_index][TRANSLATIONS].append(translation_entry)


    end_time = time.time()
    print(
        "translate_meeting(): translated " + str(len(de_sentence_ids) + len(sl_sentence_ids)) + " sentences in " + str(
            end_time - start_time) + " seconds")

    return


def parse_jsonl(jsonl_path, meeting):
    if not os.path.exists(jsonl_path):
        print(f"WARNING: JSONL file not found: {jsonl_path}")
        # Add empty to all
        for sentence in meeting[SENTENCES]:
            sentence[PERSON_ENTITIES] = []
            sentence[LOCATION_ENTITIES] = []
            sentence[CAP_TOPICS] = []
        meeting[CAP_TOPICS_AGGREGATED] = []
        return

    sentence_entities_map = {}  # sentence_id -> person_entities, location_entities
    sentence_topics_map = {}    # sentence_id -> cap_topics
    all_topics = set()

    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            data = json.loads(line)
            record_id = data[ID]

            if 'from' in data and 'to' in data:
                # Segment record — map topics to each sentence in range
                topics = data.get(CAP_TOPICS, [])
                from_num = int(data['from'].replace('s', ''))
                to_num = int(data['to'].replace('s', ''))
                all_topics.update(topics)
                for i in range(from_num, to_num + 1):
                    sentence_full_id = f"{record_id}.s{i}"
                    if sentence_full_id not in sentence_topics_map:
                        sentence_topics_map[sentence_full_id] = []
                    sentence_topics_map[sentence_full_id].extend(topics)
            else:
                # Sentence record — store person/location entities
                sentence_entities_map[record_id] = {
                    PERSON_ENTITIES: data.get(PERSON_ENTITIES, []),
                    LOCATION_ENTITIES: data.get(LOCATION_ENTITIES, [])
                }

    # Aggregate all unique topics for the meeting document
    meeting[CAP_TOPICS_AGGREGATED] = sorted(list(all_topics))

    # Write to meeting sentences
    for sentence in meeting[SENTENCES]:
        sentence_id = sentence[ID]
        if sentence_id in sentence_entities_map:
            sentence[PERSON_ENTITIES] = sentence_entities_map[sentence_id][PERSON_ENTITIES]
            sentence[LOCATION_ENTITIES] = sentence_entities_map[sentence_id][LOCATION_ENTITIES]
        else:
            sentence[PERSON_ENTITIES] = []
            sentence[LOCATION_ENTITIES] = []

        sentence[CAP_TOPICS] = sentence_topics_map.get(sentence_id, [])

        # Duplicate into all translation objects
        for translation in sentence.get(TRANSLATIONS, []):
            translation[PERSON_ENTITIES] = sentence[PERSON_ENTITIES]
            translation[LOCATION_ENTITIES] = sentence[LOCATION_ENTITIES]

def parse_zapisnik(xml_root, jsonl_path):
    meeting_parse_start_time = time.time()

    meeting = {}

    # get the meeting id
    meeting[ID] = xml_root.attrib["{http://www.w3.org/XML/1998/namespace}id"]

    # get the meeting date
    meeting["date"] = parse_date_from_id(meeting[ID])

    # get the meeting title
    meeting["titles"] = parse_titles(xml_root, NAMESPACE_MAPPINGS)

    # get agendas
    meeting["agendas"] = parse_agendas(xml_root, meeting[ID])

    # get speeches
    meeting[SENTENCES], meeting["notes"] = parse_speeches(xml_root)

    # add data from source jsonl files.
    parse_jsonl(jsonl_path, meeting)

    # translate meeting
    translate_meeting(meeting)

    # set corpus
    meeting["corpus"] = CORPUS_NAME

    # gather data about sentences and words
    coords_index = build_coords_index(xml_root, NAMESPACE_MAPPINGS)
    transformed_sentences = transform_sentences_fast(meeting, coords_index=coords_index)
    transformed_words = transform_words_fast(meeting, coords_index=coords_index)

    meeting_parse_end_time = time.time()
    print("parse_zapisnik(): parsed meeting in " + str(meeting_parse_end_time - meeting_parse_start_time) + " seconds")

    return meeting, transformed_sentences, transformed_words


def parse(source, destination, from_idx=0, to_idx=-1):
    files = os.listdir(source)
    for i, file in enumerate(files):

        if i < from_idx:
            continue

        if i >= to_idx and to_idx != -1:
            break

        if not file.endswith(".xml") or not file.startswith("DezelniZborKranjski"):
            continue

        path = os.path.join(source, file)

        xml_tree = ET.parse(path)
        xml_root = xml_tree.getroot()

        print("parse(): processing file " + file)

        jsonl_path = path.replace(".xml", ".jsonl")

        # initialize parser
        zapisnik, povedi, besede = parse_zapisnik(xml_root, jsonl_path)

        # save data to jsonl files
        file_path = os.path.join(destination, zapisnik[ID] + "_meeting.jsonl")
        save_to_jsonl([zapisnik], file_path)

        file_path = os.path.join(destination, zapisnik[ID] + "_sentences.jsonl")
        save_to_jsonl(povedi, file_path)

        file_path = os.path.join(destination, zapisnik[ID] + "_words.jsonl")
        save_to_jsonl(besede, file_path)

        print(f"parse(): {i+1}/{len(files)} files processed\n")