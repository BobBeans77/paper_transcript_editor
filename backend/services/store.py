"""Transcript store service for persisting and retrieving transcript JSON files."""

import json
from pathlib import Path

from models.transcript import (
    Segment,
    SegmentUpdate,
    TranscriptData,
    TranscriptSummary,
    TranscriptionStatus,
)


class TranscriptStore:
    """Filesystem-based store for transcript data as JSON files."""

    def __init__(self, storage_dir: Path):
        """Initialize with base storage directory. Creates directory if it doesn't exist."""
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save(self, transcript: TranscriptData) -> None:
        """Persist transcript as JSON file named {transcript_id}.json."""
        file_path = self.storage_dir / f"{transcript.id}.json"
        data = transcript.model_dump(mode="json")
        file_path.write_text(json.dumps(data, indent=2, default=str))

    def load(self, transcript_id: str) -> TranscriptData:
        """Load transcript from JSON file.

        Raises:
            FileNotFoundError: If the transcript file does not exist.
            ValueError: If the JSON file is corrupt or cannot be parsed.
        """
        file_path = self.storage_dir / f"{transcript_id}.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Transcript {transcript_id} not found")
        try:
            raw = file_path.read_text()
            data = json.loads(raw)
            return TranscriptData.model_validate(data)
        except json.JSONDecodeError as e:
            raise ValueError(f"Corrupt transcript file: {e}")
        except Exception as e:
            raise ValueError(f"Corrupt transcript file: {e}")

    def list_all(self) -> list[TranscriptSummary]:
        """List all stored transcripts with summary info.

        Scans the storage directory for .json files and returns a
        TranscriptSummary for each valid transcript.
        """
        summaries: list[TranscriptSummary] = []
        for file_path in sorted(self.storage_dir.glob("*.json")):
            try:
                raw = file_path.read_text()
                data = json.loads(raw)
                transcript = TranscriptData.model_validate(data)
                summary = TranscriptSummary(
                    id=transcript.id,
                    audio_file_name=transcript.metadata.audio_file_name,
                    transcription_date=transcript.metadata.transcription_date,
                    status=transcript.metadata.status,
                    segment_count=len(transcript.segments),
                    pii_flagged_count=sum(
                        1 for s in transcript.segments if s.pii_flagged
                    ),
                    edited_count=sum(
                        1 for s in transcript.segments if s.edited_text is not None
                    ),
                )
                summaries.append(summary)
            except (json.JSONDecodeError, Exception):
                # Skip corrupt files in listing
                continue
        return summaries

    def delete(self, transcript_id: str) -> None:
        """Delete a transcript JSON file and its associated audio files.

        Raises:
            FileNotFoundError: If the transcript file does not exist.
        """
        file_path = self.storage_dir / f"{transcript_id}.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Transcript {transcript_id} not found")

        # Load transcript to get audio file path for cleanup
        try:
            transcript = self.load(transcript_id)
            audio_path = Path(transcript.metadata.audio_file_path)
            # Delete the audio file and its parent directory (transcript_id folder)
            if audio_path.exists():
                audio_path.unlink()
            audio_dir = audio_path.parent
            if audio_dir.exists() and audio_dir != audio_path:
                import shutil
                shutil.rmtree(audio_dir, ignore_errors=True)
        except (ValueError, Exception):
            # If we can't parse the transcript, still delete the JSON file
            pass

        file_path.unlink()

    def update_segment(
        self, transcript_id: str, segment_index: int, updates: SegmentUpdate
    ) -> None:
        """Update a specific segment's editable fields (edited_text, pii_flagged).

        Raises:
            FileNotFoundError: If the transcript file does not exist.
            IndexError: If the segment_index is out of range.
            ValueError: If the transcript file is corrupt.
        """
        transcript = self.load(transcript_id)

        if segment_index < 0 or segment_index >= len(transcript.segments):
            raise IndexError(
                f"Segment index {segment_index} out of range"
            )

        segment = transcript.segments[segment_index]

        if updates.edited_text is not None:
            segment.edited_text = updates.edited_text
        if updates.pii_flagged is not None:
            segment.pii_flagged = updates.pii_flagged
        if updates.speaker_override is not None:
            segment.speaker_override = updates.speaker_override
        if updates.excluded is not None:
            segment.excluded = updates.excluded

        self.save(transcript)
