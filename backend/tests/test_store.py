"""Unit tests for the TranscriptStore service."""

import json
import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.transcript import (
    Segment,
    SegmentUpdate,
    TranscriptData,
    TranscriptMetadata,
    TranscriptionStatus,
)
from services.store import TranscriptStore


@pytest.fixture
def storage_dir(tmp_path: Path) -> Path:
    """Provide a temporary storage directory."""
    return tmp_path / "transcripts"


@pytest.fixture
def store(storage_dir: Path) -> TranscriptStore:
    """Provide a TranscriptStore instance with a temp directory."""
    return TranscriptStore(storage_dir)


@pytest.fixture
def sample_transcript() -> TranscriptData:
    """Provide a sample TranscriptData object."""
    return TranscriptData(
        id="test-transcript-001",
        metadata=TranscriptMetadata(
            audio_file_name="interview.wav",
            audio_file_path="audio_files/test-transcript-001/interview.wav",
            transcription_date=datetime(2024, 1, 15, 10, 30, 0),
            total_duration_seconds=120.5,
            model_name="large-v2",
            device_used="mps",
            status=TranscriptionStatus.COMPLETED,
        ),
        segments=[
            Segment(
                index=0,
                start=0.0,
                end=4.5,
                speaker="SPEAKER_00",
                text="Hello, my name is John.",
                edited_text=None,
                pii_flagged=False,
            ),
            Segment(
                index=1,
                start=4.5,
                end=9.2,
                speaker="SPEAKER_01",
                text="Nice to meet you, John.",
                edited_text=None,
                pii_flagged=False,
            ),
            Segment(
                index=2,
                start=9.2,
                end=15.0,
                speaker="SPEAKER_00",
                text="My phone number is 555-1234.",
                edited_text=None,
                pii_flagged=True,
            ),
        ],
    )


class TestTranscriptStoreInit:
    """Tests for TranscriptStore initialization."""

    def test_creates_storage_directory(self, storage_dir: Path):
        """Storage directory is created on initialization."""
        assert not storage_dir.exists()
        TranscriptStore(storage_dir)
        assert storage_dir.exists()

    def test_handles_existing_directory(self, tmp_path: Path):
        """Does not fail if directory already exists."""
        existing = tmp_path / "existing"
        existing.mkdir()
        store = TranscriptStore(existing)
        assert store.storage_dir == existing

    def test_creates_nested_directories(self, tmp_path: Path):
        """Creates parent directories as needed."""
        nested = tmp_path / "a" / "b" / "c"
        TranscriptStore(nested)
        assert nested.exists()


class TestSaveAndLoad:
    """Tests for save and load operations."""

    def test_save_creates_json_file(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Save creates a JSON file named after the transcript ID."""
        store.save(sample_transcript)
        expected_path = store.storage_dir / "test-transcript-001.json"
        assert expected_path.exists()

    def test_load_returns_equivalent_transcript(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Load returns a TranscriptData equivalent to what was saved."""
        store.save(sample_transcript)
        loaded = store.load("test-transcript-001")
        assert loaded.model_dump() == sample_transcript.model_dump()

    def test_load_missing_transcript_raises_file_not_found(
        self, store: TranscriptStore
    ):
        """Load raises FileNotFoundError for non-existent transcript."""
        with pytest.raises(FileNotFoundError, match="not found"):
            store.load("nonexistent-id")

    def test_load_corrupt_json_raises_value_error(self, store: TranscriptStore):
        """Load raises ValueError for corrupt JSON files."""
        corrupt_path = store.storage_dir / "corrupt.json"
        corrupt_path.write_text("not valid json {{{")
        with pytest.raises(ValueError, match="Corrupt transcript file"):
            store.load("corrupt")

    def test_load_invalid_structure_raises_value_error(self, store: TranscriptStore):
        """Load raises ValueError for valid JSON with wrong structure."""
        invalid_path = store.storage_dir / "invalid.json"
        invalid_path.write_text(json.dumps({"foo": "bar"}))
        with pytest.raises(ValueError, match="Corrupt transcript file"):
            store.load("invalid")

    def test_save_preserves_pii_flags(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """PII flags are preserved through save/load cycle."""
        store.save(sample_transcript)
        loaded = store.load(sample_transcript.id)
        assert loaded.segments[2].pii_flagged is True
        assert loaded.segments[0].pii_flagged is False

    def test_save_preserves_edited_text(self, store: TranscriptStore):
        """Edited text is preserved through save/load cycle."""
        transcript = TranscriptData(
            id="edited-test",
            metadata=TranscriptMetadata(
                audio_file_name="test.wav",
                audio_file_path="audio_files/edited-test/test.wav",
                transcription_date=datetime(2024, 1, 15, 10, 0, 0),
                total_duration_seconds=10.0,
                model_name="large-v2",
                device_used="cpu",
                status=TranscriptionStatus.COMPLETED,
            ),
            segments=[
                Segment(
                    index=0,
                    start=0.0,
                    end=5.0,
                    speaker="SPEAKER_00",
                    text="Original text",
                    edited_text="Corrected text",
                    pii_flagged=False,
                ),
            ],
        )
        store.save(transcript)
        loaded = store.load("edited-test")
        assert loaded.segments[0].edited_text == "Corrected text"
        assert loaded.segments[0].text == "Original text"


class TestListAll:
    """Tests for list_all operation."""

    def test_empty_directory_returns_empty_list(self, store: TranscriptStore):
        """Returns empty list when no transcripts are stored."""
        result = store.list_all()
        assert result == []

    def test_returns_summaries_for_all_transcripts(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Returns a summary for each stored transcript."""
        store.save(sample_transcript)
        summaries = store.list_all()
        assert len(summaries) == 1
        assert summaries[0].id == "test-transcript-001"
        assert summaries[0].audio_file_name == "interview.wav"
        assert summaries[0].status == TranscriptionStatus.COMPLETED
        assert summaries[0].segment_count == 3
        assert summaries[0].pii_flagged_count == 1
        assert summaries[0].edited_count == 0

    def test_skips_corrupt_files(self, store: TranscriptStore, sample_transcript: TranscriptData):
        """Corrupt JSON files are skipped in listing."""
        store.save(sample_transcript)
        corrupt_path = store.storage_dir / "corrupt.json"
        corrupt_path.write_text("not valid json")
        summaries = store.list_all()
        assert len(summaries) == 1

    def test_counts_edited_segments(self, store: TranscriptStore):
        """Edited count reflects segments with non-null edited_text."""
        transcript = TranscriptData(
            id="count-test",
            metadata=TranscriptMetadata(
                audio_file_name="test.wav",
                audio_file_path="audio_files/count-test/test.wav",
                transcription_date=datetime(2024, 2, 1, 12, 0, 0),
                total_duration_seconds=30.0,
                model_name="large-v2",
                device_used="cpu",
                status=TranscriptionStatus.COMPLETED,
            ),
            segments=[
                Segment(index=0, start=0.0, end=5.0, speaker="SPEAKER_00", text="A", edited_text="B"),
                Segment(index=1, start=5.0, end=10.0, speaker="SPEAKER_00", text="C", edited_text=None),
                Segment(index=2, start=10.0, end=15.0, speaker="SPEAKER_01", text="D", edited_text="E"),
            ],
        )
        store.save(transcript)
        summaries = store.list_all()
        assert summaries[0].edited_count == 2


class TestUpdateSegment:
    """Tests for update_segment operation."""

    def test_updates_edited_text(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Updates edited_text for the specified segment."""
        store.save(sample_transcript)
        store.update_segment(
            "test-transcript-001", 0, SegmentUpdate(edited_text="Updated text")
        )
        loaded = store.load("test-transcript-001")
        assert loaded.segments[0].edited_text == "Updated text"

    def test_updates_pii_flag(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Updates pii_flagged for the specified segment."""
        store.save(sample_transcript)
        store.update_segment(
            "test-transcript-001", 0, SegmentUpdate(pii_flagged=True)
        )
        loaded = store.load("test-transcript-001")
        assert loaded.segments[0].pii_flagged is True

    def test_updates_both_fields(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Can update both edited_text and pii_flagged at once."""
        store.save(sample_transcript)
        store.update_segment(
            "test-transcript-001",
            1,
            SegmentUpdate(edited_text="New text", pii_flagged=True),
        )
        loaded = store.load("test-transcript-001")
        assert loaded.segments[1].edited_text == "New text"
        assert loaded.segments[1].pii_flagged is True

    def test_does_not_modify_other_segments(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Updating one segment does not affect others."""
        store.save(sample_transcript)
        store.update_segment(
            "test-transcript-001", 0, SegmentUpdate(edited_text="Changed")
        )
        loaded = store.load("test-transcript-001")
        assert loaded.segments[1].edited_text is None
        assert loaded.segments[2].pii_flagged is True

    def test_missing_transcript_raises_file_not_found(self, store: TranscriptStore):
        """Raises FileNotFoundError for non-existent transcript."""
        with pytest.raises(FileNotFoundError):
            store.update_segment("missing", 0, SegmentUpdate(pii_flagged=True))

    def test_invalid_segment_index_raises_index_error(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Raises IndexError for out-of-range segment index."""
        store.save(sample_transcript)
        with pytest.raises(IndexError, match="out of range"):
            store.update_segment(
                "test-transcript-001", 99, SegmentUpdate(pii_flagged=True)
            )

    def test_negative_segment_index_raises_index_error(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Raises IndexError for negative segment index."""
        store.save(sample_transcript)
        with pytest.raises(IndexError, match="out of range"):
            store.update_segment(
                "test-transcript-001", -1, SegmentUpdate(pii_flagged=True)
            )

    def test_none_fields_are_not_applied(
        self, store: TranscriptStore, sample_transcript: TranscriptData
    ):
        """Fields set to None in SegmentUpdate are not applied."""
        store.save(sample_transcript)
        # Segment 2 already has pii_flagged=True
        store.update_segment(
            "test-transcript-001", 2, SegmentUpdate(edited_text="Redacted")
        )
        loaded = store.load("test-transcript-001")
        # pii_flagged should remain True since we didn't update it
        assert loaded.segments[2].pii_flagged is True
        assert loaded.segments[2].edited_text == "Redacted"
