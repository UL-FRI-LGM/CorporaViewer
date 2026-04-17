#!/usr/bin/env python3
"""
Show statistics for extracted entities with frequencies.
"""

import json
from collections import Counter
from pathlib import Path

# Paths
INPUT_DIR = Path(r"C:\Projekti\Diploma\DZK\novi")

def extract_entities(jsonl_files):
    """Extract all person and location entities from JSONL files."""
    person_counter = Counter()
    location_counter = Counter()

    for jsonl_file in jsonl_files:
        with open(jsonl_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data = json.loads(line)
                    for person in data.get('person_entities', []):
                        if person:
                            person_counter[person] += 1
                    for location in data.get('location_entities', []):
                        if location:
                            location_counter[location] += 1
                except json.JSONDecodeError:
                    pass

    return person_counter, location_counter


def main():
    jsonl_files = list(INPUT_DIR.glob("*.jsonl"))
    person_counter, location_counter = extract_entities(jsonl_files)

    # Write stats to file (to avoid console encoding issues)
    output_file = INPUT_DIR.parent / "entity_statistics.txt"

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("="*80 + "\n")
        f.write("TOP 20 PERSON ENTITIES\n")
        f.write("="*80 + "\n\n")

        for rank, (person, count) in enumerate(person_counter.most_common(20), 1):
            f.write(f"{rank:2d}. {person:40s} ({count:3d} occurrences)\n")

        f.write("\n" + "="*80 + "\n")
        f.write("TOP 20 LOCATION ENTITIES\n")
        f.write("="*80 + "\n\n")

        for rank, (location, count) in enumerate(location_counter.most_common(20), 1):
            f.write(f"{rank:2d}. {location:40s} ({count:3d} occurrences)\n")

        f.write("\n" + "="*80 + "\n")
        f.write(f"Total unique persons: {len(person_counter)}\n")
        f.write(f"Total unique locations: {len(location_counter)}\n")
        f.write(f"Total person mentions: {sum(person_counter.values())}\n")
        f.write(f"Total location mentions: {sum(location_counter.values())}\n")
        f.write("="*80 + "\n")

    print(f"Statistics written to: {output_file}")


if __name__ == "__main__":
    main()
