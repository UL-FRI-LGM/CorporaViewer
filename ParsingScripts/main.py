import argparse

import optimizer
#import parser_dzk
#import parser_yuparl
import renamer
import thumbnailer
import uploader


def main():
    parser = argparse.ArgumentParser(
        prog='ParlaVis Data Preparation Tool',
        description='This program is used to prepare JSON, PDF and thumbnails data for ParlaVis.'
    )

    subparsers = parser.add_subparsers(dest='command', required=True, help='Subcommand to run')

    # -------------------------------
    # Subcommand: rename
    # -------------------------------
    rename_parser = subparsers.add_parser('rename', help='Rename files according to ParlaVis convention')
    rename_parser.add_argument(
        '-c', '--corpus',
        type=str,
        required=True,
        help='Corpus to prepare (e.g., dzk, yuparl, ...)',
        choices=['dzk', 'yuparl']  # Add other corpora here
    )
    rename_parser.add_argument(
        '-s', '--source',
        type=str,
        required=True,
        help='Source directory containing raw data'
    )
    rename_parser.add_argument(
        '-d', '--destination',
        type=str,
        required=True,
        help='Destination directory for renamed data'
    )

    # -------------------------------
    # Subcommand: thumbnail
    # -------------------------------
    thumb_parser = subparsers.add_parser(
        'thumbnail',
        help='Generate thumbnails for the first page of each PDF and save them under the same name with .png extension'
    )
    thumb_parser.add_argument(
        '-s', '--source',
        type=str,
        required=True,
        help='Source directory containing PDF files'
    )
    thumb_parser.add_argument(
        '-d', '--destination',
        type=str,
        required=True,
        help='Destination directory for thumbnails'
    )
    thumb_parser.add_argument(
        '-f', '--force-create',
        type=bool,
        required=False,
        default=False,
        help='Force creation of thumbnails even if they already exist'
    )

    # -------------------------------
    # Subcommand: optimize
    # -------------------------------
    optimize_parser = subparsers.add_parser('optimize', help='Optimize PDF files for web use')
    optimize_parser.add_argument(
        '-s', '--source',
        type=str,
        required=True,
        help='Source directory containing PDF files'
    )
    optimize_parser.add_argument(
        '-d', '--destination',
        type=str,
        required=True,
        help='Destination directory for optimized PDFs'
    )
    optimize_parser.add_argument(
        '-q', '--quality',
        type=str,
        required=False,
        help='Quality of optimized PDFs (screen, ebook, printer, prepress)',
        default='ebook',
        choices=['screen', 'ebook', 'printer', 'prepress']
    )
    optimize_parser.add_argument(
        "-g", "--ghostscript-path",
        type=str,
        required=False,
        help="Path to the Ghostscript executable (if not in system PATH)",
        default="gs"
    )
    optimize_parser.add_argument(
        '-f', '--from-index',
        type=int,
        required=False,
        help='Starting index for optimizing files',
        default=0
    )
    optimize_parser.add_argument(
        '-t', '--to-index',
        type=int,
        required=False,
        help='Ending index for optimizing files',
        default=-1
    )

    # -------------------------------
    # Subcommand: parse
    # -------------------------------
    parse_parser = subparsers.add_parser('parse', help='Generates JSON file from XML files')
    parse_parser.add_argument(
        '-c', '--corpus',
        type=str,
        required=True,
        help='Corpus to prepare (e.g., dzk, yuparl, ...)',
        choices=['dzk', 'yuparl']  # Add other corpora here
    )
    parse_parser.add_argument(
        '-s', '--source',
        type=str,
        required=True,
        help='Source directory containing XML files'
    )
    parse_parser.add_argument(
        '-d', '--destination',
        type=str,
        required=True,
        help='Destination directory for JSON files'
    )
    parse_parser.add_argument(
        '-f', '--from-index',
        type=int,
        required=False,
        help='Starting index for parsing files',
        default=0
    )
    parse_parser.add_argument(
        '-t', '--to-index',
        type=int,
        required=False,
        help='Ending index for parsing files',
        default=-1
    )

    # -------------------------------
    # Subcommand: upload
    # -------------------------------
    upload_parser = subparsers.add_parser('upload', help='Upload JSON data to elasticsearch')
    upload_parser.add_argument(
        '-s', '--source',
        type=str,
        required=True,
        help='Source directory containing JSON files'
    )
    upload_parser.add_argument(
        '-e', '--elasticsearch-host',
        type=str,
        default='localhost',
        help='Elasticsearch host URL'
    )
    upload_parser.add_argument(
        '-p', '--elasticsearch-port',
        type=int,
        default=9200,
        help='Elasticsearch port number'
    )
    upload_parser.add_argument(
        '-d', '--delete-index',
        type=bool,
        required=False,
        help='Whether to delete existing indexes before upload',
        default=False
    )


    args = parser.parse_args()

    # Execute the appropriate function based on the subcommand
    if args.command == 'rename':
        renamer.rename_files(args.source, args.destination, args.corpus)
    elif args.command == 'thumbnail':
        thumbnailer.create_thumbnails(args.source, args.destination, force_create=args.force_create)
    elif args.command == 'optimize':
        optimizer.optimize_pdfs(
            args.source,
            args.destination,
            quality=args.quality,
            ghostscript_path=args.ghostscript_path,
            from_index=args.from_index,
            to_index=args.to_index
        )
    elif args.command == 'parse':
        if args.corpus == 'dzk':
            ...
            # parser_dzk.parse(args.source, args.destination, args.from_index, args.to_index)
        elif args.corpus == 'yuparl':
            ...
            # parser_yuparl.parse(args.source, args.destination, args.from_index, args.to_index)
        else:
            raise NotImplementedError(f"Parsing for corpus '{args.corpus}' is not implemented.")
    elif args.command == 'upload':
        uploader.upload(
            args.source,
            args.elasticsearch_host,
            args.elasticsearch_port,
            delete_index_if_exists=args.delete_index
        )
    else:
        raise NotImplementedError(f"Command '{args.command}' is not implemented.")


if __name__ == '__main__':
    main()