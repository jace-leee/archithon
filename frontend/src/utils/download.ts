/**
 * Download utilities for various file types
 */

/** Download a base64-encoded file */
export function downloadBase64(base64: string, filename: string, mimeType: string) {
  const data = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
  const link = document.createElement('a');
  link.href = data;
  link.download = filename;
  link.click();
}

/** Download a JSON object as a .json file */
export function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Download a text string as a file */
export function downloadText(text: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Download a file from a URL (e.g., GLB from /static/) */
export async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);
}
