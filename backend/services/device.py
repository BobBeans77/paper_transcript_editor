"""Device detection for compute acceleration."""

import warnings


def detect_compute_device() -> tuple[str, str]:
    """
    Detect the best available compute device.

    Checks for hardware acceleration in order of preference:
    1. CUDA (NVIDIA GPU)
    2. MPS (Apple Silicon)
    3. CPU fallback (with warning)

    Returns:
        Tuple of (device_name, description) e.g. ('cuda', 'NVIDIA GPU with CUDA')
    """
    import torch

    if torch.cuda.is_available():
        return ("cuda", "NVIDIA GPU with CUDA")

    if torch.backends.mps.is_available():
        return ("mps", "Apple Silicon GPU with MPS")

    warnings.warn(
        "No GPU detected. Falling back to CPU. Processing will be significantly slower.",
        stacklevel=2,
    )
    return ("cpu", "CPU (no GPU acceleration available)")
