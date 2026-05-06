from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class TranscriptionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Segment(BaseModel):
    index: int
    start: float
    end: float
    speaker: str
    text: str
    edited_text: str | None = None
    pii_flagged: bool = False


class TranscriptMetadata(BaseModel):
    audio_file_name: str
    audio_file_path: str
    transcription_date: datetime
    total_duration_seconds: float
    model_name: str
    device_used: str
    status: TranscriptionStatus


class TranscriptData(BaseModel):
    id: str
    metadata: TranscriptMetadata
    segments: list[Segment]


class SegmentUpdate(BaseModel):
    edited_text: str | None = None
    pii_flagged: bool | None = None


class TranscriptSummary(BaseModel):
    id: str
    audio_file_name: str
    transcription_date: datetime
    status: TranscriptionStatus
    segment_count: int
    pii_flagged_count: int
    edited_count: int
