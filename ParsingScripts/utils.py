import json


def save_to_jsonl(elements, file_path):
    with open(file_path, "w", encoding="utf-8") as file:
        for element in elements:
            file.write(json.dumps(element, ensure_ascii=False) + "\n")
    print("Saved " + str(len(elements)) + " elements to " + file_path)


def parse_attribs(elem):
    attribs = {}
    for key in elem.attrib:
        attrib_name = key.split('}')[-1]
        attribs[attrib_name] = elem.attrib[key]
    return attribs


# parses the date from the meeting id
def parse_date_from_id(id):
    date = id.split("_")[1].split("-")
    return date[2] + "." + date[1] + "." + date[0]


# parses the tag name from the element
def parse_tag(element):
    tag_name = element.tag.split("}")[-1]
    return tag_name


# finds all titles with language attribute and returns them as a list of dictionaries
def parse_titles(xml_root, namespace_mappings):
    titles = []

    for title in xml_root.findall(".//ns0:title", namespace_mappings):
        attribs = parse_attribs(title)
        if attribs != {}:
            titles.append({
                "title": title.text,
                "lang": attribs["lang"]
            })

    return titles


# parses the coordinates of an element
def parse_coordinates(element):
    coordinates = []

    try:
        from_page = int(element.get("fromPage"))
        to_page = int(element.get("toPage"))
        x_coords = [float(element.attrib.get(key)) for key in element.attrib.keys() if key.startswith("x")]
        y_coords = [float(element.attrib.get(key)) for key in element.attrib.keys() if key.startswith("y")]
        coords = list(zip(x_coords, y_coords))

        for i in range(0, len(coords), 2):
            rect_coords = coords[i:i + 2]
            x0, y0 = rect_coords[0]
            x1, y1 = rect_coords[1]

            coordinates.append({
                "page": from_page if from_page == to_page else (from_page if i == 0 else to_page),
                "x0": x0,
                "y0": y0,
                "x1": x1,
                "y1": y1
            })
    except Exception as e:
        # print("parse_coordinates(): error parsing coordinates: " + str(e))
        # print(element.attrib)
        return []

    return coordinates


def build_coords_index(xml_root, namespace_mappings):
    id_to_coords = {}
    for tag in ("w", "pc"):
        for el in xml_root.findall(f".//ns0:{tag}", namespace_mappings):
            eid = el.attrib.get("{http://www.w3.org/XML/1998/namespace}id") or el.attrib.get("id")
            if not eid:
                continue
            coords = parse_coordinates(el)
            if coords:
                id_to_coords[eid] = coords
    return id_to_coords


def transform_sentences_fast(meeting, coords_index=None):
    if coords_index is None:
        raise ValueError("coords_index is required for transform_sentences_fast")

    import time
    time_start = time.time()

    transformed_sentences = []
    for sentence in meeting.get("sentences", []):
        coords = []

        # prefer the original translation (original == 1)
        orig = next((t for t in sentence.get("translations", []) if t.get("original") == 1), None)
        if orig:
            for w in orig.get("words", []):
                wid = w.get("id")
                if not wid:
                    continue
                if wid in coords_index:
                    coords.extend(coords_index[wid])

        transformed_sentences.append({
            "meeting_id": meeting.get("id"),
            "sentence_id": sentence.get("id"),
            "segment_id": sentence.get("segment_id"),
            "speaker": sentence.get("speaker"),
            "coordinates": coords,
            "translations": [
                {"text": t.get("text"), "lang": t.get("lang"), "original": t.get("original")}
                for t in sentence.get("translations", [])
            ],
        })

    time_end = time.time()
    print("transform_sentences_fast(): transformed sentences in " + str(time_end - time_start) + " seconds")

    return transformed_sentences


def transform_words_fast(meeting, coords_index=None):
    if coords_index is None:
        raise ValueError("coords_index is required for transform_words_fast")

    import time
    time_start = time.time()

    transformed_words = []

    for sentence in meeting.get("sentences", []):
        for translation in sentence.get("translations", []):

            word_index = 0
            for i, word in enumerate(translation.get("words", [])):
                # `word` is a dict produced by lemmanize_text or original parse,
                # use its fields directly
                prev_join = translation["words"][i - 1].get("join") if i > 0 else None
                word_index = word_index + 1 if i > 0 and prev_join != "right" else word_index

                wid = word.get("id")
                coordinates = coords_index.get(wid, []) if (translation.get("original") == 1 and wid) else []

                transformed_words.append({
                    "meeting_id": meeting.get("id"),
                    "sentence_id": sentence.get("id"),
                    "segment_id": sentence.get("segment_id"),
                    "word_id": wid,
                    "type": word.get("type"),
                    "join": word.get("join"),
                    "text": word.get("text"),
                    "lemma": word.get("lemma"),
                    "speaker": sentence.get("speaker"),
                    "pos": i,
                    "wpos": word_index,
                    "coordinates": coordinates,
                    "lang": translation.get("lang"),
                    "original": translation.get("original"),
                    "propn": word.get("propn", 0)
                })

    time_end = time.time()
    print("transform_words_fast(): transformed words in " + str(time_end - time_start) + " seconds")

    return transformed_words


def get_lang_id(tokenizer, lang_code):
    try:
        return tokenizer.lang_code_to_id[lang_code]
    except AttributeError:
        return tokenizer.convert_tokens_to_ids(lang_code)

