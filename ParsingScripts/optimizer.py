import os
import subprocess


def optimize_pdf(input_file, output_file, quality='ebook', ghostscript_path='gs'):
    quality_settings = {
        'screen': '/screen',     # lowest quality
        'ebook': '/ebook',       # good quality
        'printer': '/printer',   # high quality
        'prepress': '/prepress'  # highest quality
    }

    temp_output = output_file + ".tmp.pdf"

    # Ghostscript for compression and font embedding
    gs_command = [
        ghostscript_path,  # Ghostscript command; ensure it's in your PATH
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',

        # Quality preset (good balance for scans)
        f'-dPDFSETTINGS={quality_settings.get(quality, "/ebook")}',

        # Fast web viewing (linearized PDF)
        '-dFastWebView=true',

        # Fonts
        '-dEmbedAllFonts=true',
        '-dSubsetFonts=true',

        # Force predictable, PDF.js-friendly encodings
        "-dAutoFilterColorImages=false",
        "-dAutoFilterGrayImages=false",
        "-dAutoFilterMonoImages=false",
        '-dColorImageFilter=/DCTEncode',
        '-dGrayImageFilter=/DCTEncode',
        '-dMonoImageFilter=/CCITTFaxEncode',

        # Normalize resolution (CRUCIAL for speed)
        "-dDownsampleColorImages=true",
        "-dColorImageResolution=150",

        "-dDownsampleGrayImages=true",
        "-dGrayImageResolution=150",

        "-dDownsampleMonoImages=true",
        "-dMonoImageResolution=300",

        # General flags
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',

        f'-sOutputFile={temp_output}',
        input_file
    ]

    print("🔧 Compressing and embedding fonts...")
    try:
        subprocess.run(gs_command, check=True)
    except subprocess.CalledProcessError as e:
        print("❌ Ghostscript compression failed:", e)
        return

    # qpdf for linearization (fast web view)
    qpdf_command = [
        'qpdf',
        '--linearize',
        temp_output,
        output_file
    ]

    print("📦 Linearizing PDF for fast web view...")
    try:
        subprocess.run(qpdf_command, check=True)
        print(f"✅ Optimization successful: {output_file}")
    except subprocess.CalledProcessError as e:
        print("❌ Linearization failed:", e)
    finally:
        # Clean up temporary file
        if os.path.exists(temp_output):
            os.remove(temp_output)


def optimize_pdfs(input_dir, output_dir, quality="ebook", ghostscript_path='gs', from_index=0, to_index=-1):
    print("Optimizing PDF files in directory:", input_dir)

    for i, file in enumerate(os.listdir(input_dir)):

        if i < from_index:
            continue

        if to_index != -1 and i >= to_index:
            break

        if not file.lower().endswith(".pdf"):
            continue

        path = os.path.join(input_dir, file)

        optimized_file_path = os.path.join(output_dir, file)
        optimize_pdf(path, optimized_file_path, quality=quality, ghostscript_path=ghostscript_path)