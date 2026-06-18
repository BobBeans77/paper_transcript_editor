"""API routes for WhisperX Transcription Review."""

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from models.transcript import (
    AccentTag,
    SegmentUpdate,
    TranscriptData,
    TranscriptSummary,
    TranscriptionStatus,
)
from services.store import TranscriptStore

router = APIRouter(prefix="/api")

ALLOWED_EXTENSIONS = {"wav", "mp3", "flac", "m4a"}
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "550"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

AUDIO_FILES_DIR = Path(os.environ.get("AUDIO_FILES_DIR", "audio_files"))
TRANSCRIPTS_DIR = Path(os.environ.get("TRANSCRIPTS_DIR", "transcripts"))

store = TranscriptStore(storage_dir=TRANSCRIPTS_DIR)


def _get_file_extension(filename: str) -> str:
    """Extract lowercase file extension without the dot."""
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


async def _run_transcription(audio_path: Path, transcript_id: str) -> None:
    """Background task to run transcription and save result."""
    import logging
    from datetime import datetime, timezone

    from models.transcript import (
        Segment,
        TranscriptData,
        TranscriptMetadata,
    )
    from services.transcription import TranscriptionService

    logger = logging.getLogger(__name__)

    try:
        service = TranscriptionService()
        transcript = await service.transcribe(audio_path, transcript_id)
        store.save(transcript)
    except Exception as e:
        logger.error("Transcription failed for %s: %s", transcript_id, e, exc_info=True)
        # Save a failed transcript record so status polling can report the failure
        metadata = TranscriptMetadata(
            audio_file_name=audio_path.name,
            audio_file_path=str(audio_path),
            transcription_date=datetime.now(timezone.utc),
            total_duration_seconds=0.0,
            model_name="large-v2",
            device_used="unknown",
            status=TranscriptionStatus.FAILED,
        )
        failed_transcript = TranscriptData(
            id=transcript_id,
            metadata=metadata,
            segments=[],
        )
        store.save(failed_transcript)


@router.post("/upload", status_code=202)
async def upload_audio(file: UploadFile, background_tasks: BackgroundTasks):
    """
    Upload an audio file for transcription.

    Validates file format and size, saves the file, starts async transcription,
    and returns a transcript_id for status polling.
    """
    filename = file.filename or ""

    # Validate file extension
    extension = _get_file_extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported format. Supported: WAV, MP3, FLAC, M4A",
        )

    # Read file content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {MAX_FILE_SIZE_MB}MB",
        )

    # Generate transcript ID and save audio file
    transcript_id = str(uuid.uuid4())
    audio_dir = AUDIO_FILES_DIR / transcript_id
    audio_dir.mkdir(parents=True, exist_ok=True)
    audio_path = audio_dir / filename
    audio_path.write_bytes(content)

    # Start async transcription
    background_tasks.add_task(_run_transcription, audio_path, transcript_id)

    return {"transcript_id": transcript_id, "status": "pending"}


class SegmentUpdateRequest(BaseModel):
    """Request body for updating a segment."""

    segment_index: int
    updates: SegmentUpdate


class AccentUpdateRequest(BaseModel):
    """Request body for setting the accent tag on a transcript."""

    accent: AccentTag | None = None


@router.get("/transcripts", response_model=list[TranscriptSummary])
async def list_transcripts():
    """Return list of all transcript summaries."""
    return store.list_all()


@router.get("/transcripts/{transcript_id}", response_model=TranscriptData)
async def get_transcript(transcript_id: str):
    """Return full transcript with segments."""
    try:
        return store.load(transcript_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript {transcript_id} not found",
        )


@router.get("/transcripts/{transcript_id}/status")
async def get_transcript_status(transcript_id: str):
    """Return transcription status."""
    try:
        transcript = store.load(transcript_id)
        return {"status": transcript.metadata.status}
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript {transcript_id} not found",
        )


@router.delete("/transcripts/{transcript_id}", status_code=204)
async def delete_transcript(transcript_id: str):
    """Delete a transcript and its associated audio files."""
    try:
        store.delete(transcript_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript {transcript_id} not found",
        )


@router.put("/transcripts/{transcript_id}", response_model=TranscriptData)
async def update_transcript(transcript_id: str, body: SegmentUpdateRequest):
    """Update segment edits and PII flags."""
    try:
        store.update_segment(transcript_id, body.segment_index, body.updates)
        return store.load(transcript_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript {transcript_id} not found",
        )
    except IndexError:
        raise HTTPException(
            status_code=400,
            detail=f"Segment index {body.segment_index} out of range",
        )


@router.patch("/transcripts/{transcript_id}/accent", response_model=TranscriptData)
async def update_accent(transcript_id: str, body: AccentUpdateRequest):
    """Set or clear the accent tag on a transcript."""
    try:
        store.update_accent(transcript_id, body.accent)
        return store.load(transcript_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript {transcript_id} not found",
        )


# Content-type mapping for audio file extensions
AUDIO_CONTENT_TYPES = {
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "flac": "audio/flac",
    "m4a": "audio/mp4",
}


@router.get("/transcripts/{transcript_id}/audio")
async def stream_audio(transcript_id: str, request: Request):
    """Stream audio file with support for range requests (seeking)."""
    # Load transcript to get audio file path
    try:
        transcript = store.load(transcript_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Transcript {transcript_id} not found",
        )

    audio_path = Path(transcript.metadata.audio_file_path)

    # Check if audio file exists on disk
    if not audio_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Audio file not found for transcript {transcript_id}",
        )

    file_size = audio_path.stat().st_size
    extension = _get_file_extension(audio_path.name)
    content_type = AUDIO_CONTENT_TYPES.get(extension, "application/octet-stream")

    # Parse Range header for seeking support
    range_header = request.headers.get("range")

    if range_header:
        # Parse range like "bytes=0-1023"
        try:
            range_spec = range_header.strip().lower()
            if not range_spec.startswith("bytes="):
                raise ValueError("Invalid range unit")
            byte_range = range_spec[6:]  # Remove "bytes="
            parts = byte_range.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            raise HTTPException(status_code=416, detail="Invalid range header")

        # Validate range bounds
        if start >= file_size or end >= file_size or start > end:
            raise HTTPException(
                status_code=416,
                detail="Range not satisfiable",
            )

        content_length = end - start + 1

        def iter_range():
            with open(audio_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk_size = min(8192, remaining)
                    data = f.read(chunk_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
        }

        return StreamingResponse(
            iter_range(),
            status_code=206,
            headers=headers,
            media_type=content_type,
        )
    else:
        # Full file response
        def iter_file():
            with open(audio_path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
        }

        return StreamingResponse(
            iter_file(),
            status_code=200,
            headers=headers,
            media_type=content_type,
        )
