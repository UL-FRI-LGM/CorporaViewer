"""
Upload speed test on a few meetings, uses temporary bench-* indices that are deleted at the end.

    python bench_upload.py <parser output dir> [--meetings 12] [--largest] [--only-new] [--host localhost] [--port 9200]
"""
import argparse
import glob
import os
import time

from elasticsearch import Elasticsearch, helpers

import uploader

PREFIX = "bench-"


def read_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.readlines()


def legacy_upload(es, lines, index_name, **_):
    # old upload: everything in memory, bulk of 100 documents
    actions = list(uploader._actions(lines, index_name))
    failed_count = 0
    for i in range(0, len(actions), 100):
        _, failed = helpers.bulk(es, actions[i:i + 100], stats_only=True)
        failed_count += failed
    return failed_count == 0


def make_uploader(chunk_size, threads):
    def upload(es, lines, index_name, **_):
        return uploader.upload_to_elasticsearch(es, lines, index_name, chunk_size=chunk_size, thread_count=threads)

    return upload


def recreate_indices(es):
    uploader.create_index(es, uploader.MEETINGS_INDEX_NAME, uploader.MEETINGS_INDEX_SETTINGS,
                          uploader.MEETINGS_INDEX_MAPPING, True)
    uploader.create_index(es, uploader.SENTENCES_INDEX_NAME, uploader.SENTENCES_INDEX_SETTINGS,
                          uploader.SENTENCES_INDEX_MAPPING, True)
    uploader.create_index(es, uploader.WORDS_INDEX_NAME, uploader.WORDS_INDEX_SETTINGS,
                          uploader.WORDS_INDEX_MAPPING, True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output")
    parser.add_argument("--meetings", type=int, default=12)
    parser.add_argument("--largest", action="store_true", help="use the largest meetings instead of the first ones")
    parser.add_argument("--only-new", action="store_true", help="skip the slow legacy and 1-thread configurations")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=9200)
    args = parser.parse_args()

    uploader.apply_index_prefix(PREFIX)
    es = Elasticsearch([{'host': args.host, 'port': args.port, 'scheme': 'http'}], max_retries=20,
                       request_timeout=180, http_compress=True, retry_on_timeout=True)

    meeting_files = sorted(glob.glob(os.path.join(args.output, "*_meeting.jsonl")))
    if args.largest:
        meeting_files.sort(key=lambda path: -os.path.getsize(path[:-len("_meeting.jsonl")] + "_words.jsonl"))
    meeting_files = meeting_files[:args.meetings]
    data = {"meetings": [], "sentences": [], "words": []}
    for path in meeting_files:
        base = path[:-len("_meeting.jsonl")]
        data["meetings"] += read_lines(path)
        data["sentences"] += read_lines(base + "_sentences.jsonl")
        data["words"] += read_lines(base + "_words.jsonl")
    print(f"Benchmark data: {len(meeting_files)} meetings = " + ", ".join(f"{len(v)} {k}" for k, v in data.items()))

    indices = {"meetings": uploader.MEETINGS_INDEX_NAME, "sentences": uploader.SENTENCES_INDEX_NAME,
               "words": uploader.WORDS_INDEX_NAME}
    configs = [
        ("legacy: 100 per request, sequential", legacy_upload),
        ("chunk 500, 1 thread", make_uploader(500, 1)),
        ("chunk 2000, 1 thread", make_uploader(2000, 1)),
        ("chunk 2000, words/sentences 4 threads", None),  # uploader defaults
    ]

    if args.only_new:
        configs = configs[-1:]

    results = []
    try:
        for label, function in configs:
            recreate_indices(es)
            timings = {}
            for kind in ("meetings", "sentences", "words"):
                started = time.time()
                if function is None:
                    threads = 1 if kind == "meetings" else uploader.UPLOAD_THREADS
                    ok = make_uploader(uploader.UPLOAD_CHUNK_SIZE, threads)(es, data[kind], indices[kind])
                else:
                    ok = function(es, data[kind], indices[kind])
                timings[kind] = time.time() - started
                assert ok, f"upload to {indices[kind]} reported failures"

            es.indices.refresh(index=",".join(indices.values()))
            counts = {kind: es.count(index=indices[kind])["count"] for kind in indices}
            assert all(counts[k] == len(data[k]) for k in counts), f"document counts differ: {counts}"
            results.append((label, timings))
            print(f"{label}: " + ", ".join(f"{k} {v:.1f} s" for k, v in timings.items()) + f" | total {sum(timings.values()):.1f} s")
    finally:
        for name in indices.values():
            if es.indices.exists(index=name):
                es.indices.delete(index=name)
        print("Benchmark indices deleted.")

    if args.only_new:
        words = len(data["words"])
        total = sum(len(v) for v in data.values())
        timings = results[0][1]
        print("Documents per second: " + format(total / sum(timings.values()), ".0f") + " (words: " + format(words / timings["words"], ".0f") + ")")
        return

    baseline = sum(results[0][1].values())
    print("\nSummary (total time, speed-up vs legacy):")
    for label, timings in results:
        total = sum(timings.values())
        print(f"  {label:45s} {total:7.1f} s   x{baseline / total:.1f}")
    words = len(data["words"])
    fastest = min(sum(t.values()) for _, t in results)
    print(f"\nDocuments per second (all three indices, fastest): {(sum(len(v) for v in data.values())) / fastest:.0f}")
    print(f"Words only, legacy: {words / results[0][1]['words']:.0f} docs/s, best: "
          f"{words / min(t['words'] for _, t in results):.0f} docs/s")


if __name__ == "__main__":
    main()
