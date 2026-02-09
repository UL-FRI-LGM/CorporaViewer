import os

import fitz


def create_thumbnails(source, destination, force_create=False):
    print(f"Creating thumbnails for files in directory:", source)

    for file in os.listdir(source):
        if not file.lower().endswith(".pdf"):
            continue

        pdf_filepath = os.path.join(source, file)
        png_filepath = os.path.join(destination, f"{file[:-4]}.png")

        if os.path.exists(png_filepath) and not force_create:
            print(f"⚠️  Thumbnail already exists for '{file}', skipping.")
            continue

        # get first page of pdf
        pdf_document = fitz.open(pdf_filepath)
        first_page = pdf_document[0]

        # generate thumbnail
        image = first_page.get_pixmap()
        image.save(png_filepath)  # Save as PNG

        print(f"✅ Created thumbnail for '{file}'")