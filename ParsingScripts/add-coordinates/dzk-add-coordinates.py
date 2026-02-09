import os
import re
import time
import xml.etree.ElementTree as ET

import edlib
import pdfplumber

PATH_TO_XML_FILES = "D:\\diplomska-data\\raw-data\\kranjska-xml"
PATH_TO_PDF_FILES = "D:\\diplomska-data\\raw-data\\kranjska-pdf"
OUTPUT_FILE = "D:\\diplomska-data\\first-parsing\\second-attempt"

# Set to True if you want to visualize the coordinates on the PDF and save the images into a folder
VISUALIZE_COORDINATES_FROM_XML = False
VISUALIZATION_FILE = "D:\\diplomska-data\\visualizations\\first-parsing\\second-attempt"

SKIP_FILES_TO =  0 # set to 0 if you want to convert all files
MAX_FILES = -1  # set to -1 if you want to convert all files

# If you want to see alignment for each word in the sentence set this to True
# Target -> word from the xml; Best match -> word from the pdf; Similarity -> similarity between the two words
PRINT_ALIGNMENT = False

# Namespace
TEI = "http://www.tei-c.org/ns/1.0"

# Tags in the XML files
SEGMENT_TAG = "{" + TEI + "}seg"
NOTE_TAG = "{" + TEI + "}note"
SENTENCE_TAG = "{" + TEI + "}s"
WORD_TAG = "{" + TEI + "}w"
PUNCTUATION_TAG = "{" + TEI + "}pc"

# Characters that are 100% not in the xml files ()
CHARACTERS_TO_REMOVE: set[str] = {'@', '#', '$', '^', '&', '*', '<', '>', '­', '-'}

# Additional equalities for Edlib to improve alignment
ADDIDIONAL_EQUALITIES: list[tuple[str, str]] = [
    ('m', 'n'), ('n', 'm'),
    ('>', 'i'),
    ('U', 'a'), ('a', 'U'),
    ('A', 'a'), ('a', 'A'),
    ('—', '-'), ('-', '—'),
    ('\'', '’'), ('’', '\''),
    ('\"', '“'), ('“', '\"'),
]


def visualize_xml(xml_root: ET.Element, xml_path: str, pdf_path: str) -> None:
    xml_elements = get_elements_by_tags(xml_root, {WORD_TAG, PUNCTUATION_TAG})

    base_name = os.path.basename(xml_path).replace('.tei.xml', '')

    # Make a list of images of each page in the PDF
    images = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            images.append(page.to_image(resolution=150))

    # For each word in the XML draw a rectangle around it on the PDF
    for xml_element in xml_elements:

        # Skip elements that are considered as noise
        if 'fromPage' not in xml_element.attrib or 'toPage' not in xml_element.attrib or 'x0' not in xml_element.attrib or 'y0' not in xml_element.attrib:
            continue

        try:
            fromPage = int(xml_element.attrib['fromPage'])
            toPage = int(xml_element.attrib['toPage'])

            x_coords = [float(xml_element.attrib[key]) for key in xml_element.attrib if key.startswith('x')]
            y_coords = [float(xml_element.attrib[key]) for key in xml_element.attrib if key.startswith('y')]

            i = 0
            for x0, y0, x1, y1 in zip(x_coords[::2], y_coords[::2], x_coords[1::2], y_coords[1::2]):
                page_num = fromPage if i == 0 else toPage

                images[page_num].draw_rect((x0, y0, x1, y1), stroke_width=1)
                i += 1
        except:
            print(
                f"visualize_xml(): COORD ERROR with word: '{xml_element.text}', {xml_element.attrib.get('{' + TEI + '}id')}")

    # Save the images
    if not os.path.exists(os.path.join(VISUALIZATION_FILE, base_name)):
        os.makedirs(os.path.join(VISUALIZATION_FILE, base_name))
    for i, image in enumerate(images):
        image.save(os.path.join(VISUALIZATION_FILE, base_name, f"{base_name}_{i}.png"), )


def get_associated_pdf(xml_path: str) -> str:
    xml_name = os.path.basename(xml_path)
    pdf_name = xml_name.replace('.tei.xml', '.pdf')
    pdf_path = os.path.join(PATH_TO_PDF_FILES, pdf_name)

    return pdf_path


def get_elements_by_tags(root: ET.Element, wanted_tags: set[str]) -> list[ET.Element]:
    elements = []
    for child in root:
        if child.tag in wanted_tags:
            elements.append(child)
        elements.extend(get_elements_by_tags(child, wanted_tags))
    return elements


def get_text_from_element(element: ET.Element) -> str:
    if element.tag in {WORD_TAG, PUNCTUATION_TAG, NOTE_TAG}:
        return element.text

    return "".join([child.text for child in element])


def get_position_of_target_in_sequence(target: str, sequence: str, last_occurrence: bool = False) -> tuple[int, int]:
    results: dict = edlib.align(
        target,
        sequence,
        task="path",
        mode="HW",
        additionalEqualities=ADDIDIONAL_EQUALITIES
    )

    occurrence = 0 if not last_occurrence else -1

    return results['locations'][occurrence]


def get_chars_from_pdf(pdf_path: str) -> list[dict]:
    pdf_chars: list[dict] = []

    # Collect all characters from the PDF into a list
    with pdfplumber.open(pdf_path, ) as pdf:
        for page_no, pdf_page in enumerate(pdf.pages):
            chars_on_page: list[dict] = pdf_page.chars
            if not chars_on_page:
                continue

            pdf_chars.extend(chars_on_page)

    return pdf_chars


def save_xml_tree(xml_tree: ET.ElementTree, output_file: str) -> None:
    ET.register_namespace('', TEI)
    xml_tree.write(output_file, encoding='utf-8')


# Filters out chars that are not part of the session content (before the session_start_str and after the page where session_end_str occurs)
def get_session_content(pdf_chars: list[dict], session_start_str: str, session_end_str: str) -> \
        list[dict]:
    # session_start_str is string below which we start extracting text (start of the session content)
    # session_end_str - page where last occurrence of this string is found is the last page of the session content

    # If the session start or end notes are not provided, return the original list of characters
    if not session_start_str or not session_end_str:
        return pdf_chars

    sequence: str = "".join([char['text'] for char in pdf_chars])
    sequence = re.sub(r'\s+', '', sequence)

    session_start_idx: int = get_position_of_target_in_sequence(session_start_str, sequence)[0]
    session_end_idx: int = get_position_of_target_in_sequence(session_end_str, sequence, last_occurrence=True)[1]

    # Necessary parameters for filtering out the session content
    first_page: int = pdf_chars[session_start_idx]['page_number']
    first_page_session_start_y: float = pdf_chars[session_start_idx]['top'] - 10
    last_page: int = pdf_chars[session_end_idx]['page_number']

    # In some rare cases this approach with start and end notes does not work
    # In this case we just set the last page to the last page of the PDF
    # PDFs usually only one empty page at the end which can be filled with noise
    if last_page < (pdf_chars[-1]['page_number']):
        last_page = pdf_chars[-1]['page_number']

    # Filter out the session content
    session_content: list[dict] = []
    for char in pdf_chars:
        # Remove characters that are not part of the session content
        if char["page_number"] > last_page:
            continue

        if char["page_number"] <= first_page and (
                char['page_number'] != first_page or char['top'] < first_page_session_start_y):
            continue

        session_content.append(char)

    return session_content


# Remove unwanted characters and whitespaces (improves the alignment and search)
def remove_unwanted_chars(pdf_chars: list[dict], unwanted_chars: set[str]) -> list[dict]:
    return [char for char in pdf_chars if char['text'] not in unwanted_chars and not char['text'].isspace()]


def get_locations_to_remove(alignment: str) -> list[tuple[int, int]]:
    locations_to_remove: list[tuple[int, int]] = []
    start = None  # To mark the start of a sequence of '-'
    noise_count = 0  # To count the '|' characters within a sequence

    for i, char in enumerate(alignment):
        if char == '-':
            if start is None:
                start = i  # Mark the start of a sequence
                noise_count = 0  # Reset noise count
        else:
            if start is not None:
                noise_count += 1  # Increment noise count

                if all([c != '-' for c in alignment[i + 1:i + 1 + 6]]):
                    locations_to_remove.append((start, i - noise_count))  # End of a sequence
                    start = None

    if start is not None:
        locations_to_remove.append((start, len(alignment)))

    return locations_to_remove


def align_pdf_with_xml(xml_sentences: list[ET.Element], pdf_chars: list[dict]) -> list[dict]:
    target = "".join([get_text_from_element(element) for element in xml_sentences])
    target = re.sub(r'\s+', '', target)
    sequence: str = "".join([re.sub(r'\s+', '', char["text"]) for char in pdf_chars])

    result = edlib.align(target, sequence, task="path", mode="NW")
    alignment: str = edlib.getNiceAlignment(result, target, sequence)['matched_aligned']
    locations_to_remove: list[tuple[int, int]] = get_locations_to_remove(alignment)

    filtered_pdf_chars: list[dict] = []
    for i, char in enumerate(pdf_chars):
        if any([start <= i < end for start, end in locations_to_remove]):
            continue

        filtered_pdf_chars.append(char)

    return filtered_pdf_chars


# Adds coordinates to the xml element
def add_metadata(xml_element: ET.Element, pdf_chars: list[dict]) -> None:
    coord_counter: int = 0
    for i, char in enumerate(pdf_chars):
        if i == 0:
            xml_element.set(f'x{coord_counter}', str(round(char['x0'], 2)))
            xml_element.set(f'y{coord_counter}', str(round(char['top'], 2)))
            xml_element.set('fromPage', str(char['page_number'] - 1))
            xml_element.set('isBroken', 'false')
            coord_counter += 1

        if 0 <= i < len(pdf_chars) - 1 and \
                i + 1 < len(pdf_chars) and \
                abs(int(char['bottom']) - int(pdf_chars[i + 1]['bottom'])) >= 4:
            # end of previous part of the word
            xml_element.set(f'x{coord_counter}', str(round(char['x1'], 2)))
            xml_element.set(f'y{coord_counter}', str(round(char['bottom'], 2)))
            coord_counter += 1
            # start of new part of the word
            xml_element.set(f'x{coord_counter}', str(round(pdf_chars[i + 1]['x0'], 2)))
            xml_element.set(f'y{coord_counter}', str(round(pdf_chars[i + 1]['top'], 2)))
            coord_counter += 1

            xml_element.set('isBroken', 'true')

        if i == len(pdf_chars) - 1:
            xml_element.set(f'x{coord_counter}', str(round(char['x1'], 2)))
            xml_element.set(f'y{coord_counter}', str(round(char['bottom'], 2)))
            xml_element.set('toPage', str(char['page_number'] - 1))


# Extracts coordinates for each word in a sentence
def parse_words(pdf_chars: list[dict], xml_sentence: ET.Element):
    elements_in_sentence: list[ET.Element] = get_elements_by_tags(xml_sentence, {WORD_TAG, PUNCTUATION_TAG})

    sequence: str = "".join([re.sub(r'\s+', '', char["text"]) for char in pdf_chars])

    if PRINT_ALIGNMENT:
        print("\nSentence:", sequence)

    best_match_end: int = 0
    search_from: int = 0
    result: dict = None
    while elements_in_sentence:
        xml_element: ET.Element = elements_in_sentence.pop(0)
        target: str = re.sub(r'\s+', '', get_text_from_element(xml_element))

        similarity_curr: float = 0
        similarity_prev: float = -1
        BUFFER: int = 2

        while similarity_prev < similarity_curr < 1.0:
            search_area_start = search_from
            search_area_end = search_area_start + len(target) + BUFFER
            search_area: str = sequence[search_area_start:search_area_end]

            result = edlib.align(target, search_area, task="path", mode='HW',
                                 additionalEqualities=ADDIDIONAL_EQUALITIES)

            similarity_prev = similarity_curr
            similarity_curr = 1 - result['editDistance'] / len(target)

            BUFFER += 1

        if result['locations'][0][0] is None:
            continue

        best_match_start: int = search_from + result['locations'][0][0]
        best_match_end: int = search_from + result['locations'][0][-1]

        # Move the search area forward in case the target is of length 1
        #search_from = best_match_end if best_match_end > search_from or \
        #                                (elements_in_sentence and len(
        #                                    elements_in_sentence[0].text) > 1) else best_match_end + 1

        search_from = best_match_end + 1

        if PRINT_ALIGNMENT:
            print(
                f"Target: {target: <25} Best match: {sequence[best_match_start:best_match_end + 1]: <25} Similarity: {similarity_curr:.2f}")

        # Add coordinates to xml element
        add_metadata(xml_element, pdf_chars[best_match_start:best_match_end + 1])


def parse_record(xml_path: str, pdf_path: str) -> None:
    xml_tree = ET.parse(xml_path)
    xml_root: ET.Element = xml_tree.getroot()

    # Get all elements from the XML that are part of the session content
    print("parse_record(): Getting session content from XML")
    session_xml_content: list[ET.Element] = get_elements_by_tags(xml_root, {SENTENCE_TAG, NOTE_TAG})
    session_xml_content = [element for element in session_xml_content if element or element.text]

    # 1. Get all characters from the PDF and perform filtering
    print("parse_record(): Getting characters from PDF")
    pdf_chars: list[dict] = get_chars_from_pdf(pdf_path)
    # 2. Get notes that indicate the start and end of the session
    print("parse_record(): Filtering unnecessary characters")
    notes: list[ET.Element] = get_elements_by_tags(xml_root, {NOTE_TAG})
    session_start_note: ET.Element = notes[0]
    session_end_note: ET.Element = notes[-1]

    # Files of volume 8 are exceptions (we have to remove second note element, because it messes up the alignment)
    if re.match(r"DezelniZborKranjski-\d{8}-08-\d{2}\.tei\.xml", os.path.basename(xml_path)):
        session_xml_content.remove(notes[1])

    # 3. Keep only characters that are part of the session content (between the start and end notes)
    session_pdf_content: list[dict] = get_session_content(
        pdf_chars,
        session_start_note.text if session_start_note.text else None,
        session_end_note.text if session_end_note.text else None
    )
    # 4. Remove unwanted characters
    session_pdf_content = remove_unwanted_chars(session_pdf_content, CHARACTERS_TO_REMOVE)
    # 5. Align the XML content with the PDF content (to remove any text from the PDF that is not in the XML)
    session_pdf_content = align_pdf_with_xml(session_xml_content, session_pdf_content)

    # Add the coordinates to the XML content
    print("parse_record(): Adding metadata to XML")

    best_match_end: int = 0
    search_area_start: int = 0
    sequence: str = "".join([char['text'] for char in session_pdf_content])
    while session_xml_content:

        # Sentence or note element
        xml_element: ET.Element = session_xml_content.pop(0)
        target: str = re.sub(r'\s+', '', get_text_from_element(xml_element))

        result: dict = None
        similarity_curr: float = 0
        similarity_prev: float = -1
        BUFFER: int = 1

        while similarity_prev < similarity_curr < 1.0:
            # adjust searching area while searching for the target sentence
            search_area_start = best_match_end
            search_area_end = search_area_start + len(target) + BUFFER
            search_area = sequence[search_area_start:search_area_end]

            # Perform alignment
            result = edlib.align(target, search_area, task="path", mode="HW",
                                 additionalEqualities=ADDIDIONAL_EQUALITIES)

            # Update similarity values
            similarity_prev = similarity_curr
            similarity_curr = 1 - (result['editDistance'] / len(target))

            BUFFER += 1

        # Skip current element if there is no match
        if result['locations'][0][0] is None:
            continue

        best_match_start: int = search_area_start + result['locations'][0][0]
        best_match_end: int = search_area_start + result['locations'][0][-1]

        # Skip note elements
        if xml_element.tag == NOTE_TAG:
            continue

        parse_words(session_pdf_content[best_match_start:best_match_end + 1], xml_element)

    # Save the updated XML content
    save_xml_tree(xml_tree, os.path.join(OUTPUT_FILE, os.path.basename(xml_path)))

    if VISUALIZE_COORDINATES_FROM_XML:
        print("parse_record(): Visualizing coordinates")
        visualize_xml(xml_root, xml_path, pdf_path)


def main() -> None:
    files_converted = 0

    xml_files = os.listdir(PATH_TO_XML_FILES)
    for i, xml_file in enumerate([xml_files[-1]]):

        xml_path = os.path.join(PATH_TO_XML_FILES, xml_file)

        if not xml_path.endswith('.tei.xml'):
            continue

        if MAX_FILES - files_converted == 0:
            break

        if files_converted < SKIP_FILES_TO:
            files_converted += 1
            continue

        print(f"Processing file: {xml_file}")

        pdf_path: str = get_associated_pdf(xml_path)

        time_start = time.time()

        parse_record(xml_path, pdf_path)

        time_end = time.time()

        print(f"Time taken: {time_end - time_start} seconds")

        files_converted += 1

        print(f"Progress: {files_converted}/{len(xml_files)}\n\n")


if __name__ == '__main__':
    main()
