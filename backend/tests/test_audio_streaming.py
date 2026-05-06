"""Tests for audio streaming endpoint."""

from datetime import datetime, timezone
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from models.transcript import (
    Segment,
    TranscriptData,
    TranscriptMetadata,
    TranscriptionStatus,
)
from services.store import TranscriptStore


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def audio_file(tmp_path):
    """Create a fake audio file for testing."""
    audio_dir = tmp_path / "audio_files" / "test-audio-001"
    audio_dir.mkdir(parents=True)
    audio_path = audio_dir / "test.wav"
    # Write 1024 bytes of fake audio data
    audio_path.write_bytes(b"\x00" * 1024)
    return audio_path


@pytest.fixture
def sample_transcript_with_audio(audio_file):
    """Create a transcript that references the audio file."""
    return TranscriptData(
        id="test-audio-001",
        metadata=TranscriptMetadata(
            audio_file_name="test.wav",
            audio_file_path=str(audio_file),
            transcription_date=datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
            total_duration_seconds=60.0,
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
                text="Hello world.",
            ),
        ],
    )


@pytest.fixture
def sample_transcript_missing_audio(tmp_path):
    """Create a transcript that references a non-existent audio file."""
    return TranscriptData(
        id="test-audio-002",
        metadata=TranscriptMetadata(
            audio_file_name="missing.wav",
            audio_file_path=str(tmp_path / "nonexistent" / "missing.wav"),
            transcription_date=datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
            total_duration_seconds=60.0,
            model_name="large-v2",
            device_used="cpu",
            status=TranscriptionStatus.COMPLETED,
        ),
        segments=[],
    )


@pytest.fixture
def store_with_audio(tmp_path, monkeypatch, sample_transcript_with_audio):
    """Set up a store with a transcript that has an audio file."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    test_store.save(sample_transcript_with_audio)
    monkeypatch.setattr("api.routes.store", test_store)
    return test_store


@pytest.fixture
def store_with_missing_audio(
    tmp_path, monkeypatch, sample_transcript_with_audio, sample_transcript_missing_audio
):
    """Set up a store with a transcript whose audio file is missing."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    test_store.save(sample_transcript_missing_audio)
    monkeypatch.setattr("api.routes.store", test_store)
    return test_store


# --- GET /api/transcripts/{id}/audio ---


@pytest.mark.asyncio
async def test_stream_audio_full_file(client, store_with_audio):
    """Test streaming full audio file returns 200 with correct headers."""
    response = await client.get("/api/transcripts/test-audio-001/audio")
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["content-length"] == "1024"
    assert len(response.content) == 1024


@pytest.mark.asyncio
async def test_stream_audio_range_request(client, store_with_audio):
    """Test range request returns 206 with partial content."""
    response = await client.get(
        "/api/transcripts/test-audio-001/audio",
        headers={"Range": "bytes=0-511"},
    )
    assert response.status_code == 206
    assert response.headers["content-range"] == "bytes 0-511/1024"
    assert response.headers["content-length"] == "512"
    assert len(response.content) == 512


@pytest.mark.asyncio
async def test_stream_audio_range_request_middle(client, store_with_audio):
    """Test range request for middle of file."""
    response = await client.get(
        "/api/transcripts/test-audio-001/audio",
        headers={"Range": "bytes=256-767"},
    )
    assert response.status_code == 206
    assert response.headers["content-range"] == "bytes 256-767/1024"
    assert response.headers["content-length"] == "512"
    assert len(response.content) == 512


@pytest.mark.asyncio
async def test_stream_audio_range_request_to_end(client, store_with_audio):
    """Test range request from offset to end of file."""
    response = await client.get(
        "/api/transcripts/test-audio-001/audio",
        headers={"Range": "bytes=512-"},
    )
    assert response.status_code == 206
    assert response.headers["content-range"] == "bytes 512-1023/1024"
    assert response.headers["content-length"] == "512"
    assert len(response.content) == 512


@pytest.mark.asyncio
async def test_stream_audio_transcript_not_found(client, tmp_path, monkeypatch):
    """Test streaming audio for non-existent transcript returns 404."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    monkeypatch.setattr("api.routes.store", test_store)

    response = await client.get("/api/transcripts/nonexistent-id/audio")
    assert response.status_code == 404
    assert response.json()["detail"] == "Transcript nonexistent-id not found"


@pytest.mark.asyncio
async def test_stream_audio_file_missing_from_disk(client, store_with_missing_audio):
    """Test streaming audio when file is missing from disk returns 404."""
    response = await client.get("/api/transcripts/test-audio-002/audio")
    assert response.status_code == 404
    assert (
        response.json()["detail"]
        == "Audio file not found for transcript test-audio-002"
    )


@pytest.mark.asyncio
async def test_stream_audio_mp3_content_type(client, tmp_path, monkeypatch):
    """Test that MP3 files get correct content-type header."""
    audio_dir = tmp_path / "audio_files" / "test-mp3"
    audio_dir.mkdir(parents=True)
    audio_path = audio_dir / "test.mp3"
    audio_path.write_bytes(b"\xff\xfb\x90\x00" * 256)

    transcript = TranscriptData(
        id="test-mp3",
        metadata=TranscriptMetadata(
            audio_file_name="test.mp3",
            audio_file_path=str(audio_path),
            transcription_date=datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
            total_duration_seconds=30.0,
            model_name="large-v2",
            device_used="cpu",
            status=TranscriptionStatus.COMPLETED,
        ),
        segments=[],
    )

    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    test_store.save(transcript)
    monkeypatch.setattr("api.routes.store", test_store)

    response = await client.get("/api/transcripts/test-mp3/audio")
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"


@pytest.mark.asyncio
async def test_stream_audio_range_out_of_bounds(client, store_with_audio):
    """Test range request beyond file size returns 416."""
    response = await client.get(
        "/api/transcripts/test-audio-001/audio",
        headers={"Range": "bytes=2000-3000"},
    )
    assert response.status_code == 416
