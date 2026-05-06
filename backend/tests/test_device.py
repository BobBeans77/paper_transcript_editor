"""Unit tests for device detection."""

import sys
import warnings
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add backend directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.device import detect_compute_device


class TestDetectComputeDevice:
    """Tests for detect_compute_device function."""

    def test_returns_cuda_when_available(self):
        """When CUDA is available, should return cuda device."""
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = True

        with patch.dict("sys.modules", {"torch": mock_torch}):
            # Need to reimport to pick up the mock
            import importlib
            import services.device

            importlib.reload(services.device)
            result = services.device.detect_compute_device()

        assert result == ("cuda", "NVIDIA GPU with CUDA")

    def test_returns_mps_when_cuda_unavailable(self):
        """When CUDA is unavailable but MPS is, should return mps device."""
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = False
        mock_torch.backends.mps.is_available.return_value = True

        with patch.dict("sys.modules", {"torch": mock_torch}):
            import importlib
            import services.device

            importlib.reload(services.device)
            result = services.device.detect_compute_device()

        assert result == ("mps", "Apple Silicon GPU with MPS")

    def test_returns_cpu_with_warning_when_no_gpu(self):
        """When no GPU is available, should return cpu and emit warning."""
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = False
        mock_torch.backends.mps.is_available.return_value = False

        with patch.dict("sys.modules", {"torch": mock_torch}):
            import importlib
            import services.device

            importlib.reload(services.device)

            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                result = services.device.detect_compute_device()

                assert result == ("cpu", "CPU (no GPU acceleration available)")
                assert len(w) == 1
                assert "No GPU detected" in str(w[0].message)
                assert "slower" in str(w[0].message)

    def test_cuda_takes_priority_over_mps(self):
        """When both CUDA and MPS are available, CUDA should be preferred."""
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = True
        mock_torch.backends.mps.is_available.return_value = True

        with patch.dict("sys.modules", {"torch": mock_torch}):
            import importlib
            import services.device

            importlib.reload(services.device)
            result = services.device.detect_compute_device()

        assert result == ("cuda", "NVIDIA GPU with CUDA")

    def test_return_type_is_tuple(self):
        """Should always return a tuple of two strings."""
        mock_torch = MagicMock()
        mock_torch.cuda.is_available.return_value = False
        mock_torch.backends.mps.is_available.return_value = False

        with patch.dict("sys.modules", {"torch": mock_torch}):
            import importlib
            import services.device

            importlib.reload(services.device)

            with warnings.catch_warnings(record=True):
                warnings.simplefilter("always")
                result = services.device.detect_compute_device()

        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], str)
        assert isinstance(result[1], str)
