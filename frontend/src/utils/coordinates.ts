export function pixelToWorld(
  px: number,
  py: number,
  pixelsPerMeter: number,
  imageWidth: number,
  imageHeight: number
): { x: number; z: number } {
  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;
  return {
    x: (px - centerX) / pixelsPerMeter,
    z: (py - centerY) / pixelsPerMeter,
  };
}

export function worldToPixel(
  x: number,
  z: number,
  pixelsPerMeter: number,
  imageWidth: number,
  imageHeight: number
): { px: number; py: number } {
  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;
  return {
    px: x * pixelsPerMeter + centerX,
    py: z * pixelsPerMeter + centerY,
  };
}
