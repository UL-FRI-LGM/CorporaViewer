"""
Parser for the Kranjska 2.0 corpus.

Input:
    Kranjska.TEI.ana/  <meeting>.xml         sentences + lemmas (tokens <w>/<pc>)
    Kranjska.NER/      <meeting>.ner.json    person/location entities per sentence (with token ids)
    Kranjska.Topics/   <meeting>.cap.json    CAP topic codes per segment
    Kranjska.Speakers/ <meeting>.speakers.json  speaker note id -> speaker id,
                       speakers_full_metadata.json = speaker metadata
    data/cap_topics.json                     CAP codebook with slovenian names

Output (per meeting): <id>_meeting.jsonl, <id>_sentences.jsonl, <id>_words.jsonl
Output (shared):      all_cap_topics.jsonl, poslanci.jsonl, krajevna_imena_z_koordinatami.jsonl
Coordinates are read from <coords_dir>/<meeting>.xml if it exists.
"""
import json
import os
import re
import shutil
import subprocess
import time
import unicodedata
from datetime import datetime
import xml.etree.ElementTree as ET
from collections import Counter

from rapidfuzz import fuzz, process

from constants import *
from utils import *

TEI_NS = "http://www.tei-c.org/ns/1.0"
NAMESPACE_MAPPINGS = {"ns0": TEI_NS}
XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"

CORPUS_NAME = "DezelniZborKranjski"

TEI_DIR = "Kranjska.TEI.ana"      # tokens + lemmas
PLAIN_TEI_DIR = "Kranjska.TEI"    # exact sentence text
NER_DIR = "Kranjska.NER"
TOPICS_DIR = "Kranjska.Topics"
SPEAKERS_DIR = "Kranjska.Speakers"
COORDS_DIR = "Kranjska.TEI.ana.coords"

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SIFRANT_PATH = os.path.join(DATA_DIR, "krajevna_imena_z_koordinatami.jsonl")
# CAP codebook + our slovenian translations
CAP_CODEBOOK_PATH = os.path.join(DATA_DIR, "cap_topics.json")
UNMATCHED_FILE = "unmatched_location_entities.jsonl"  # not uploaded
SHARED_DIR = "shared"          # files for all meetings
MANIFEST_FILE = "manifest.json"

# fuzzy matching is strict, partial matching gave a lot of wrong places (e.g. Österreich -> Dob)
PERSON_ENTITIES_TOP_N = 1000

FUZZY_THRESHOLD = 88
FUZZY_MIN_LENGTH = 5      # shorter names must match exactly
FUZZY_MAX_LENGTH_DIFF = 3


class LocationNormalizer:
    """Maps location entities to place names from the šifrant."""

    def __init__(self, path=SIFRANT_PATH):
        self.entries = []
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                self.entries.append(json.loads(line))
        print(f"[INFO] Loaded šifrant: {len(self.entries)} entries from {path}")

        # lowercase name -> canonical name
        self.exact = {}
        self.fuzzy_names = []
        self.fuzzy_canonical = []
        for entry in self.entries:
            canonical = entry['names'].get('sl')
            if not canonical:
                continue
            for name in filter(None, [entry['names'].get('sl'), entry['names'].get('de')]):
                lowered = name.lower()
                self.exact.setdefault(lowered, canonical)
                self.fuzzy_names.append(self._fold(lowered))
                self.fuzzy_canonical.append(canonical)

        self.cache = {}
        self.matched = Counter()    # match type -> count
        self.unmatched = {}         # (lemma, raw) -> info

    @staticmethod
    def _clean(name):
        return name.strip().rstrip('.,;:!?').lower()

    @staticmethod
    def _fold(name):
        """Lowercase without diacritics."""
        return ''.join(c for c in unicodedata.normalize('NFKD', name) if not unicodedata.combining(c)).lower()

    def _fuzzy(self, cleaned):
        """Returns (match, score, best candidate)."""
        if len(cleaned) < FUZZY_MIN_LENGTH:
            return None, 0, None

        folded = self._fold(cleaned)
        best_score, best_canonical = 0, None
        for scorer in (fuzz.ratio, fuzz.token_sort_ratio):
            for name, score, index in process.extract(folded, self.fuzzy_names, scorer=scorer, limit=5):
                if name[:1] != folded[:1] or abs(len(name) - len(folded)) > FUZZY_MAX_LENGTH_DIFF:
                    continue
                if score > best_score:
                    best_score, best_canonical = score, self.fuzzy_canonical[index]
        return (best_canonical if best_score >= FUZZY_THRESHOLD else None), best_score, best_canonical

    def normalize(self, lemma, raw):
        """Returns the canonical name or None."""
        key = (lemma, raw)
        if key in self.cache:
            result = self.cache[key]
            if result is None:
                self.unmatched[key]['count'] += 1
            return result

        candidates = [c for c in (self._clean(lemma or ''), self._clean(raw or '')) if c]
        result = None
        for cleaned in candidates:
            if cleaned in self.exact:
                result = self.exact[cleaned]
                self.matched['exact'] += 1
                break

        best_match, best_score = None, 0
        if result is None:
            for cleaned in candidates:
                canonical, score, candidate = self._fuzzy(cleaned)
                if canonical is not None:
                    result = canonical
                    self.matched['fuzzy'] += 1
                    break
                if score > best_score:
                    best_match, best_score = candidate, score

        self.cache[key] = result
        if result is None:
            self.unmatched[key] = {'count': 1, 'best_match': best_match, 'score': best_score}
        return result

    def save_unmatched(self, path):
        rows = [{'lemma': lemma, 'raw': raw, **info} for (lemma, raw), info in self.unmatched.items()]
        rows.sort(key=lambda r: -r['count'])
        save_to_jsonl(rows, path)


NO_SPACE_BEFORE = set(".,;:!?)]}”’")
NO_SPACE_AFTER = set("([{„‚")


def join_tokens(tokens, field):
    """Joins tokens into text (join="right" means no space after the token)."""
    parts = []
    for i, token in enumerate(tokens):
        if i > 0:
            previous = tokens[i - 1]
            attach = previous["join"] == "right"                 or (token["type"] == "pc" and token["text"] in NO_SPACE_BEFORE)                 or (previous["type"] == "pc" and previous["text"] in NO_SPACE_AFTER)
            if not attach:
                parts.append(" ")
        parts.append(token[field])
    return "".join(parts)


def parse_sentence(sentence_root, page, segment_id, speaker, speaker_id):
    attribs = parse_attribs(sentence_root)

    words = []
    for token_root in sentence_root:
        tag = parse_tag(token_root)
        if tag not in ("w", "pc"):
            continue
        token_attribs = parse_attribs(token_root)
        msd = token_attribs.get("msd", "")
        words.append({
            ID: token_attribs[ID],
            "type": tag,
            "lemma": token_attribs.get("lemma") or (token_root.text or ""),
            "text": token_root.text or "",
            "join": token_attribs.get("join", "natural"),
            "propn": 1 if msd.startswith("UPosTag=PROPN") else 0,
        })

    text = join_tokens(words, "text") if words else (sentence_root.text or "").strip()

    translation = {
        "lang": attribs["lang"],
        SPEAKER: speaker,
        SPEAKER_ID: speaker_id,
        "original": 1,
        "text": text,
        "words": words,
    }

    return {
        ID: attribs[ID],
        TRANSLATIONS: [translation],
        "segment_page": page,
        SEGMENT_ID: segment_id,
        SPEAKER: speaker,
        SPEAKER_ID: speaker_id,
        "original_language": attribs["lang"],
    }


def parse_note(note_root, page, segment_id, speaker):
    return {
        "type": "comment",
        "text": note_root.text,
        "page": page,
        SEGMENT_ID: segment_id,
        SPEAKER: speaker,
    }


def parse_segment(segment_root, speaker, speaker_id):
    sentences, notes = [], []
    attribs = parse_attribs(segment_root)
    page = attribs.get("n", -1)
    segment_id = attribs[ID]

    for child in segment_root:
        tag = parse_tag(child)
        if tag == "s":
            sentences.append(parse_sentence(child, page, segment_id, speaker, speaker_id))
        elif tag == "note":
            notes.append(parse_note(child, page, segment_id, speaker))
    return sentences, notes


def parse_speeches(xml_root, speakers):
    """Reads sentences from the body in document order."""
    sentences, notes = [], []

    # some utterances are outside the debateSection div
    body = xml_root.find(".//ns0:body", NAMESPACE_MAPPINGS)
    if body is None:
        return sentences, notes

    current = {"speaker": None, "speaker_id": None}

    def walk(node):
        for child in node:
            tag = parse_tag(child)
            attribs = parse_attribs(child)

            if tag in ("u", "p"):
                # paragraphs have no speaker
                speaker = current["speaker"] if tag == "u" else None
                speaker_id = current["speaker_id"] if tag == "u" else None
                # can have more segments
                for segment in child:
                    if parse_tag(segment) == "seg":
                        segment_sentences, segment_notes = parse_segment(segment, speaker, speaker_id)
                        sentences.extend(segment_sentences)
                        notes.extend(segment_notes)

            elif tag == "note" and attribs.get("type") == "speaker":
                mapped = speakers.get(attribs.get(ID))
                if mapped:
                    current["speaker"] = mapped["label"]
                    current["speaker_id"] = str(mapped["id"])
                else:
                    print(f"WARNING: speaker note {attribs.get(ID)} is not mapped in speakers.json")
                    current["speaker"] = re.sub(r'[^\w. ]', '', child.text or '').strip() or None
                    current["speaker_id"] = None

            elif tag == "div":
                walk(child)

    walk(body)
    return sentences, notes


def parse_agendas(xml_root):
    agendas = []
    for agenda in xml_root.findall(".//ns0:list[@type='agenda']", NAMESPACE_MAPPINGS):
        items = []
        for index, item in enumerate((i for i in agenda if parse_tag(i) == "item"), start=1):
            items.append({"n": index, "text": item.text})
        agendas.append({"lang": parse_attribs(agenda).get("lang"), "items": items})
    return agendas


def apply_entities(meeting, ner_path, normalizer, stats, person_counter):
    """Adds person and location entities to the sentences."""
    entities_by_sentence = {}
    if os.path.exists(ner_path):
        with open(ner_path, 'r', encoding='utf-8') as f:
            entities_by_sentence = json.load(f).get("entities", {})
    else:
        print(f"WARNING: NER file not found: {ner_path}")

    sentence_ids = {s[ID] for s in meeting[SENTENCES]}
    for sentence_id in entities_by_sentence:
        if sentence_id not in sentence_ids:
            stats['ner_unknown_sentence'] += 1

    for sentence in meeting[SENTENCES]:
        persons, locations = [], []
        words = sentence[TRANSLATIONS][0]["words"]
        positions = {w[ID]: i for i, w in enumerate(words)}

        for entity in entities_by_sentence.get(sentence[ID], {}).get("entities", []):
            start = positions.get(entity.get("start_token_id"))
            end = positions.get(entity.get("end_token_id"))
            if start is None or end is None or end < start:
                stats['ner_bad_tokens'] += 1
                continue

            tokens = [{"lemma": w["lemma"] or w["text"], "text": w["text"], "type": w["type"], "join": w["join"]}
                      for w in words[start:end + 1]]
            lemma = join_tokens(tokens, "lemma").strip()
            label = entity.get("label")

            if label == "PER":
                stats['person'] += 1
                if lemma and lemma not in persons:
                    persons.append(lemma)
                    person_counter[lemma] += 1
            elif label == "LOC":
                stats['location'] += 1
                canonical = normalizer.normalize(lemma, entity.get("text", ""))
                if canonical is None:
                    stats['location_unmatched'] += 1
                elif canonical not in locations:
                    locations.append(canonical)

        sentence[PERSON_ENTITIES] = persons
        sentence[LOCATION_ENTITIES] = locations
        for translation in sentence[TRANSLATIONS]:
            translation[PERSON_ENTITIES] = persons
            translation[LOCATION_ENTITIES] = locations


def read_cap_codebook(path=CAP_CODEBOOK_PATH):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_cap_codebook(path=CAP_CODEBOOK_PATH):
    """code -> "Main: Sub" """
    return {code: f"{entry['major_name']}: {entry['minor_name']}" for code, entry in read_cap_codebook(path).items()}


def apply_topics(meeting, topics_path, codebook, stats):
    """Copies segment topics to sentences and collects them on the meeting."""
    segment_topics = {}
    if os.path.exists(topics_path):
        with open(topics_path, 'r', encoding='utf-8') as f:
            raw = json.load(f).get("topics", {})
        for segment_id, value in raw.items():
            names = []
            for code in value.get("topics", []):
                name = codebook.get(str(code))
                if name is None:
                    stats['unknown_topic_code'] += 1
                    continue
                if name not in names:
                    names.append(name)
            segment_topics[segment_id] = names
    else:
        print(f"WARNING: topics file not found: {topics_path}")

    all_topics = set()
    for sentence in meeting[SENTENCES]:
        topics = segment_topics.get(sentence[SEGMENT_ID], [])
        sentence[CAP_TOPICS] = topics
        all_topics.update(topics)
    meeting[CAP_TOPICS_AGGREGATED] = sorted(all_topics)


def build_segments(sentences):
    """Merges sentences of each segment (for the advanced search)."""
    segments = {}
    for sentence in sentences:
        segment = segments.get(sentence[SEGMENT_ID])
        if segment is None:
            segment = segments[sentence[SEGMENT_ID]] = {
                ID: sentence[SEGMENT_ID],
                SPEAKER: sentence.get(SPEAKER),
                SPEAKER_ID: sentence.get(SPEAKER_ID),
                "original_language": sentence.get("original_language"),
                "person_entities": [],
                "location_entities": [],
                "cap_topics": [],
                "_texts": [],
                "_lemmas": [],
            }
        for field in ("person_entities", "location_entities", "cap_topics"):
            for value in sentence.get(field) or []:
                if value not in segment[field]:
                    segment[field].append(value)
        original = next((t for t in sentence[TRANSLATIONS] if t.get("original") == 1), sentence[TRANSLATIONS][0])
        segment["_texts"].append(original.get("text") or "")
        segment["_lemmas"].append(" ".join(word["lemma"] for word in original.get("words") or [] if word["type"] == "w"))

    result = []
    for segment in segments.values():
        segment["text"] = " ".join(text for text in segment.pop("_texts") if text)
        segment["lemmas"] = " ".join(lemmas for lemmas in segment.pop("_lemmas") if lemmas)
        result.append(segment)
    return result


def read_tei_texts(tei_path):
    """sentence id -> text from the plain TEI"""
    texts = {}
    if os.path.exists(tei_path):
        for sentence in ET.parse(tei_path).getroot().iter(f"{{{TEI_NS}}}s"):
            texts[sentence.attrib[XML_ID]] = " ".join("".join(sentence.itertext()).split())
    else:
        print(f"WARNING: TEI file not found: {tei_path}")
    return texts


def parse_zapisnik(xml_root, speakers, ner_path, topics_path, codebook, normalizer, stats, person_counter,
                   coords_root=None, translator=None, tei_texts=None):
    meeting = {}
    meeting[ID] = xml_root.attrib[XML_ID]
    meeting["date"] = parse_date_from_id(meeting[ID])
    meeting["titles"] = parse_titles(xml_root, NAMESPACE_MAPPINGS)
    meeting["agendas"] = parse_agendas(xml_root)
    meeting[SENTENCES], meeting["notes"] = parse_speeches(xml_root, speakers)
    meeting["corpus"] = CORPUS_NAME

    # use text from the plain TEI if we have it
    for sentence in meeting[SENTENCES]:
        text = (tei_texts or {}).get(sentence[ID])
        if text:
            sentence[TRANSLATIONS][0]["text"] = text
        else:
            stats['text_from_tokens'] += 1

    # translate before adding entities, so translations get them too
    if translator is not None:
        translator.translate_agendas(meeting["agendas"])
        translator.translate_meeting(meeting)

    apply_entities(meeting, ner_path, normalizer, stats, person_counter)
    apply_topics(meeting, topics_path, codebook, stats)
    meeting["segments"] = build_segments(meeting[SENTENCES])

    coords_index = build_coords_index(coords_root if coords_root is not None else xml_root, NAMESPACE_MAPPINGS)
    transformed_sentences = transform_sentences_fast(meeting, coords_index=coords_index)
    transformed_words = transform_words_fast(meeting, coords_index=coords_index)

    return meeting, transformed_sentences, transformed_words


def _display_name(name):
    """'Ambrož, Mihael' -> 'Mihael Ambrož'."""
    if name and ',' in name:
        surname, given = name.split(',', 1)
        return f"{given.strip()} {surname.strip()}"
    return name


def write_attendees(speakers_dir, destination, aliases):
    """Writes poslanci.jsonl."""
    with open(os.path.join(speakers_dir, "speakers_full_metadata.json"), 'r', encoding='utf-8') as f:
        members = json.load(f)["members"]

    documents = []
    for member_id, member in members.items():
        name_sl = _display_name(member.get("name"))
        name_de = _display_name(member.get("name_german")) or name_sl
        documents.append({
            "id": str(member_id),
            "names": {"sl": name_sl or name_de, "de": name_de or name_sl},
            "aliases": sorted(aliases.get(str(member_id), [])),
            "profession": member.get("profession"),
            "terms": sorted(member.get("terms", {}).keys(), key=int),
            "corpus": CORPUS_NAME,
        })
    save_to_jsonl(documents, os.path.join(destination, "poslanci.jsonl"))


def write_person_entities(person_counter, destination, top_n=PERSON_ENTITIES_TOP_N):
    """Writes person_entities.jsonl (most mentioned persons)."""
    documents = [{"id": person, "names": {"sl": person, "de": person}, "corpus": CORPUS_NAME, "count": count}
                 for person, count in person_counter.most_common(top_n)]
    save_to_jsonl(documents, os.path.join(destination, "person_entities.jsonl"))


def write_cap_topics(destination):
    """Writes all_cap_topics.jsonl."""
    codebook = read_cap_codebook()
    documents = [{"id": int(code),
                  "name": f"{entry['major_name']}: {entry['minor_name']}",
                  "name_sl": f"{entry['major_name_sl']}: {entry['minor_name_sl']}"}
                 for code, entry in sorted(codebook.items(), key=lambda kv: int(kv[0]))]
    save_to_jsonl(documents, os.path.join(destination, "all_cap_topics.jsonl"))


def _git_commit():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=os.path.dirname(__file__),
                                       stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return None


def write_manifest(destination, source, stats, normalizer, from_idx, to_idx, translate, elapsed):
    """Writes manifest.json with some stats."""
    location_mentions = stats['location']
    manifest = {
        "created": datetime.now().isoformat(timespec="seconds"),
        "parser": "parser_kranjska.py",
        "git_commit": _git_commit(),
        "source": os.path.abspath(source),
        "corpus": CORPUS_NAME,
        "options": {
            "translate": translate,
            "from_index": from_idx,
            "to_index": to_idx,
            # shared files are only from the parsed meetings
            "partial": from_idx != 0 or to_idx != -1,
            "coordinates": "Kranjska.TEI.ana.coords" if stats['meetings_with_coordinates'] else None,
        },
        "elapsed_seconds": round(elapsed, 1),
        "counts": dict(stats),
        "locations": {
            "mentions": location_mentions,
            "unmatched_mentions": stats['location_unmatched'],
            "unmatched_share": round(stats['location_unmatched'] / location_mentions, 3) if location_mentions else None,
            "matched_distinct_strings": dict(normalizer.matched),
            "unmatched_distinct_strings": len(normalizer.unmatched),
        },
        "shared_files": sorted(os.listdir(os.path.join(destination, SHARED_DIR))),
    }
    with open(os.path.join(destination, MANIFEST_FILE), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Saved manifest to {os.path.join(destination, MANIFEST_FILE)}")


def parse(source, destination, from_idx=0, to_idx=-1, translate=False):
    """
    source: directory with Kranjska.TEI.ana, Kranjska.NER, Kranjska.Topics and Kranjska.Speakers
    destination: output directory (shared files go to destination/shared)
    translate: sl <-> de translation, needs a GPU
    """
    tei_dir = os.path.join(source, TEI_DIR)
    ner_dir = os.path.join(source, NER_DIR)
    topics_dir = os.path.join(source, TOPICS_DIR)
    speakers_dir = os.path.join(source, SPEAKERS_DIR)
    coords_dir = os.path.join(source, COORDS_DIR)
    shared = os.path.join(destination, SHARED_DIR)
    os.makedirs(shared, exist_ok=True)
    started = time.time()

    normalizer = LocationNormalizer()
    translator = None
    if translate:
        from translation import Translator
        translator = Translator()
    codebook = load_cap_codebook()
    stats = Counter()
    person_counter = Counter()  # person -> count
    aliases = {}  # speaker id -> labels

    files = sorted(f for f in os.listdir(tei_dir) if f.startswith("DezelniZborKranjski") and f.endswith(".xml"))
    for i, file in enumerate(files):
        if i < from_idx:
            continue
        if i >= to_idx and to_idx != -1:
            break

        name = file[:-len(".xml")]
        print(f"parse(): processing {name} ({i + 1}/{len(files)})")

        xml_root = ET.parse(os.path.join(tei_dir, file)).getroot()
        coords_path = os.path.join(coords_dir, file)
        coords_root = ET.parse(coords_path).getroot() if os.path.exists(coords_path) else None

        speakers_path = os.path.join(speakers_dir, f"{name}.speakers.json")
        speakers = {}
        if os.path.exists(speakers_path):
            with open(speakers_path, 'r', encoding='utf-8') as f:
                speakers = json.load(f).get("speakers", {})
        else:
            print(f"WARNING: speakers file not found: {speakers_path}")
        for mapped in speakers.values():
            aliases.setdefault(str(mapped["id"]), set()).add(mapped["label"])

        zapisnik, povedi, besede = parse_zapisnik(
            xml_root,
            speakers,
            os.path.join(ner_dir, f"{name}.ner.json"),
            os.path.join(topics_dir, f"{name}.cap.json"),
            codebook,
            normalizer,
            stats,
            person_counter,
            coords_root,
            translator,
            read_tei_texts(os.path.join(source, PLAIN_TEI_DIR, file)),
        )

        save_to_jsonl([zapisnik], os.path.join(destination, zapisnik[ID] + "_meeting.jsonl"))
        save_to_jsonl(povedi, os.path.join(destination, zapisnik[ID] + "_sentences.jsonl"))
        save_to_jsonl(besede, os.path.join(destination, zapisnik[ID] + "_words.jsonl"))
        stats['meetings'] += 1
        stats['sentences'] += len(povedi)
        stats['words'] += len(besede)
        stats['words_with_coordinates'] += sum(1 for w in besede if w[COORDINATES])
        stats['meetings_with_coordinates'] += 1 if coords_root is not None else 0
        stats['sentences_with_topics'] += sum(1 for sentence in povedi if sentence[CAP_TOPICS])
        stats['sentences_with_person_entities'] += sum(1 for sentence in povedi if sentence[PERSON_ENTITIES])
        stats['sentences_with_location_entities'] += sum(1 for sentence in povedi if sentence[LOCATION_ENTITIES])
        stats['sentences_without_speaker_id'] += sum(1 for sentence in povedi if not sentence[SPEAKER_ID])

    write_attendees(speakers_dir, shared, aliases)
    write_cap_topics(shared)
    write_person_entities(person_counter, shared)
    shutil.copyfile(SIFRANT_PATH, os.path.join(shared, os.path.basename(SIFRANT_PATH)))
    normalizer.save_unmatched(os.path.join(shared, UNMATCHED_FILE))

    write_manifest(destination, source, stats, normalizer, from_idx, to_idx, translate, time.time() - started)

    print("\n[STATS]", dict(stats))
    print("[STATS] šifrant matches:", dict(normalizer.matched), "| unmatched distinct strings:", len(normalizer.unmatched))
