import json
import os
import time

from elasticsearch import Elasticsearch, helpers

STATE_FILE = "uploader_state.json"
SHARED_DIR = "shared"  # files for all meetings
IGNORED_FILES = {"unmatched_location_entities.jsonl"}  # not uploaded

MEETINGS_INDEX_NAME = "meetings-index"
SENTENCES_INDEX_NAME = "sentences-index"
WORDS_INDEX_NAME = "words-index"
PLACES_INDEX_NAME = "places-index"
ATTENDEES_INDEX_NAME = "attendees-index"
PERSON_ENTITIES_INDEX_NAME = "person-entities-index"
CAP_TOPICS_INDEX_NAME = "cap-topics-index"

# Settings for the Elasticsearch indices (mappings, analyzers, etc.)
MEETINGS_INDEX_SETTINGS = {
    "index.mapping.total_fields.limit": 10000000,
    "index.mapping.nested_objects.limit": 10000000,
    "index.max_inner_result_window": 10000,
    "index.max_result_window": 10000,
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
}
MEETINGS_INDEX_MAPPING = {
    "properties": {
        "agendas": {
            "properties": {
                "items": {
                    "properties": {
                        "n": {
                            "type": "long"
                        },
                        "text": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        }
                    }
                },
                "lang": {
                    "type": "keyword"
                }
            }
        },
        "corpus": {
            "type": "keyword"
        },
        "cap_topics_aggregated": {
            "type": "keyword"
        },
        "date": {
            "type": "date",
            "format": "dd.MM.yyyy"
        },
        "id": {
            "type": "keyword",
        },
        "notes": {
            "properties": {
                "page": {
                    "type": "keyword"
                },
                "segment_id": {
                    "type": "keyword",

                },
                "speaker": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "text": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "type": {
                    "type": "keyword"
                }
            }
        },
        # merged sentences of a segment (advanced search)
        "segments": {
            "type": "nested",
            "properties": {
                "id": {"type": "keyword"},
                "speaker": {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}},
                "speaker_id": {"type": "keyword"},
                "original_language": {"type": "keyword"},
                "person_entities": {"type": "keyword"},
                "location_entities": {"type": "keyword"},
                "cap_topics": {"type": "keyword"},
                "text": {"type": "text"},
                "lemmas": {"type": "text"}
            }
        },
        "sentences": {
            "type": "nested",
            "properties": {
                "id": {
                    "type": "keyword",
                },
                "original_language": {
                    "type": "keyword"
                },
                "segment_id": {
                    "type": "keyword",
                },
                "segment_page": {
                    "type": "long"
                },
                "speaker": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "person_entities": {
                    "type": "keyword"
                },
                "location_entities": {
                    "type": "keyword"
                },
                "speaker_id": {
                    "type": "keyword"
                },
                "cap_topics": {
                    "type": "keyword"
                },
                "translations": {
                    "type": "nested",
                    "properties": {
                        "lang": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "original": {
                            "type": "long"
                        },
                        "speaker": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "speaker_id": {
                            "type": "keyword"
                        },
                        "person_entities": {
                            "type": "keyword"
                        },
                        "location_entities": {
                            "type": "keyword"
                        },
                        "text": {
                            "type": "text",
                            "fields": {
                                "keyword": {
                                    "type": "keyword",
                                    "ignore_above": 256
                                }
                            }
                        },
                        "words": {
                            "properties": {
                                "id": {
                                    "type": "keyword",
                                },
                                "lemma": {
                                    "type": "text",
                                    "fields": {
                                        "keyword": {
                                            "type": "keyword",
                                            "ignore_above": 256
                                        }
                                    }
                                },
                                "text": {
                                    "type": "text",
                                    "fields": {
                                        "keyword": {
                                            "type": "keyword",
                                            "ignore_above": 256
                                        }
                                    }
                                },
                                "type": {
                                    "type": "keyword"
                                },
                                "join": {
                                    "type": "keyword"
                                },
                                "propn": {
                                    "type": "long"
                                },
                            }
                        }
                    }
                }
            }
        },
        "titles": {
            "properties": {
                "lang": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                },
                "title": {
                    "type": "text",
                    "fields": {
                        "keyword": {
                            "type": "keyword",
                            "ignore_above": 256
                        }
                    }
                }
            }
        }
    }
}

SENTENCES_INDEX_SETTINGS = {
    "index.max_inner_result_window": 50000,
    "index.max_result_window": 50000,
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
    "analysis": {
        "filter": {
            "custom_ascii_folding": {
                "type": "asciifolding",
                "preserve_original": "false"
            }
        },
        "analyzer": {
            "custom_text_analyzer": {
                "filter": [
                    "custom_ascii_folding",
                    "lowercase"
                ],
                "type": "custom",
                "tokenizer": "standard"
            }
        }
    }
}
SENTENCES_INDEX_MAPPING = {
    "properties": {
        "coordinates": {
            "properties": {
                "page": {
                    "type": "long"
                },
                "x0": {
                    "type": "float"
                },
                "x1": {
                    "type": "float"
                },
                "y0": {
                    "type": "float"
                },
                "y1": {
                    "type": "float"
                }
            }
        },
        "meeting_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "segment_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "sentence_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "speaker": {
            "type": "text",
            "analyzer": "custom_text_analyzer"
        },
        "person_entities": {
            "type": "keyword"
        },
        "location_entities": {
            "type": "keyword"
        },
        "speaker_id": {
            "type": "keyword"
        },
        "cap_topics": {
            "type": "keyword"
        },
        "meeting_date": {
            "type": "date",
            "format": "dd.MM.yyyy"
        },
        "translations": {
            "type": "nested",
            "properties": {
                "lang": {
                    "type": "keyword"
                },
                "original": {
                    "type": "long"
                },
                "person_entities": {
                    "type": "keyword"
                },
                "location_entities": {
                    "type": "keyword"
                },
                "text": {
                    "type": "text",
                    "analyzer": "custom_text_analyzer"
                }
            }
        }
    }
}

WORDS_INDEX_SETTINGS = {
    "index.max_inner_result_window": 10000,
    "index.max_result_window": 10000,
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
    "analysis": {
        "filter": {
            "custom_ascii_folding": {
                "type": "asciifolding",
                "preserve_original": "false"
            }
        },
        "analyzer": {
            "custom_text_analyzer": {
                "filter": [
                    "custom_ascii_folding",
                    "lowercase"
                ],
                "type": "custom",
                "tokenizer": "standard"
            }
        }
    }
}
WORDS_INDEX_MAPPING = {
    "properties": {
        "coordinates": {
            "properties": {
                "page": {
                    "type": "long"
                },
                "x0": {
                    "type": "float"
                },
                "x1": {
                    "type": "float"
                },
                "y0": {
                    "type": "float"
                },
                "y1": {
                    "type": "float"
                }
            }
        },
        "lang": {
            "type": "keyword"
        },
        "lemma": {
            "type": "text",
            "analyzer": "custom_text_analyzer"
        },
        "meeting_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "original": {
            "type": "long"
        },
        "pos": {
            "type": "long"
        },
        "propn": {
            "type": "long"
        },
        "segment_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "sentence_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "speaker": {
            "type": "text",
            "analyzer": "custom_text_analyzer"
        },
        "text": {
            "type": "text",
            "analyzer": "custom_text_analyzer"
        },
        "speaker_id": {
            "type": "keyword"
        },
        "word_id": {
            "type": "keyword",
            "fields": {
                "sort": {
                    "type": "icu_collation_keyword",
                    "index": False,
                    "numeric": True
                }
            }
        },
        "wpos": {
            "type": "long"
        },
        "join": {
            "type": "keyword"
        },
        "type": {
            "type": "keyword"
        }
    }
}

PLACES_INDEX_SETTINGS = {
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
}
ATTENDEES_INDEX_SETTINGS = {
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
}

PERSON_ENTITIES_INDEX_SETTINGS = {
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
}

CAP_TOPICS_INDEX_SETTINGS = {
    "index.number_of_replicas": 0,
    "index.refresh_interval": "-1",
}


def load_progress():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding="utf-8") as file:
            state = json.load(file)
            return state

    return dict()


def file_signature(path):
    """Size and mtime, so changed files are uploaded again."""
    stat = os.stat(path)
    return {"size": stat.st_size, "mtime": int(stat.st_mtime)}


def list_source_files(source_dir):
    """All .jsonl files to upload, shared files first."""
    entries = []
    shared_dir = os.path.join(source_dir, SHARED_DIR)
    if os.path.isdir(shared_dir):
        entries += [(f"{SHARED_DIR}/{name}", os.path.join(shared_dir, name)) for name in sorted(os.listdir(shared_dir))]
    entries += [(name, os.path.join(source_dir, name)) for name in sorted(os.listdir(source_dir))
                if os.path.isfile(os.path.join(source_dir, name))]
    return [(key, path) for key, path in entries
            if key.endswith(".jsonl") and os.path.basename(path) not in IGNORED_FILES]


def save_progress(state):
    with open(STATE_FILE, 'w', encoding="utf-8") as file:
        json.dump(state, file)


def set_refresh_interval(es: Elasticsearch, index_name: str, interval: str = "1s"):
    body = {
        "index": {
            "refresh_interval": interval
        }
    }

    try:
        response = es.indices.put_settings(index=index_name, body=body)
        print(f"Refresh interval for '{index_name}' set to {interval}: {response}")
    except Exception as e:
        print(f"Error updating refresh_interval for '{index_name}': {e}")


# bulk upload settings, meetings are uploaded with one thread (big documents gave 429 errors)
UPLOAD_CHUNK_SIZE = 2000
UPLOAD_MAX_CHUNK_BYTES = 10 * 1024 * 1024
UPLOAD_THREADS = 4          # words and sentences
MAX_PRINTED_ERRORS = 3


def _actions(lines, index_name):
    for line in lines:
        doc = json.loads(line)
        action = {
            "_op_type": "index",
            "_index": index_name,
            "_source": doc,
        }

        # Set _id to avoid duplicates
        if "id" in doc:
            action["_id"] = doc["id"]
        elif "word_id" in doc:
            action["_id"] = doc["word_id"]
        elif "sentence_id" in doc:
            action["_id"] = doc["sentence_id"]

        yield action


# upload json lines to Elasticsearch
def upload_to_elasticsearch(es, lines, index_name, chunk_size=UPLOAD_CHUNK_SIZE, thread_count=1,
                            max_chunk_bytes=UPLOAD_MAX_CHUNK_BYTES):
    options = dict(chunk_size=chunk_size, max_chunk_bytes=max_chunk_bytes,
                   raise_on_error=False, raise_on_exception=False)
    actions = _actions(lines, index_name)
    if thread_count > 1:
        results = helpers.parallel_bulk(es, actions, thread_count=thread_count, **options)
    else:
        results = helpers.streaming_bulk(es, actions, **options)

    total, failed_count = 0, 0
    for ok, item in results:
        total += 1
        if not ok:
            failed_count += 1
            if failed_count <= MAX_PRINTED_ERRORS:
                print(f"{index_name}: failed to index a document: {item}")

    print(f"{index_name}: Uploaded {total - failed_count}/{total} element(s) to Elasticsearch.")

    return failed_count == 0


def create_index(es, index_name, settings, mappings, delete_index_if_exists):
    if not es.indices.exists(index=index_name):
        print("Creating index: " + index_name + "\n")
        es.indices.create(index=index_name, settings=settings, mappings=mappings)
    elif es.indices.exists(index=index_name) and delete_index_if_exists:
        print("Deleting index: " + index_name)
        es.indices.delete(index=index_name)
        print("Creating index: " + index_name + "\n")
        es.indices.create(index=index_name, settings=settings, mappings=mappings)


def apply_index_prefix(prefix):
    """Adds a prefix to all index names (for test uploads)."""
    global MEETINGS_INDEX_NAME, SENTENCES_INDEX_NAME, WORDS_INDEX_NAME, PLACES_INDEX_NAME
    global ATTENDEES_INDEX_NAME, PERSON_ENTITIES_INDEX_NAME, CAP_TOPICS_INDEX_NAME
    MEETINGS_INDEX_NAME = prefix + "meetings-index"
    SENTENCES_INDEX_NAME = prefix + "sentences-index"
    WORDS_INDEX_NAME = prefix + "words-index"
    PLACES_INDEX_NAME = prefix + "places-index"
    ATTENDEES_INDEX_NAME = prefix + "attendees-index"
    PERSON_ENTITIES_INDEX_NAME = prefix + "person-entities-index"
    CAP_TOPICS_INDEX_NAME = prefix + "cap-topics-index"


def index_for_file(jsonl_file):
    """Returns (index name, threads) or None."""
    if jsonl_file.endswith("_meeting.jsonl"):
        return MEETINGS_INDEX_NAME, 1
    if jsonl_file.endswith("_sentences.jsonl"):
        return SENTENCES_INDEX_NAME, UPLOAD_THREADS
    if jsonl_file.endswith("_words.jsonl"):
        return WORDS_INDEX_NAME, UPLOAD_THREADS
    if jsonl_file == "krajevna_imena_z_koordinatami.jsonl":
        return PLACES_INDEX_NAME, 1
    if jsonl_file == "poslanci.jsonl":
        return ATTENDEES_INDEX_NAME, 1
    if jsonl_file in ("top20_person_entities.jsonl", "person_entities.jsonl"):
        return PERSON_ENTITIES_INDEX_NAME, 1
    if jsonl_file == "all_cap_topics.jsonl":
        return CAP_TOPICS_INDEX_NAME, 1
    return None


def upload(source_dir, elasticsearch_host, elasticsearch_port, delete_index_if_exists=False, index_prefix=""):
    if index_prefix:
        apply_index_prefix(index_prefix)

    # initialize the Elasticsearch client
    es = Elasticsearch(
        [{'host': elasticsearch_host, 'port': elasticsearch_port, 'scheme': 'http'}],
        max_retries=20,
        request_timeout=180,
        http_compress=True,
        retry_on_timeout=True
    )

    # Create the Elasticsearch indices if they don't exist
    create_index(es, MEETINGS_INDEX_NAME, MEETINGS_INDEX_SETTINGS, MEETINGS_INDEX_MAPPING, delete_index_if_exists)
    create_index(es, SENTENCES_INDEX_NAME, SENTENCES_INDEX_SETTINGS, SENTENCES_INDEX_MAPPING, delete_index_if_exists)
    create_index(es, WORDS_INDEX_NAME, WORDS_INDEX_SETTINGS, WORDS_INDEX_MAPPING, delete_index_if_exists)
    create_index(es, PLACES_INDEX_NAME, PLACES_INDEX_SETTINGS, {}, delete_index_if_exists)
    create_index(es, ATTENDEES_INDEX_NAME, ATTENDEES_INDEX_SETTINGS, {}, delete_index_if_exists)
    create_index(es, PERSON_ENTITIES_INDEX_NAME, PERSON_ENTITIES_INDEX_SETTINGS, {}, delete_index_if_exists)
    create_index(es, CAP_TOPICS_INDEX_NAME, CAP_TOPICS_INDEX_SETTINGS, {}, delete_index_if_exists)

    state = load_progress()
    if delete_index_if_exists:
        # indices were recreated
        state = {}
        save_progress(state)

    # Upload the data to Elasticsearch
    entries = list_source_files(source_dir)
    for i, (key, file_path) in enumerate(entries):
        jsonl_file = os.path.basename(file_path)
        signature = file_signature(file_path)

        if key in state and state[key].get("isDone") and state[key].get("signature") == signature:
            print(f"skipping file {key} (already uploaded)\n")
            continue

        if i > 0 and i % 500 == 0:
            time.sleep(60)
            print("Going to sleep for 60s so we dont crash elastic")

        state[key] = {"isDone": False, "signature": signature}

        target = index_for_file(jsonl_file)
        if target is None:
            print("unknown file: " + jsonl_file + " skipping upload")
            continue

        index_name, thread_count = target
        started = time.time()
        with open(file_path, "r", encoding="utf-8") as file:
            state[key]["isDone"] = upload_to_elasticsearch(es, file, index_name, thread_count=thread_count)
        print(f"{key}: {time.time() - started:.1f} s")

        print("uploaded: " + key)
        print(f"progress: {i+1}/{len(entries)}\n")

        save_progress(state)

    set_refresh_interval(es, MEETINGS_INDEX_NAME)
    set_refresh_interval(es, SENTENCES_INDEX_NAME)
    set_refresh_interval(es, WORDS_INDEX_NAME)
    set_refresh_interval(es, PLACES_INDEX_NAME)
    set_refresh_interval(es, ATTENDEES_INDEX_NAME)
    set_refresh_interval(es, PERSON_ENTITIES_INDEX_NAME)
    set_refresh_interval(es, CAP_TOPICS_INDEX_NAME)

    print("Uploaded meetings, sentences and words to Elasticsearch")
