import json
import os
import time

from elasticsearch import Elasticsearch, helpers

STATE_FILE = "uploader_state.json"


MEETINGS_INDEX_NAME = "meetings-index"
SENTENCES_INDEX_NAME = "sentences-index"
WORDS_INDEX_NAME = "words-index"
PLACES_INDEX_NAME = "places-index"
ATTENDEES_INDEX_NAME = "attendees-index"

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
        "sentences": {
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
        "translations": {
            "type": "nested",
            "properties": {
                "lang": {
                    "type": "keyword"
                },
                "original": {
                    "type": "long"
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


def load_progress():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, 'r', encoding="utf-8") as file:
            state = json.load(file)
            return state

    return dict()


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


# upload a list of elements to Elasticsearch
def upload_to_elasticsearch(es, elements, index_name):
    actions = []
    for element in elements:
        doc = json.loads(element)
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

        actions.append(action)

    # if actions list is longer than 100, split it into multiple lists and upload them separately
    failed_count = 0
    for i in range(0, len(actions), 100):
        _, failed = helpers.bulk(es, actions[i:i + 100], stats_only=True)
        failed_count += failed

    print(f"{index_name}: Uploaded {len(actions)} element(s) to Elasticsearch.")

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


def upload(source_dir, elasticsearch_host, elasticsearch_port, delete_index_if_exists=False):
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

    state = load_progress()

    # Upload the data to Elasticsearch
    jsonl_files = os.listdir(source_dir)
    for i, jsonl_file in enumerate(jsonl_files):

        if jsonl_file in state and state[jsonl_file]["isDone"]:
            print(f"skipping file {jsonl_file}\n")
            continue

        if i > 0 and i % 500 == 0:
            time.sleep(60)
            print("Going to sleep for 60s so we dont crash elastic")

        state[jsonl_file] = dict()
        state[jsonl_file]["isDone"] = False

        file_path = os.path.join(source_dir, jsonl_file)
        if jsonl_file.endswith("_meeting.jsonl"):
            with open(file_path, "r", encoding="utf-8") as file:
                meetings = file.readlines()
                state[jsonl_file]["isDone"] = upload_to_elasticsearch(es, meetings, MEETINGS_INDEX_NAME)
        elif jsonl_file.endswith("_sentences.jsonl"):
            with open(file_path, "r", encoding="utf-8") as file:
                sentences = file.readlines()
                state[jsonl_file]["isDone"] = upload_to_elasticsearch(es, sentences, SENTENCES_INDEX_NAME)
        elif jsonl_file.endswith("_words.jsonl"):
            with open(file_path, "r", encoding="utf-8") as file:
                words = file.readlines()
                state[jsonl_file]["isDone"] = upload_to_elasticsearch(es, words, WORDS_INDEX_NAME)
        elif jsonl_file == "krajevna_imena.jsonl":
            with open(file_path, "r", encoding="utf-8") as file:
                krajevna_imena = file.readlines()
                state[jsonl_file]["isDone"] = upload_to_elasticsearch(es, krajevna_imena, PLACES_INDEX_NAME)
        elif jsonl_file == "poslanci.jsonl":
            with open(file_path, "r", encoding="utf-8") as file:
                poslanci = file.readlines()
                state[jsonl_file]["isDone"] = upload_to_elasticsearch(es, poslanci, ATTENDEES_INDEX_NAME)
        else:
            print("unknown file: " + jsonl_file + " skipping upload")
            continue

        print("uploaded: " + jsonl_file)
        print(f"progress: {i}/{len(jsonl_files)}\n")

        save_progress(state)

    set_refresh_interval(es, MEETINGS_INDEX_NAME)
    set_refresh_interval(es, SENTENCES_INDEX_NAME)
    set_refresh_interval(es, WORDS_INDEX_NAME)
    set_refresh_interval(es, PLACES_INDEX_NAME)
    set_refresh_interval(es, ATTENDEES_INDEX_NAME)

    print("Uploaded meetings, sentences and words to Elasticsearch")

