# ~/archithon/app/model.py

import base64
import io

import numpy as np
import torch
from PIL import Image
from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor


def _masks_to_base64(masks_tensor, image_size: tuple[int, int]) -> list[str]:
    """마스크 텐서를 base64 PNG 문자열 리스트로 변환한다.

    각 마스크는 단일 채널 PNG (0/255)로 인코딩되어
    원본 이미지와 동일한 크기로 리사이즈된다.
    """
    masks_np = masks_tensor.cpu().float().numpy()  # (N, 1, H, W) or (N, H, W)
    encoded = []
    for m in masks_np:
        if m.ndim == 3:
            m = m[0]
        binary = (m > 0.5).astype(np.uint8) * 255
        mask_img = Image.fromarray(binary, mode="L").resize(
            image_size, Image.NEAREST
        )
        buf = io.BytesIO()
        mask_img.save(buf, format="PNG", optimize=True)
        encoded.append(base64.b64encode(buf.getvalue()).decode())
    return encoded


class SAM3Model:
    """SAM 3 모델 싱글톤 래퍼"""

    _instance = None

    @classmethod
    def get_instance(cls) -> "SAM3Model":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

        print("[SAM3] Loading model...")
        self.model = build_sam3_image_model()
        self.processor = Sam3Processor(self.model)
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        mem = torch.cuda.memory_allocated(0) / 1e9
        print(f"[SAM3] Model loaded. GPU memory: {mem:.2f} GB")

    @staticmethod
    def _format_output(output, image_size: tuple[int, int]) -> dict:
        return {
            "masks": _masks_to_base64(output["masks"], image_size),
            "boxes": output["boxes"].cpu().float().numpy().tolist(),
            "scores": output["scores"].cpu().float().numpy().tolist(),
        }

    def predict_text(self, image: Image.Image, prompt: str) -> dict:
        """텍스트 프롬프트 기반 세그멘테이션 (PCS)"""
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            state = self.processor.set_image(image)
            output = self.processor.set_text_prompt(state=state, prompt=prompt)

        result = self._format_output(output, image.size)
        torch.cuda.empty_cache()
        return result

    def predict_box(self, image: Image.Image, box: list[float]) -> dict:
        """바운딩 박스 프롬프트 기반 세그멘테이션 (PVS)"""
        w, h = image.size
        x1, y1, x2, y2 = box
        norm_box = [
            ((x1 + x2) / 2) / w,
            ((y1 + y2) / 2) / h,
            (x2 - x1) / w,
            (y2 - y1) / h,
        ]

        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            state = self.processor.set_image(image)
            output = self.processor.add_geometric_prompt(
                box=norm_box, label=True, state=state
            )

        result = self._format_output(output, image.size)
        torch.cuda.empty_cache()
        return result

    def predict_multi_text(self, image: Image.Image, prompts: list[str]) -> dict:
        """다중 텍스트 프롬프트 세그멘테이션"""
        with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
            state = self.processor.set_image(image)
            results = []
            for prompt in prompts:
                output = self.processor.set_text_prompt(state=state, prompt=prompt)
                results.append({
                    "prompt": prompt,
                    **self._format_output(output, image.size),
                })

        torch.cuda.empty_cache()
        return {"results": results}
