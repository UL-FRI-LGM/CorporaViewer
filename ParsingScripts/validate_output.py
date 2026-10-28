"""
Checks the parser output against the Kranjska 2.0 sources.

    python validate_output.py <DZK dir> <parser output dir>
"""
import glob
import json
import os
import sys
import xml.etree.ElementTree as ET
from collections import Counter

TEI_S = "{http://www.tei-c.org/ns/1.0}s"


def read_jsonl(path):
    with open(path, 'r', encoding='utf-8') as f:
        return [json.loads(line) for line in f if line.strip()]


def main(source, output):
    stats = Counter()
    problems = []

    for meeting_path in sorted(glob.glob(os.path.join(output, "*_meeting.jsonl"))):
        meeting_id = os.path.basename(meeting_path)[:-len("_meeting.jsonl")]
        meeting = read_jsonl(meeting_path)[0]
        sentences = read_jsonl(os.path.join(output, f"{meeting_id}_sentences.jsonl"))
        words = read_jsonl(os.path.join(output, f"{meeting_id}_words.jsonl"))

        stats['meetings'] += 1

        sentence_ids = {s["sentence_id"] for s in sentences}
        if len(sentence_ids) != len(sentences):
            problems.append(f"{meeting_id}: duplicate sentence ids")
        stats['sentences'] += len(sentences)
        stats['words'] += len(words)
        stats['sentences_without_speaker_id'] += sum(1 for s in sentences if not s.get("speaker_id"))
        stats['sentences_with_topics'] += sum(1 for s in sentences if s.get("cap_topics"))
        stats['sentences_with_person'] += sum(1 for s in sentences if s.get("person_entities"))
        stats['sentences_with_location'] += sum(1 for s in sentences if s.get("location_entities"))
        stats['empty_text'] += sum(1 for s in sentences if not s["translations"][0]["text"].strip())
        if not meeting.get("cap_topics_aggregated"):
            stats['meetings_without_topics'] += 1

    # compare sentence counts with the plain TEI
    tei_total = 0
    for path in glob.glob(os.path.join(source, "Kranjska.TEI", "DezelniZborKranjski-*.xml")):
        tei_total += sum(1 for _ in ET.parse(path).getroot().iter(TEI_S))

    print("Meetings parsed:", stats['meetings'])
    print(f"Sentences: {stats['sentences']} (TEI: {tei_total}) -> {'OK' if stats['sentences'] == tei_total else 'MISMATCH'}")
    print("Words:", stats['words'])
    for key in ('sentences_without_speaker_id', 'sentences_with_topics', 'sentences_with_person',
                'sentences_with_location', 'empty_text', 'meetings_without_topics'):
        print(f"{key}: {stats[key]}")
    for problem in problems[:20]:
        print("PROBLEM:", problem)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
