"""GPU memory management utilities."""

from __future__ import annotations

import contextlib
from typing import Generator


def get_gpu_memory() -> dict:
    """Return current GPU memory usage statistics.

    Returns a dict with keys: total_mb, used_mb, free_mb, device.
    Falls back to a zero-state dict when CUDA/GPU is unavailable.
    """
    try:
        import torch  # type: ignore

        if not torch.cuda.is_available():
            return {"total_mb": 0, "used_mb": 0, "free_mb": 0, "device": "cpu"}

        device = torch.cuda.current_device()
        total = torch.cuda.get_device_properties(device).total_memory // (1024 * 1024)
        reserved = torch.cuda.memory_reserved(device) // (1024 * 1024)
        allocated = torch.cuda.memory_allocated(device) // (1024 * 1024)
        free = total - reserved

        return {
            "total_mb": total,
            "used_mb": allocated,
            "reserved_mb": reserved,
            "free_mb": free,
            "device": torch.cuda.get_device_name(device),
        }
    except ImportError:
        return {"total_mb": 0, "used_mb": 0, "free_mb": 0, "device": "cpu (no torch)"}


def clear_gpu_memory() -> None:
    """Release cached GPU memory back to the driver."""
    try:
        import torch  # type: ignore

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.synchronize()
    except ImportError:
        pass


@contextlib.contextmanager
def model_context(model_name: str) -> Generator[None, None, None]:
    """Context manager that clears GPU memory before and after loading a model.

    Usage::

        with model_context("shaper"):
            model = load_shaper_model()
            result = model.infer(...)
    """
    clear_gpu_memory()
    try:
        yield
    finally:
        clear_gpu_memory()
