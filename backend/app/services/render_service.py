"""ControlNet-based rendering service.

Takes a scene composite image (furniture placed on floor plan) plus a depth
map, then uses ControlNet (depth conditioning) to render a photorealistic
interior image with the given style prompt.

GPU-dependent: requires diffusers + ControlNet checkpoint (~5 GB VRAM).
Mock returns the input scene image with a tinted overlay.
"""

from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Mock helper
# ---------------------------------------------------------------------------

def _strip_data_uri(b64: str) -> str:
    """Strip optional data:...;base64, prefix from a base64 string."""
    if b64.startswith("data:"):
        _, _, after = b64.partition(",")
        return after
    return b64


def _tint_image_b64(scene_b64: str, prompt: str) -> str:
    """Return a slightly tinted version of the input image as base64."""
    try:
        from PIL import Image, ImageEnhance, ImageFilter  # type: ignore

        data = base64.b64decode(_strip_data_uri(scene_b64))
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img = img.filter(ImageFilter.GaussianBlur(radius=1))
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(1.3)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return scene_b64  # return unchanged on any error


def _placeholder_render_b64() -> str:
    """Return a 512×512 gradient placeholder image as base64."""
    try:
        from PIL import Image  # type: ignore

        img = Image.new("RGB", (512, 512))
        pixels = img.load()
        for y in range(512):
            for x in range(512):
                r = int(200 + 55 * x / 512)
                g = int(180 + 40 * y / 512)
                b = 210
                pixels[x, y] = (r, g, b)  # type: ignore[index]
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()
    except ImportError:
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_scene(
    scene_image_b64: str,
    depth_map_b64: str,
    prompt: str,
    output_dir: str | Path | None = None,
    negative_prompt: str = "low quality, blurry, distorted",
    num_inference_steps: int = 20,
    guidance_scale: float = 7.5,
) -> dict[str, Any]:
    """Render a photorealistic interior scene using ControlNet depth conditioning.

    Parameters
    ----------
    scene_image_b64:     Base64 PNG/JPEG of the scene composite.
    depth_map_b64:       Base64 depth map aligned with scene_image.
    prompt:              Text prompt for the desired interior style.
    output_dir:          Optional directory to save the rendered image.
    negative_prompt:     Negative prompt to suppress artefacts.
    num_inference_steps: Diffusion steps (lower = faster, lower quality).
    guidance_scale:      CFG scale.

    Returns
    -------
    Dict with keys:
      - rendered_image_b64: base64 JPEG of the rendered scene
      - mock: True when returning mock output

    TODO: Replace mock with real ControlNet inference:
      1. from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
      2. controlnet = ControlNetModel.from_pretrained(
             "lllyasviel/sd-controlnet-depth", torch_dtype=torch.float16)
      3. pipe = StableDiffusionControlNetPipeline.from_pretrained(
             "runwayml/stable-diffusion-v1-5", controlnet=controlnet,
             torch_dtype=torch.float16).to("cuda")
      4. depth_image = Image.open(io.BytesIO(base64.b64decode(depth_map_b64)))
      5. out = pipe(prompt, image=depth_image, negative_prompt=negative_prompt,
                    num_inference_steps=num_inference_steps,
                    guidance_scale=guidance_scale)
      6. Save out.images[0] and return as base64.
    """
    if scene_image_b64:
        rendered_b64 = _tint_image_b64(scene_image_b64, prompt)
    else:
        rendered_b64 = _placeholder_render_b64()

    if output_dir:
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "rendered.jpg").write_bytes(base64.b64decode(rendered_b64))

    return {
        "rendered_image_b64": rendered_b64,
        "mock": True,
    }
