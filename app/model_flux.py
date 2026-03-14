# ~/archithon/app/model_flux.py

import io

import torch
from PIL import Image
from diffusers import Flux2KleinPipeline


class FluxModel:
    """FLUX.2 Klein 4B 모델 싱글톤 래퍼"""

    _instance = None

    @classmethod
    def get_instance(cls) -> "FluxModel":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        print("[FLUX] Loading model...")
        self.pipe = Flux2KleinPipeline.from_pretrained(
            "black-forest-labs/FLUX.2-klein-4B",
            torch_dtype=torch.bfloat16,
        ).to("cuda")

        mem = torch.cuda.memory_allocated(0) / 1e9
        print(f"[FLUX] Model loaded. GPU memory: {mem:.2f} GB")

    def generate(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        seed: int = -1,
    ) -> bytes:
        """텍스트 → 이미지 (T2I)"""
        generator = None
        if seed >= 0:
            generator = torch.Generator(device="cuda").manual_seed(seed)

        image = self.pipe(
            prompt=prompt,
            height=height,
            width=width,
            guidance_scale=1.0,
            num_inference_steps=4,
            generator=generator,
        ).images[0]

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        torch.cuda.empty_cache()
        return buf.getvalue()

    def edit(
        self,
        image: Image.Image,
        prompt: str,
        seed: int = -1,
    ) -> bytes:
        """이미지 → 이미지 (I2I)"""
        image = image.resize((1024, 1024))

        generator = None
        if seed >= 0:
            generator = torch.Generator(device="cuda").manual_seed(seed)

        output = self.pipe(
            prompt=prompt,
            image=image,
            guidance_scale=1.0,
            num_inference_steps=4,
            generator=generator,
        ).images[0]

        buf = io.BytesIO()
        output.save(buf, format="PNG")
        torch.cuda.empty_cache()
        return buf.getvalue()
