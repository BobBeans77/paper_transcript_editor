"""Unit tests for the transcription service."""

import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# Mock whisperx before importing the service since it may not be installed
sys.modules.setdefault("whisperx", MagicMock())

from models.transcript import Segment, TranscriptData, TranscriptionStatus
from services.transcription import TranscriptionService


class TestTranscriptionServiceInit:
    """Tests for TranscriptionService initialization."""

    def test_init_with_explicit_device(self):
        """Should use the provided device without auto-detection."""
        with patch("services.transcription.detect_compute_device") as mock_detect:
            service = TranscriptionService(device="cuda", model_name="base")
            mock_detect.assert_not_called()
            assert service.device == "cuda"
            assert service.model_name == "base"
            assert service.compute_type == "float16"

    def test_init_auto_detects_device_when_none(self):
        """Should auto-detect device when none is provided."""
        with patch(
            "services.transcription.detect_compute_device",
            return_value=("mps", "Apple Silicon GPU with MPS"),
        ):
            service = TranscriptionService()
            assert service.device == "mps"
            assert service.model_name == "large-v2"

    def test_compute_type_float16_for_cuda(self):
        """Should use float16 compute type for CUDA devices."""
        service = TranscriptionService(device="cuda")
        assert service.compute_type == "float16"

    def test_compute_type_int8_for_mps(self):
        """Should use int8 compute type for MPS devices."""
        service = TranscriptionService(device="mps")
        assert service.compute_type == "int8"

    def test_compute_type_int8_for_cpu(self):
        """Should use int8 compute type for CPU."""
        service = TranscriptionService(device="cpu")
        assert service.compute_type == "int8"


class TestBuildSegments:
    """Tests for _build_segments method."""

    def test_empty_segments(self):
        """Should return empty list for empty input."""
        service = TranscriptionService(device="cpu")
        result = service._build_segments([])
        assert result == []

    def test_single_segment(self):
        """Should build a single segment correctly."""
        service = TranscriptionService(device="cpu")
        raw = [{"start": 0.0, "end": 2.5, "speaker": "SPK_0", "text": "Hello world"}]
        result = service._build_segments(raw)

        assert len(result) == 1
        assert result[0].index == 0
        assert result[0].start == 0.0
        assert result[0].end == 2.5
        assert result[0].speaker == "SPEAKER_00"
        assert result[0].text == "Hello world"

    def test_multiple_speakers_get_unique_ids(self):
        """Should assign unique SPEAKER_XX identifiers to distinct speakers."""
        service = TranscriptionService(device="cpu")
        raw = [
            {"start": 0.0, "end": 2.0, "speaker": "SPK_A", "text": "Hi"},
            {"start": 2.0, "end": 4.0, "speaker": "SPK_B", "text": "Hello"},
            {"start": 4.0, "end": 6.0, "speaker": "SPK_A", "text": "How are you?"},
        ]
        result = service._build_segments(raw)

        assert result[0].speaker == "SPEAKER_00"
        assert result[1].speaker == "SPEAKER_01"
        assert result[2].speaker == "SPEAKER_00"  # Same speaker as first

    def test_speaker_ids_are_consistent(self):
        """Same raw speaker should always map to the same SPEAKER_XX id."""
        service = TranscriptionService(device="cpu")
        raw = [
            {"start": 0.0, "end": 1.0, "speaker": "X", "text": "a"},
            {"start": 1.0, "end": 2.0, "speaker": "Y", "text": "b"},
            {"start": 2.0, "end": 3.0, "speaker": "X", "text": "c"},
            {"start": 3.0, "end": 4.0, "speaker": "Y", "text": "d"},
            {"start": 4.0, "end": 5.0, "speaker": "Z", "text": "e"},
        ]
        result = service._build_segments(raw)

        assert result[0].speaker == result[2].speaker  # X -> SPEAKER_00
        assert result[1].speaker == result[3].speaker  # Y -> SPEAKER_01
        assert result[4].speaker == "SPEAKER_02"  # Z -> SPEAKER_02

    def test_missing_speaker_defaults_to_unknown(self):
        """Should handle missing speaker field gracefully."""
        service = TranscriptionService(device="cpu")
        raw = [{"start": 0.0, "end": 1.0, "text": "No speaker"}]
        result = service._build_segments(raw)

        assert result[0].speaker == "SPEAKER_00"  # UNKNOWN mapped to first ID

    def test_text_is_stripped(self):
        """Should strip whitespace from segment text."""
        service = TranscriptionService(device="cpu")
        raw = [{"start": 0.0, "end": 1.0, "speaker": "S", "text": "  hello  "}]
        result = service._build_segments(raw)

        assert result[0].text == "hello"

    def test_segments_indexed_sequentially(self):
        """Should assign sequential indices starting from 0."""
        service = TranscriptionService(device="cpu")
        raw = [
            {"start": 0.0, "end": 1.0, "speaker": "S", "text": "a"},
            {"start": 1.0, "end": 2.0, "speaker": "S", "text": "b"},
            {"start": 2.0, "end": 3.0, "speaker": "S", "text": "c"},
        ]
        result = service._build_segments(raw)

        assert [s.index for s in result] == [0, 1, 2]


class TestTranscribe:
    """Tests for the transcribe method."""

    @pytest.mark.asyncio
    async def test_raises_error_for_missing_audio_file(self):
        """Should raise RuntimeError when audio file doesn't exist."""
        service = TranscriptionService(device="cpu")
        with pytest.raises(RuntimeError, match="audio file not found"):
            await service.transcribe(Path("/nonexistent/audio.wav"), "test-id")

    @pytest.mark.asyncio
    async def test_raises_error_on_audio_load_failure(self, tmp_path):
        """Should raise RuntimeError with descriptive message on load failure."""
        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"fake audio data")

        service = TranscriptionService(device="cpu")

        with patch("services.transcription.whisperx") as mock_wx:
            mock_wx.load_audio.side_effect = Exception("corrupt file")

            with pytest.raises(RuntimeError, match="unable to load audio file"):
                await service.transcribe(audio_file, "test-id")

    @pytest.mark.asyncio
    async def test_raises_error_on_model_failure(self, tmp_path):
        """Should raise RuntimeError with descriptive message on model failure."""
        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"fake audio data")

        service = TranscriptionService(device="cpu")

        with patch("services.transcription.whisperx") as mock_wx:
            mock_wx.load_audio.return_value = MagicMock()
            mock_wx.load_model.side_effect = Exception("model not found")

            with pytest.raises(RuntimeError, match="model transcription error"):
                await service.transcribe(audio_file, "test-id")

    @pytest.mark.asyncio
    async def test_raises_error_on_alignment_failure(self, tmp_path):
        """Should raise RuntimeError with descriptive message on alignment failure."""
        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"fake audio data")

        service = TranscriptionService(device="cpu")

        with patch("services.transcription.whisperx") as mock_wx:
            mock_wx.load_audio.return_value = MagicMock()
            mock_model = MagicMock()
            mock_model.transcribe.return_value = {
                "segments": [{"text": "hi"}],
                "language": "en",
            }
            mock_wx.load_model.return_value = mock_model
            mock_wx.load_align_model.side_effect = Exception("alignment failed")

            with pytest.raises(RuntimeError, match="timestamp alignment error"):
                await service.transcribe(audio_file, "test-id")

    @pytest.mark.asyncio
    async def test_raises_error_on_diarization_failure(self, tmp_path):
        """Should raise RuntimeError with descriptive message on diarization failure."""
        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"fake audio data")

        service = TranscriptionService(device="cpu")

        with patch("services.transcription.whisperx") as mock_wx:
            mock_wx.load_audio.return_value = MagicMock()
            mock_model = MagicMock()
            mock_model.transcribe.return_value = {
                "segments": [{"text": "hi"}],
                "language": "en",
            }
            mock_wx.load_model.return_value = mock_model
            mock_wx.load_align_model.return_value = (MagicMock(), MagicMock())
            mock_wx.align.return_value = {"segments": [{"text": "hi"}]}
            mock_wx.DiarizationPipeline.side_effect = Exception("no auth token")

            with pytest.raises(RuntimeError, match="speaker diarization error"):
                await service.transcribe(audio_file, "test-id")

    @pytest.mark.asyncio
    async def test_successful_transcription(self, tmp_path):
        """Should return TranscriptData on successful pipeline execution."""
        import numpy as np

        audio_file = tmp_path / "test.wav"
        audio_file.write_bytes(b"fake audio data")

        # Create a fake audio array (1 second at 16kHz)
        fake_audio = np.zeros(16000, dtype=np.float32)

        service = TranscriptionService(device="cpu")

        with patch("services.transcription.whisperx") as mock_wx:
            mock_wx.load_audio.return_value = fake_audio
            mock_model = MagicMock()
            mock_model.transcribe.return_value = {
                "segments": [
                    {"start": 0.0, "end": 0.5, "text": "Hello"},
                    {"start": 0.5, "end": 1.0, "text": "World"},
                ],
                "language": "en",
            }
            mock_wx.load_model.return_value = mock_model
            mock_wx.load_align_model.return_value = (MagicMock(), MagicMock())
            mock_wx.align.return_value = {
                "segments": [
                    {"start": 0.0, "end": 0.5, "speaker": "SPK_0", "text": "Hello"},
                    {"start": 0.5, "end": 1.0, "speaker": "SPK_1", "text": "World"},
                ]
            }
            mock_diarize = MagicMock()
            mock_wx.DiarizationPipeline.return_value = mock_diarize
            mock_diarize.return_value = MagicMock()
            mock_wx.assign_word_speakers.return_value = {
                "segments": [
                    {"start": 0.0, "end": 0.5, "speaker": "SPK_0", "text": "Hello"},
                    {"start": 0.5, "end": 1.0, "speaker": "SPK_1", "text": "World"},
                ]
            }

            result = await service.transcribe(audio_file, "test-123")

        assert type(result).__name__ == "TranscriptData"
        assert result.id == "test-123"
        assert result.metadata.audio_file_name == "test.wav"
        assert result.metadata.model_name == "large-v2"
        assert result.metadata.device_used == "cpu"
        assert result.metadata.status == TranscriptionStatus.COMPLETED
        assert result.metadata.total_duration_seconds == 1.0
        assert len(result.segments) == 2
        assert result.segments[0].speaker == "SPEAKER_00"
        assert result.segments[1].speaker == "SPEAKER_01"
        assert result.segments[0].text == "Hello"
        assert result.segments[1].text == "World"
