# ~/archithon/app/model_3d.py

import os
import sys
import tempfile

import numpy as np
import torch
from PIL import Image

# SAM 3D Objects 환경 설정
os.environ.setdefault("CUDA_HOME", "/usr/local/cuda")
os.environ.setdefault("CONDA_PREFIX", "/usr/local/cuda")
os.environ["LIDRA_SKIP_INIT"] = "true"

# notebook/inference.py 경로 추가
SAM3D_ROOT = os.path.expanduser("~/sam-3d-objects")
sys.path.insert(0, os.path.join(SAM3D_ROOT, "notebook"))


class SAM3DModel:
    """SAM 3D Objects 모델 싱글톤 래퍼"""

    _instance = None

    @classmethod
    def get_instance(cls) -> "SAM3DModel":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        from inference import Inference

        config_path = os.path.join(SAM3D_ROOT, "checkpoints", "hf", "pipeline.yaml")
        print("[SAM3D] Loading model...")
        self.inference = Inference(config_path, compile=False)

        mem = torch.cuda.memory_allocated(0) / 1e9
        print(f"[SAM3D] Model loaded. GPU memory: {mem:.2f} GB")

    def generate_3d(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        seed: int = 42,
    ) -> bytes:
        """이미지 + 마스크로 3D GLB를 생성하여 bytes로 반환"""
        output = self.inference(image, mask, seed=seed)

        # Trimesh → GLB bytes
        glb_bytes = output["glb"].export(file_type="glb")

        torch.cuda.empty_cache()
        return glb_bytes
