"""Export transcripts and audio files with user-friendly names.

Copies transcript JSON and corresponding WAV files to an export directory
using the naming convention: <accent>_<number>.json / <accent>_<number>.wav

Transcripts without an accent tag are exported as Unknown_<number>.

Usage:
    python export_transcripts.py [--output-dir export]
"""

import argparse
import json
import shutil
from collections import defaultdict
from pathlib import Path


TRANSCRIPTS_DIR = Path("transcripts")
EXPORT_DIR = Path("export")


def load_transcripts(transcripts_dir: Path) -> list[dict]:
    """Load all transcript JSON files from the given directory."""
    transcripts = []
    for file_path in sorted(transcripts_dir.glob("*.json")):
        try:
            data = json.loads(file_path.read_text(encoding="utf-8"))
            transcripts.append(data)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Skipping {file_path.name}: {e}")
    return transcripts


def export(transcripts_dir: Path, output_dir: Path) -> None:
    """Export transcripts and audio with friendly filenames."""
    output_dir.mkdir(parents=True, exist_ok=True)

    transcripts = load_transcripts(transcripts_dir)
    if not transcripts:
        print("No transcripts found.")
        return

    # Group by accent to assign sequential numbers
    accent_counters: dict[str, int] = defaultdict(int)

    for transcript in transcripts:
        metadata = transcript.get("metadata", {})
        accent = metadata.get("accent") or "Unknown"
        accent_counters[accent] += 1
        number = accent_counters[accent]

        friendly_base = f"{accent}_{number}"

        # Export JSON
        export_json_path = output_dir / f"{friendly_base}.json"
        export_json_path.write_text(
            json.dumps(transcript, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"  {export_json_path.name}")

        # Export audio file
        audio_file_path = metadata.get("audio_file_path", "")
        if audio_file_path:
            source_audio = Path(audio_file_path)
            if not source_audio.is_absolute():
                # Paths are relative to the backend directory
                source_audio = transcripts_dir.parent / source_audio

            if source_audio.exists():
                extension = source_audio.suffix  # e.g. .wav
                export_audio_path = output_dir / f"{friendly_base}{extension}"
                shutil.copy2(source_audio, export_audio_path)
                print(f"  {export_audio_path.name}")
            else:
                print(f"  WARNING: Audio file not found: {source_audio}")
        else:
            print(f"  WARNING: No audio path in transcript {transcript.get('id')}")

    print(f"\nExported {sum(accent_counters.values())} transcripts to {output_dir}/")
    print("Breakdown by accent:")
    for accent, count in sorted(accent_counters.items()):
        print(f"  {accent}: {count}")


def main():
    parser = argparse.ArgumentParser(
        description="Export transcripts with friendly filenames (<accent>_<number>)"
    )
    parser.add_argument(
        "--transcripts-dir",
        type=Path,
        default=TRANSCRIPTS_DIR,
        help="Directory containing transcript JSON files (default: transcripts)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=EXPORT_DIR,
        help="Output directory for exported files (default: export)",
    )
    args = parser.parse_args()

    print(f"Exporting from {args.transcripts_dir} to {args.output_dir}...\n")
    export(args.transcripts_dir, args.output_dir)


if __name__ == "__main__":
    main()
