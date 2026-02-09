import re
import shutil
from pathlib import Path


def rename_files(source, destination, corpus):
    print(f"Renaming {corpus} files in directory: {source}")
    src = Path(source)
    dst = Path(destination)

    for path in src.rglob('*'):
        if not path.is_file():
            continue
        if path.suffix.lower() not in ('.pdf'):
            continue

        try:
            base_name = path.stem  # file name without extension
            if corpus == 'dzk':
                new_file_name = generate_dzk_file(base_name)
            elif corpus == 'yuparl':
                new_file_name = generate_yuparl_file(base_name)
            else:
                raise NotImplementedError(f"Renaming for corpus '{corpus}' is not implemented.")
        except ValueError as e:
            print(f"❌ Error occurred while renaming file '{path}':", e)
            continue
        except NotImplementedError as e:
            print(f"❌ {e}")
            return

        new_path = dst / f"{new_file_name}{path.suffix}"
        try:
            shutil.copy2(path, new_path)
        except Exception as e:
            print(f"❌ Error occurred while copying file '{path}' to '{new_path}':", e)
            continue

        print(f"✅ Renamed '{path}' to '{new_path.name}'")


def generate_dzk_file(old_name):
    old_name_format = r'DezelniZborKranjski(-\d{8})(-\d{1,2})(p(\d+))?(-\d{1,2})?'
    match = re.match(old_name_format, old_name)
    if not match:
        raise ValueError(f"File name '{old_name}' does not match expected format for dzk.")

    # date
    date = old_name.split("-")[1]
    year = date[:4]
    month = date[4:6]
    day = date[6:]

    # volume
    volume = str(old_name.split("-")[2]).replace("p", "-")
    # and number
    number = str(old_name.split("-")[3]).replace("p", "-")

    # rename file
    new_file_name = f"DZK_{year}-{month}-{day}_{volume}_{number}"
    return new_file_name


def generate_yuparl_file(old_name):
    old_name_format = r'(\d{8,10})-(\w+)-(\d{1,})?(\w+(\d+))?'
    match = re.match(old_name_format, old_name)
    if not match:
        raise ValueError(f"File name '{old_name}' does not match expected format for yuparl.")

    session_type_dict = {
        "PrivremenoNarodnoPredstavnistvo": "PP",
        "NarodnoPretstavnistvo": "NP",
        "ZakonodajniOdbor": "ZO",
        "Senat": "SE",
        "NarodnaSkupstina": "NS",
    }

    date_part, session_type_part, number_part = old_name.split("-")


    year = date_part[:4]
    month = date_part[4:6]
    day = date_part[6:8]
    date = f"{year}-{month}-{day}"

    if len(date_part) == 10:
        day2 = date_part[8:10]
        date = f"{year}-{month}-{day}-{day2}"

    session_type = session_type_dict.get(session_type_part)
    if session_type is None:
        raise ValueError(f"Session type '{session_type_part}' is not recognized.")


    number = number_part
    if number_part == "prethodna":
        number = "prethodna"
    elif "prethodna" in number_part:
        number = number_part.replace("prethodna", "prethodna-")
    elif "p" in number_part:
        number = number_part.replace("p", "-")


    return f"yu1Parl_{date}_{session_type}_{number}"
