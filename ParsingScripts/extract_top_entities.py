#!/usr/bin/env python3
"""
Extract top 20 person_entities and location_entities from JSONL files.
"""

import json
from collections import Counter
from pathlib import Path

# Paths
INPUT_DIR = Path(r"C:\Projekti\Diploma\DZK\novi")
OUTPUT_DIR = Path(r"C:\Projekti\Diploma\DZK\json-output")

def extract_entities(jsonl_files):
    """Extract all person and location entities from JSONL files."""
    person_counter = Counter()
    location_counter = Counter()

    for jsonl_file in jsonl_files:
        print(f"Processing: {jsonl_file.name}")
        with open(jsonl_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    data = json.loads(line)

                    # Count person entities
                    for person in data.get('person_entities', []):
                        if person:  # Skip empty strings
                            person_counter[person] += 1

                    # Count location entities
                    for location in data.get('location_entities', []):
                        if location:  # Skip empty strings
                            location_counter[location] += 1

                except json.JSONDecodeError as e:
                    print(f"  Warning: Skipping line {line_num} in {jsonl_file.name}: {e}")

    return person_counter, location_counter


def write_persons_jsonl(person_counter, output_file, top_n=20):
    """Write top N persons to JSONL file."""
    print(f"\nWriting top {top_n} persons to {output_file.name}")

    with open(output_file, 'w', encoding='utf-8') as f:
        for person, count in person_counter.most_common(top_n):
            entry = {
                "id": person,
                "names": {
                    "sl": person,
                    "de": person
                },
                "corpus": "DezelniZborKranjski"
            }
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    print(f"  Wrote {top_n} persons")


def write_locations_jsonl(location_counter, output_file, top_n=20):
    """Write top N locations to JSONL file."""
    print(f"\nWriting top {top_n} locations to {output_file.name}")

    with open(output_file, 'w', encoding='utf-8') as f:
        for idx, (location, count) in enumerate(location_counter.most_common(top_n), 1):
            entry = {
                "id": f"DezelniZborKranjski_place_{idx}",
                "names": {
                    "de": location
                },
                "corpus": "DezelniZborKranjski"
            }
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    print(f"  Wrote {top_n} locations")


def main():
    # Find all JSONL files
    jsonl_files = list(INPUT_DIR.glob("*.jsonl"))
    print(f"Found {len(jsonl_files)} JSONL files in {INPUT_DIR}")

    if not jsonl_files:
        print("No JSONL files found!")
        return

    # Extract entities
    print("\n" + "="*60)
    print("Extracting entities from all files...")
    print("="*60)
    person_counter, location_counter = extract_entities(jsonl_files)

    print(f"\nTotal unique persons: {len(person_counter)}")
    print(f"Total unique locations: {len(location_counter)}")
    print(f"Total person mentions: {sum(person_counter.values())}")
    print(f"Total location mentions: {sum(location_counter.values())}")

    # Create output directory if it doesn't exist
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Write top 20 to JSONL files
    print("\n" + "="*60)
    write_persons_jsonl(
        person_counter,
        OUTPUT_DIR / "top20_person_entities.jsonl",
        top_n=20
    )

    print("\n" + "="*60)
    write_locations_jsonl(
        location_counter,
        OUTPUT_DIR / "top20_location_entities.jsonl",
        top_n=20
    )

    print("\n" + "="*60)
    print("Done! Output files:")
    print(f"  - {OUTPUT_DIR / 'top20_person_entities.jsonl'}")
    print(f"  - {OUTPUT_DIR / 'top20_location_entities.jsonl'}")
    print("="*60)


if __name__ == "__main__":
    main()