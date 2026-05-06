"""Tests for the upload endpoint."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
@patch("api.routes._run_transcription", new_callable=AsyncMock)
async def test_upload_valid_wav(mock_transcribe, client, tmp_path, monkeypatch):
    """Test uploading a valid WAV file returns 202 with transcript_id."""
    monkeypatch.setattr("api.routes.AUDIO_FILES_DIR", tmp_path / "audio")
    monkeypatch.setattr("api.routes.TRANSCRIPTS_DIR", tmp_path / "transcripts")
    from services.store import TranscriptStore
    monkeypatch.setattr("api.routes.store", TranscriptStore(tmp_path / "transcripts"))

    file_content = b"fake audio content"
    response = await client.post(
        "/api/upload",
        files={"file": ("test.wav", file_content, "audio/wav")},
    )
    assert response.status_code == 202
    data = response.json()
    assert "transcript_id" in data
    assert data["status"] == "pending"


@pytest.mark.asyncio
@patch("api.routes._run_transcription", new_callable=AsyncMock)
async def test_upload_valid_mp3(mock_transcribe, client, tmp_path, monkeypatch):
    """Test uploading a valid MP3 file returns 202."""
    monkeypatch.setattr("api.routes.AUDIO_FILES_DIR", tmp_path / "audio")
    monkeypatch.setattr("api.routes.TRANSCRIPTS_DIR", tmp_path / "transcripts")
    from services.store import TranscriptStore
    monkeypatch.setattr("api.routes.store", TranscriptStore(tmp_path / "transcripts"))

    file_content = b"fake mp3 content"
    response = await client.post(
        "/api/upload",
        files={"file": ("recording.mp3", file_content, "audio/mpeg")},
    )
    assert response.status_code == 202


@pytest.mark.asyncio
@patch("api.routes._run_transcription", new_callable=AsyncMock)
async def test_upload_valid_flac(mock_transcribe, client, tmp_path, monkeypatch):
    """Test uploading a valid FLAC file returns 202."""
    monkeypatch.setattr("api.routes.AUDIO_FILES_DIR", tmp_path / "audio")
    monkeypatch.setattr("api.routes.TRANSCRIPTS_DIR", tmp_path / "transcripts")
    from services.store import TranscriptStore
    monkeypatch.setattr("api.routes.store", TranscriptStore(tmp_path / "transcripts"))

    file_content = b"fake flac content"
    response = await client.post(
        "/api/upload",
        files={"file": ("audio.flac", file_content, "audio/flac")},
    )
    assert response.status_code == 202


@pytest.mark.asyncio
@patch("api.routes._run_transcription", new_callable=AsyncMock)
async def test_upload_valid_m4a(mock_transcribe, client, tmp_path, monkeypatch):
    """Test uploading a valid M4A file returns 202."""
    monkeypatch.setattr("api.routes.AUDIO_FILES_DIR", tmp_path / "audio")
    monkeypatch.setattr("api.routes.TRANSCRIPTS_DIR", tmp_path / "transcripts")
    from services.store import TranscriptStore
    monkeypatch.setattr("api.routes.store", TranscriptStore(tmp_path / "transcripts"))

    file_content = b"fake m4a content"
    response = await client.post(
        "/api/upload",
        files={"file": ("audio.m4a", file_content, "audio/mp4")},
    )
    assert response.status_code == 202


@pytest.mark.asyncio
async def test_upload_unsupported_format(client):
    """Test uploading an unsupported format returns 400 with error message."""
    file_content = b"fake content"
    response = await client.post(
        "/api/upload",
        files={"file": ("document.pdf", file_content, "application/pdf")},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == "Unsupported format. Supported: WAV, MP3, FLAC, M4A"


@pytest.mark.asyncio
async def test_upload_unsupported_format_txt(client):
    """Test uploading a .txt file returns 400."""
    file_content = b"text content"
    response = await client.post(
        "/api/upload",
        files={"file": ("notes.txt", file_content, "text/plain")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_upload_no_extension(client):
    """Test uploading a file with no extension returns 400."""
    file_content = b"some content"
    response = await client.post(
        "/api/upload",
        files={"file": ("noextension", file_content, "application/octet-stream")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_upload_file_too_large(client, monkeypatch):
    """Test uploading a file exceeding max size returns 413."""
    # Set max size to 1MB for testing
    monkeypatch.setattr("api.routes.MAX_FILE_SIZE_MB", 1)
    monkeypatch.setattr("api.routes.MAX_FILE_SIZE_BYTES", 1 * 1024 * 1024)

    # Create content larger than 1MB
    file_content = b"x" * (1 * 1024 * 1024 + 1)
    response = await client.post(
        "/api/upload",
        files={"file": ("large.wav", file_content, "audio/wav")},
    )
    assert response.status_code == 413
    data = response.json()
    assert "File exceeds maximum size of 1MB" in data["detail"]


@pytest.mark.asyncio
@patch("api.routes._run_transcription", new_callable=AsyncMock)
async def test_upload_saves_file(mock_transcribe, client, tmp_path, monkeypatch):
    """Test that uploaded file is saved to the correct directory."""
    audio_dir = tmp_path / "audio"
    monkeypatch.setattr("api.routes.AUDIO_FILES_DIR", audio_dir)
    monkeypatch.setattr("api.routes.TRANSCRIPTS_DIR", tmp_path / "transcripts")
    from services.store import TranscriptStore
    monkeypatch.setattr("api.routes.store", TranscriptStore(tmp_path / "transcripts"))

    file_content = b"fake audio data for save test"
    response = await client.post(
        "/api/upload",
        files={"file": ("save_test.wav", file_content, "audio/wav")},
    )
    assert response.status_code == 202
    transcript_id = response.json()["transcript_id"]

    # Verify file was saved
    saved_path = audio_dir / transcript_id / "save_test.wav"
    assert saved_path.exists()
    assert saved_path.read_bytes() == file_content


@pytest.mark.asyncio
@patch("api.routes._run_transcription", new_callable=AsyncMock)
async def test_upload_case_insensitive_extension(mock_transcribe, client, tmp_path, monkeypatch):
    """Test that file extension validation is case-insensitive."""
    monkeypatch.setattr("api.routes.AUDIO_FILES_DIR", tmp_path / "audio")
    monkeypatch.setattr("api.routes.TRANSCRIPTS_DIR", tmp_path / "transcripts")
    from services.store import TranscriptStore
    monkeypatch.setattr("api.routes.store", TranscriptStore(tmp_path / "transcripts"))

    file_content = b"fake audio"
    response = await client.post(
        "/api/upload",
        files={"file": ("test.WAV", file_content, "audio/wav")},
    )
    assert response.status_code == 202
