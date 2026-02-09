import xml.etree.ElementTree as ET
import time
import os
import re

import requests
import spacy
import spacy_transformers
import cyrtranslit
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from alive_progress import alive_bar
from huggingface_hub import snapshot_download

from utils import *

# Text is either in Slovene or Serbo-Croatian. We consider that the text is in Croatian, if Serbo-Croatian is
# written with latinic characters and in Serbian if it is written in cyrillic. Since Libretranslate
# does not support croatian language, we translate it between Slovene to Croatian by using 'sl' and 'sr'.
# Croatian is used as a sort of bridge language. If we want to translate between Slovene and Serbian,
# which is in cyrillic, we use cyrtranslit to convert the text to latinic and then use Libretranslate
# to translate it between Slovene and Croatian.


NAMESPACE_MAPPINGS = {"ns0": "http://www.tei-c.org/ns/1.0"}

CORPUS_NAME = 'Yu1Parl'

proper_nouns = set()

nlp_sl = spacy.load('sl_core_news_md')
nlp_hr = spacy.load('hr_core_news_md')
nlp_sr = spacy.load(snapshot_download(repo_id="Tanor/sr_Spacy_Serbian_Model_SrpKor4Tagging_BERTICOVO"))

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


def parse_agendas(xml_root):
    agendas = []
    for agenda in xml_root.findall('.//ns0:preAgenda', NAMESPACE_MAPPINGS):
        agenda_attribs = parse_attribs(agenda)
        if not 'lang' in agenda_attribs or not agenda_attribs['lang'] in ['sl', 'hr', 'sr']:
            print(f"Invalid language: {agenda_attribs['lang']}")
            continue
        agenda_items = []
        agenda_index = 0
        for item in agenda:
            item_attribs = parse_attribs(item)
            if parse_tag(item) == 'item' and item_attribs['n']:
                agenda_index += 1
                agenda_items.append({
                    'n': agenda_index,
                    'text': item.text
                })

        agendas.append({
            'lang': agenda_attribs['lang'],
            'items': agenda_items
        })

    # translate if necessary
    if len(agendas) == 1:
        if agendas[0]['lang'] == 'sl':
            agenda_hr = []
            agenda_sr = []
            for item in agendas[0]["items"]:
                serbo_croatian_latinic = translate_text(item['text'], 'sl', 'sr')
                serbo_croatian_cyrilic = cyrtranslit.to_cyrillic(serbo_croatian_latinic)
                agenda_hr.append({
                    'n': item['n'],
                    'text': serbo_croatian_latinic
                })
                agenda_sr.append({
                    'n': item['n'],
                    'text': serbo_croatian_cyrilic
                })

            agendas.append({
                'lang': 'hr',
                'items': agenda_hr
            })
            agendas.append({
                'lang': 'sr',
                'items': agenda_sr
            })
        elif agendas[0]['lang'] == 'hr':
            agenda_sl = []
            agenda_sr = []
            for item in agendas[0]["items"]:
                serbo_croatian_cyrilic = cyrtranslit.to_cyrillic(item['text'])
                slovene = translate_text(item['text'], 'sr', 'sl')
                agenda_sl.append({
                    'n': item['n'],
                    'text': slovene
                })
                agenda_sr.append({
                    'n': item['n'],
                    'text': serbo_croatian_cyrilic
                })

            agendas.append({
                'lang': 'sl',
                'items': agenda_sl
            })
            agendas.append({
                'lang': 'sr',
                'items': agenda_sr
            })
        else:
            if not agendas[0]['lang'] == 'sr':
                print(f"Invalid language: {agendas[0]['lang']}")
            agenda_sl = []
            agenda_hr = []
            for item in agendas[0]["items"]:
                serbo_croatian_latinic = cyrtranslit.to_latin(item['text'])
                slovene = translate_text(serbo_croatian_latinic, 'sr', 'sl')
                agenda_sl.append({
                    'n': item['n'],
                    'text': slovene
                })
                agenda_hr.append({
                    'n': item['n'],
                    'text': serbo_croatian_latinic
                })

            agendas.append({
                'lang': 'sl',
                'items': agenda_sl
            })
            agendas.append({
                'lang': 'hr',
                'items': agenda_hr
            })
    elif len(agendas) == 2:
        hr_agenda = next((agenda for agenda in agendas if agenda['lang'] == 'hr'), None)
        sr_agenda = next((agenda for agenda in agendas if agenda['lang'] == 'sr'), None)
        sl_agenda = next((agenda for agenda in agendas if agenda['lang'] == 'sl'), None)

        if hr_agenda is not None and sr_agenda is not None and sl_agenda is None:
            sl_agenda = []
            for item in hr_agenda['items']:
                slovene = translate_text(item['text'], 'sr', 'sl')
                sl_agenda.append({
                    'n': item['n'],
                    'text': slovene
                })

            agendas.append({
                'lang': 'sl',
                'items': sl_agenda
            })

        elif hr_agenda is not None and sl_agenda is not None and sr_agenda is None:
            sr_agenda = []
            for item in hr_agenda['items']:
                serbo_croatian_cyrilic = cyrtranslit.to_cyrillic(item['text'])
                sr_agenda.append({
                    'n': item['n'],
                    'text': serbo_croatian_cyrilic
                })

            agendas.append({
                'lang': 'sr',
                'items': sr_agenda
            })

        elif sl_agenda is not None and sr_agenda is not None and hr_agenda is None:
            hr_agenda = []
            for item in sl_agenda['items']:
                serbo_croatian_latinic = cyrtranslit.to_latin(item['text'])
                hr_agenda.append({
                    'n': item['n'],
                    'text': serbo_croatian_latinic
                })

            agendas.append({
                'lang': 'hr',
                'items': hr_agenda
            })

        else:
            raise Exception(f"Invalid number of agendas is None:\n{hr_agenda}\n{sl_agenda}\n{sr_agenda}")
    else:
        print(f"Found {len(agendas)} agendas. Skipping translation.")

    return agendas



def batch_lemmatize(texts, lang, sentence_ids=None, batch_size=64, n_process=1):
    global proper_nouns

    if lang == 'sl':
        nlp = nlp_sl
    elif lang == 'hr':
        nlp = nlp_hr
    elif lang == 'sr':
        nlp = nlp_sr
    else:
        print(f"batch_lemmatize(): language '{lang}' not supported")
        return [[] for _ in texts]

    if sentence_ids is None:
        sentence_ids = [f"0" for _ in texts]

    results = []

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

                    if token.pos_ == "PROPN":
                        proper_nouns.add(token.lemma_)

                results.append(words)
                bar()

    return results


def parse_sentence(sentence_root, segment_page, segment_id, speaker):
    global proper_nouns
    sentence_attribs = parse_attribs(sentence_root)

    if sentence_attribs['lang'] not in ['sl', 'hr', 'sr']:
        print(f"Invalid language: {sentence_attribs['lang']}. Skipping.")
        return

    sentence = {
        'id': sentence_attribs['id'],
        'segment_page': segment_page,
        'segment_id': segment_id,
        'speaker': speaker,
        'translations': []
    }

    translation = {
        'lang': sentence_attribs['lang'],
        'original': 1,
        'text': '',
        'words': []
    }

    for word_root in sentence_root:
        word_tag = parse_tag(word_root)

        if word_tag == 'w' or word_tag == 'pc':
            word_attribs = parse_attribs(word_root)
            upostag = word_attribs.get("msd").split("|")[0].split("=")[1]
            word = {
                'id': word_attribs['id'],
                'text': word_root.text,
                'lemma': word_attribs['lemma'],
                'propn': 1 if upostag == 'PROPN' else 0
            }

            if upostag == 'PROPN':
                proper_nouns.add(word['lemma'])

            if not word_tag == "pc" and not word["text"] == "":
                translation["text"] += " "
            translation["text"] += word["text"]
            translation["words"].append(word)

        else:
            print(f"Invalid word tag: {word_tag}. Skipping.")

    sentence["translations"].append(translation)
    sentence["original_language"] = translation["lang"]

    return sentence


def parse_note(note_root, segment_page, segment_id, speaker):
    note = {
        'type': 'comment',
        'text': note_root.text,
        'page': segment_page,
        'segment_id': segment_id,
        'speaker': speaker
    }

    return note


def parse_segment(segment_root, speaker):
    sentences = []
    notes = []
    attribs = parse_attribs(segment_root)

    segment_page = -1  # no data in xml
    segment_id = attribs['id']

    for child in segment_root:
        child_tag = parse_tag(child)
        if child_tag == 's':
            sentences.append(parse_sentence(child, segment_page, segment_id, speaker))
        elif child_tag == 'note':
            notes.append(parse_note(child, segment_page, segment_id, speaker))
        else:
            print(f"Invalid segment child tag: {child_tag} Skipping.")

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


def translate_sentences(sentences, source_lang, target_lang, chunk_size=10, num_beams=5):
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
                    early_stopping=True,
                    length_penalty=1.2,
                    max_new_tokens=128,
                )

                decoded = tokenizer.batch_decode(generated_tokens, skip_special_tokens=True)
                translations.extend(decoded)

                # free intermediate tensors and clear cached GPU memory
                if device == "cuda":
                    del encoded, generated_tokens
                    torch.cuda.empty_cache()

                bar(len(chunk))

    return translations


def translate_meeting(meeting):
    start_time = time.time()

    # lists for sentence ids and texts by language
    hr_ids, hr_texts = [], []
    sr_ids, sr_texts = [], []
    sl_ids, sl_texts = [], []

    # filter out none sentences
    meeting['sentences'] = [sentence for sentence in meeting['sentences'] if sentence is not None]

    for sentence in meeting['sentences']:
        if sentence['original_language'] == 'hr':
            hr_ids.append(sentence['id'])
            hr_texts.append(sentence['translations'][0]['text'])
        elif sentence['original_language'] == 'sr':
            sr_ids.append(sentence['id'])
            sr_texts.append(sentence['translations'][0]['text'])
        elif sentence['original_language'] == 'sl':
            sl_ids.append(sentence['id'])
            sl_texts.append(sentence['translations'][0]['text'])

    # HR -> SL, SR
    if len(hr_texts) > 0:
        hr2sl = translate_sentences(hr_texts, 'hrv_Latn', 'slv_Latn')
        hr2sr = translate_sentences(hr_texts, 'hrv_Latn', 'srp_Cyrl')

        lemm_sl = batch_lemmatize(hr2sl, 'sl', hr_ids)
        lemm_sr = batch_lemmatize(hr2sr, 'sr', hr_ids)

        for i, sid in enumerate(hr_ids):
            sentence_index = next((index for (index, d) in enumerate(meeting['sentences']) if d['id'] == sid), None)
            if sentence_index is None:
                continue

            translation_sl = {
                'lang': 'sl',
                'original': 0,
                'speaker': meeting['sentences'][sentence_index]['speaker'],
                'text': hr2sl[i],
                'words': lemm_sl[i]
            }
            translation_sr = {
                'lang': 'sr',
                'original': 0,
                'speaker': meeting['sentences'][sentence_index]['speaker'],
                'text': hr2sr[i],
                'words': lemm_sr[i]
            }

            meeting['sentences'][sentence_index]['translations'].append(translation_sl)
            meeting['sentences'][sentence_index]['translations'].append(translation_sr)

    hr_time = time.time()
    print(f"Translating HR to SL & SR sentences in {hr_time - start_time} seconds")

    # SR -> HR (latinic) and SL
    if len(sr_texts) > 0:
        sr2sl = translate_sentences(sr_texts, 'srp_Cyrl', 'slv_Latn')
        sr2hr = translate_sentences(sr_texts, 'srp_Cyrl', 'hrv_Latn')

        lemm_hr = batch_lemmatize(sr2hr, 'hr', sr_ids)
        lemm_sl = batch_lemmatize(sr2sl, 'sl', sr_ids)

        for i, sid in enumerate(sr_ids):
            sentence_index = next((index for (index, d) in enumerate(meeting['sentences']) if d['id'] == sid), None)
            if sentence_index is None:
                continue

            translation_hr = {
                'lang': 'hr',
                'original': 0,
                'speaker': meeting['sentences'][sentence_index]['speaker'],
                'text': sr2hr[i],
                'words': lemm_hr[i]
            }
            translation_sl = {
                'lang': 'sl',
                'original': 0,
                'speaker': meeting['sentences'][sentence_index]['speaker'],
                'text': sr2sl[i],
                'words': lemm_sl[i]
            }

            meeting['sentences'][sentence_index]['translations'].append(translation_hr)
            meeting['sentences'][sentence_index]['translations'].append(translation_sl)

    sr_time = time.time()
    print(f"Translating SR to HR & SL sentences in {sr_time - hr_time} seconds")

    # SL -> HR (latin) and SR (cyrillic)
    if len(sl_texts) > 0:
        sl2hr = translate_sentences(sl_texts, 'slv_Latn', 'hrv_Latn')
        sl2sr = translate_sentences(sl_texts, 'slv_Latn', 'srp_Cyrl')

        lemm_hr = batch_lemmatize(sl2hr, 'hr', sl_ids)
        lemm_sr = batch_lemmatize(sl2sr, 'sr', sl_ids)

        for i, sid in enumerate(sl_ids):
            sentence_index = next((index for (index, d) in enumerate(meeting['sentences']) if d['id'] == sid), None)
            if sentence_index is None:
                continue

            translation_hr = {
                'lang': 'hr',
                'original': 0,
                'speaker': meeting['sentences'][sentence_index]['speaker'],
                'text': sl2hr[i],
                'words': lemm_hr[i]
            }
            translation_sr = {
                'lang': 'sr',
                'original': 0,
                'speaker': meeting['sentences'][sentence_index]['speaker'],
                'text': sl2sr[i],
                'words': lemm_sr[i]
            }

            meeting['sentences'][sentence_index]['translations'].append(translation_hr)
            meeting['sentences'][sentence_index]['translations'].append(translation_sr)

    end_time = time.time()
    print(f"Translating SL to HR & SR sentences in {end_time - sr_time} seconds")
    print(f"Translated meeting in {end_time - start_time} seconds")

    return


def parse_zapisnik(xml_root):
    start_time = time.time()
    meeting_id = xml_root.attrib['{http://www.w3.org/XML/1998/namespace}id']
    sentences, notes = parse_speeches(xml_root)

    meeting = {
        'id': meeting_id,
        'date': parse_date_from_id(meeting_id),
        'titles': parse_titles(xml_root, NAMESPACE_MAPPINGS),
        'agendas': parse_agendas(xml_root),
        'sentences': sentences,
        'notes': notes,
        'corpus': CORPUS_NAME
    }

    translate_meeting(meeting)

    # gather data about sentences and words
    coords_index = build_coords_index(xml_root, NAMESPACE_MAPPINGS)
    transformed_sentences = transform_sentences_fast(meeting, coords_index=coords_index)
    transformed_words = transform_words_fast(meeting, coords_index=coords_index)

    mid_time = time.time()
    print(f"Parsed meeting in {mid_time - start_time} seconds")

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

        # initialize parser
        zapisnik, povedi, besede = parse_zapisnik(xml_root)

        # save data to jsonl files
        file_path = os.path.join(destination, zapisnik["id"] + "_meeting.jsonl")
        save_to_jsonl([zapisnik], file_path)

        file_path = os.path.join(destination, zapisnik["id"] + "_sentences.jsonl")
        save_to_jsonl(povedi, file_path)

        file_path = os.path.join(destination, zapisnik["id"] + "_words.jsonl")
        save_to_jsonl(besede, file_path)

        print(f"parse(): {i+1}/{len(files)} files processed\n")