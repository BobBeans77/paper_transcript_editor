"""Transcription service using WhisperX pipeline."""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import whisperx

from models.transcript import (
    Segment,
    TranscriptData,
    TranscriptMetadata,
    TranscriptionStatus,
)
from services.device import detect_compute_device

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Orchestrates the WhisperX transcription pipeline."""

    def __init__(self, device: str | None = None, model_name: str = "large-v2"):
        """
        Initialize with detected compute device.

        Args:
            device: Compute device to use ('cuda', 'mps', or 'cpu').
                    If None, auto-detects the best available device.
            model_name: WhisperX model name to load (default: 'large-v2').
        """
        if device is None:
            device, description = detect_compute_device()
            logger.info("Auto-detected compute device: %s (%s)", device, description)
        self.device = device
        self.model_name = model_name
        # ctranslate2 (used by faster-whisper) only supports cuda and cpu.
        # On MPS (Apple Silicon), we must use cpu for the whisper model.
        if device == "mps":
            self.whisper_device = "cpu"
            self.compute_type = "int8"
            logger.info("MPS detected but ctranslate2 doesn't support MPS. Using CPU for whisper model.")
        elif device == "cuda":
            self.whisper_device = "cuda"
            self.compute_type = "float16"
        else:
            self.whisper_device = "cpu"
            self.compute_type = "int8"
        self.hf_token = os.environ.get("HF_TOKEN")

    async def transcribe(self, audio_path: Path, transcript_id: str) -> TranscriptData:
        """
        Run full WhisperX pipeline: transcribe, align, diarize.

        If CUDA runs out of memory, automatically retries on CPU.

        Args:
            audio_path: Path to the audio file to transcribe.
            transcript_id: Unique identifier for this transcript.

        Returns:
            TranscriptData with metadata and segments.

        Raises:
            RuntimeError: If any step of the WhisperX pipeline fails.
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise RuntimeError(
                f"Transcription failed: audio file not found at '{audio_path}'"
            )

        try:
            # Step 1: Load audio
            logger.info("Loading audio from %s", audio_path)
            audio = whisperx.load_audio(str(audio_path))
        except Exception as e:
            raise RuntimeError(
                f"Transcription failed: unable to load audio file - {e}"
            ) from e

        # Attempt transcription, falling back to CPU on OOM
        result, actual_device, actual_compute_type = await self._transcribe_with_fallback(audio)

        try:
            # Step 3: Align timestamps (forced alignment)
            logger.info("Aligning timestamps...")
            language_code = result.get("language", "en")
            align_model, align_metadata = whisperx.load_align_model(
                language_code=language_code, device=actual_device
            )
            result = whisperx.align(
                result["segments"],
                align_model,
                align_metadata,
                audio,
                actual_device,
                return_char_alignments=False,
            )
        except Exception as e:
            raise RuntimeError(
                f"Transcription failed: timestamp alignment error - {e}"
            ) from e

        try:
            # Step 4: Run speaker diarization
            logger.info("Running speaker diarization...")
            if not self.hf_token:
                logger.warning(
                    "HF_TOKEN not set. Skipping diarization. "
                    "Set the HF_TOKEN environment variable with a Hugging Face token "
                    "that has access to pyannote/speaker-diarization-3.1"
                )
                # Skip diarization — assign all segments to a single speaker
            else:
                from whisperx.diarize import DiarizationPipeline
                diarize_model = DiarizationPipeline(
                    token=self.hf_token, device=actual_device
                )
                diarize_segments = diarize_model(audio)
                result = whisperx.assign_word_speakers(diarize_segments, result)
        except Exception as e:
            logger.error("Diarization failed: %s. Continuing without speaker labels.", e)
            # Continue without diarization rather than failing entirely

        # Step 5: Build Segment objects
        segments = self._build_segments(result.get("segments", []))

        # Calculate total duration from audio length
        sample_rate = 16000  # WhisperX default sample rate
        total_duration = len(audio) / sample_rate

        # Step 6: Build and return TranscriptData
        metadata = TranscriptMetadata(
            audio_file_name=audio_path.name,
            audio_file_path=str(audio_path),
            transcription_date=datetime.now(timezone.utc),
            total_duration_seconds=total_duration,
            model_name=self.model_name,
            device_used=actual_device,
            status=TranscriptionStatus.COMPLETED,
        )

        return TranscriptData(
            id=transcript_id,
            metadata=metadata,
            segments=segments,
        )

    async def _transcribe_with_fallback(
        self, audio
    ) -> tuple[dict, str, str]:
        """
        Attempt transcription on the configured device. If CUDA OOM occurs,
        free GPU memory and retry on CPU with int8 and a smaller batch size.

        Returns:
            Tuple of (result dict, device used, compute_type used).
        """
        import gc
        import torch

        # Try with configured device first
        try:
            logger.info(
                "Loading WhisperX model '%s' on device '%s' (compute_type=%s)",
                self.model_name,
                self.whisper_device,
                self.compute_type,
            )
            model = whisperx.load_model(
                self.model_name,
                self.whisper_device,
                compute_type=self.compute_type,
            )
            logger.info("Transcribing audio (batch_size=16)...")
            result = model.transcribe(audio, batch_size=16, language="en")
            del model
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            return result, self.whisper_device, self.compute_type
        except RuntimeError as e:
            if "out of memory" not in str(e).lower():
                raise RuntimeError(
                    f"Transcription failed: model transcription error - {e}"
                ) from e

        # CUDA OOM — free GPU memory and fall back to CPU
        logger.warning(
            "CUDA out of memory. Freeing GPU memory and retrying on CPU with int8..."
        )
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        try:
            model = whisperx.load_model(
                self.model_name,
                "cpu",
                compute_type="int8",
            )
            logger.info("Transcribing audio on CPU (batch_size=4)...")
            result = model.transcribe(audio, batch_size=4, language="en")
            del model
            gc.collect()
            return result, "cpu", "int8"
        except Exception as e:
            raise RuntimeError(
                f"Transcription failed: CPU fallback also failed - {e}"
            ) from e

    def _build_segments(self, raw_segments: list[dict]) -> list[Segment]:
        """
        Build Segment objects from WhisperX raw output.

        Assigns unique speaker identifiers in SPEAKER_00, SPEAKER_01, etc. format.
        Associates start/end timestamps with each segment.

        Args:
            raw_segments: List of segment dicts from WhisperX pipeline.

        Returns:
            List of Segment objects with consistent speaker IDs.
        """
        speaker_map: dict[str, str] = {}
        speaker_counter = 0
        segments: list[Segment] = []

        for idx, raw in enumerate(raw_segments):
            # Get speaker label from WhisperX output, default to unknown
            raw_speaker = raw.get("speaker", "UNKNOWN")

            # Map to consistent SPEAKER_XX format
            if raw_speaker not in speaker_map:
                speaker_map[raw_speaker] = f"SPEAKER_{speaker_counter:02d}"
                speaker_counter += 1

            speaker_id = speaker_map[raw_speaker]

            segment = Segment(
                index=idx,
                start=raw.get("start", 0.0),
                end=raw.get("end", 0.0),
                speaker=speaker_id,
                text=raw.get("text", "").strip(),
            )
            segments.append(segment)

        return segments
