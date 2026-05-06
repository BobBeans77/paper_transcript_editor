"""Tests for transcript CRUD endpoints."""

import json
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from main import app
from models.transcript import (
    Segment,
    SegmentUpdate,
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
def sample_transcript():
    """Create a sample transcript for testing."""
    return TranscriptData(
        id="test-transcript-001",
        metadata=TranscriptMetadata(
            audio_file_name="interview.wav",
            audio_file_path="audio_files/test-transcript-001/interview.wav",
            transcription_date=datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
            total_duration_seconds=120.5,
            model_name="large-v2",
            device_used="cpu",
            status=TranscriptionStatus.COMPLETED,
        ),
        segments=[
            Segment(
                index=0,
                start=0.0,
                end=4.5,
                speaker="SPEAKER_00",
                text="Hello, how are you?",
                edited_text=None,
                pii_flagged=False,
            ),
            Segment(
                index=1,
                start=4.5,
                end=8.2,
                speaker="SPEAKER_01",
                text="I'm doing well, thanks.",
                edited_text=None,
                pii_flagged=False,
            ),
            Segment(
                index=2,
                start=8.2,
                end=12.0,
                speaker="SPEAKER_00",
                text="My name is John Smith.",
                edited_text=None,
                pii_flagged=True,
            ),
        ],
    )


@pytest.fixture
def store_with_transcript(tmp_path, monkeypatch, sample_transcript):
    """Set up a store with a sample transcript."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    test_store.save(sample_transcript)
    monkeypatch.setattr("api.routes.store", test_store)
    return test_store


# --- GET /api/transcripts ---


@pytest.mark.asyncio
async def test_list_transcripts_empty(client, tmp_path, monkeypatch):
    """Test listing transcripts when none exist returns empty list."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    monkeypatch.setattr("api.routes.store", test_store)

    response = await client.get("/api/transcripts")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_transcripts_with_data(client, store_with_transcript, sample_transcript):
    """Test listing transcripts returns correct summaries."""
    response = await client.get("/api/transcripts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    summary = data[0]
    assert summary["id"] == "test-transcript-001"
    assert summary["audio_file_name"] == "interview.wav"
    assert summary["status"] == "completed"
    assert summary["segment_count"] == 3
    assert summary["pii_flagged_count"] == 1
    assert summary["edited_count"] == 0


# --- GET /api/transcripts/{id} ---


@pytest.mark.asyncio
async def test_get_transcript_success(client, store_with_transcript, sample_transcript):
    """Test getting a transcript by ID returns full data."""
    response = await client.get("/api/transcripts/test-transcript-001")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-transcript-001"
    assert data["metadata"]["audio_file_name"] == "interview.wav"
    assert len(data["segments"]) == 3
    assert data["segments"][0]["text"] == "Hello, how are you?"
    assert data["segments"][2]["pii_flagged"] is True


@pytest.mark.asyncio
async def test_get_transcript_not_found(client, tmp_path, monkeypatch):
    """Test getting a non-existent transcript returns 404."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    monkeypatch.setattr("api.routes.store", test_store)

    response = await client.get("/api/transcripts/nonexistent-id")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Transcript nonexistent-id not found"


# --- GET /api/transcripts/{id}/status ---


@pytest.mark.asyncio
async def test_get_transcript_status_completed(client, store_with_transcript):
    """Test getting status of a completed transcript."""
    response = await client.get("/api/transcripts/test-transcript-001/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_get_transcript_status_not_found(client, tmp_path, monkeypatch):
    """Test getting status of a non-existent transcript returns 404."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    monkeypatch.setattr("api.routes.store", test_store)

    response = await client.get("/api/transcripts/nonexistent-id/status")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Transcript nonexistent-id not found"


# --- PUT /api/transcripts/{id} ---


@pytest.mark.asyncio
async def test_update_transcript_edit_text(client, store_with_transcript):
    """Test updating a segment's edited_text."""
    response = await client.put(
        "/api/transcripts/test-transcript-001",
        json={
            "segment_index": 0,
            "updates": {"edited_text": "Hi, how are you?"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["segments"][0]["edited_text"] == "Hi, how are you?"
    assert data["segments"][0]["text"] == "Hello, how are you?"


@pytest.mark.asyncio
async def test_update_transcript_pii_flag(client, store_with_transcript):
    """Test updating a segment's pii_flagged value."""
    response = await client.put(
        "/api/transcripts/test-transcript-001",
        json={
            "segment_index": 1,
            "updates": {"pii_flagged": True},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["segments"][1]["pii_flagged"] is True


@pytest.mark.asyncio
async def test_update_transcript_not_found(client, tmp_path, monkeypatch):
    """Test updating a non-existent transcript returns 404."""
    test_store = TranscriptStore(storage_dir=tmp_path / "transcripts")
    monkeypatch.setattr("api.routes.store", test_store)

    response = await client.put(
        "/api/transcripts/nonexistent-id",
        json={
            "segment_index": 0,
            "updates": {"edited_text": "test"},
        },
    )
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Transcript nonexistent-id not found"


@pytest.mark.asyncio
async def test_update_transcript_invalid_segment_index(client, store_with_transcript):
    """Test updating with an out-of-range segment index returns 400."""
    response = await client.put(
        "/api/transcripts/test-transcript-001",
        json={
            "segment_index": 99,
            "updates": {"edited_text": "test"},
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "Segment index 99 out of range"


@pytest.mark.asyncio
async def test_update_transcript_negative_segment_index(client, store_with_transcript):
    """Test updating with a negative segment index returns 400."""
    response = await client.put(
        "/api/transcripts/test-transcript-001",
        json={
            "segment_index": -1,
            "updates": {"pii_flagged": True},
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "Segment index -1 out of range"
