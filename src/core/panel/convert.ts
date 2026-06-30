/**
 * Panel bundle builder.
 * Converts images to 200x200 1-bit BMP files for the e-paper display.
 */

import { writeBmp1bit, thresholdPixels, imageDataToGrayscale } from '../bmp/writer';

export interface PanelItem {
  label: string;
  imageFile: File;
}

export interface PanelBundle {
  title: string;
  bundleId: string;
  items: PanelItem[];
  threshold: number;
  mode: 'fit' | 'crop';
}

const PANEL_SIZE = 200;

/**
 * Process an image file into a 200x200 1-bit BMP.
 */
export async function processPanelImage(
  file: File,
  mode: 'fit' | 'crop' = 'fit',
  threshold: number = 168
): Promise<ArrayBuffer> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = PANEL_SIZE;
  canvas.height = PANEL_SIZE;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, PANEL_SIZE, PANEL_SIZE);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  if (mode === 'crop') {
    const scale = Math.max(PANEL_SIZE / srcW, PANEL_SIZE / srcH);
    const sw = PANEL_SIZE / scale;
    const sh = PANEL_SIZE / scale;
    const sx = (srcW - sw) / 2;
    const sy = (srcH - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PANEL_SIZE, PANEL_SIZE);
  } else {
    const scale = Math.min(PANEL_SIZE / srcW, PANEL_SIZE / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (PANEL_SIZE - dw) / 2;
    const dy = (PANEL_SIZE - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  const imageData = ctx.getImageData(0, 0, PANEL_SIZE, PANEL_SIZE);
  const gray = imageDataToGrayscale(imageData);
  const binary = thresholdPixels(gray, threshold);

  return writeBmp1bit({ width: PANEL_SIZE, height: PANEL_SIZE, pixels: binary });
}

/**
 * Generate panel.meta content.
 */
export function formatPanelMeta(bundle: PanelBundle): string {
  const lines = [
    'format=EPR_PANEL_V1',
    'version=1',
    `bundle_id=${bundle.bundleId}`,
    `title=${bundle.title}`,
    `item_count=${bundle.items.length}`,
  ];

  for (let i = 0; i < bundle.items.length; i++) {
    const item = bundle.items[i];
    lines.push(`item${i + 1}_label=${item.label}`);
    lines.push(`item${i + 1}_file=panel${String(i + 1).padStart(2, '0')}.bmp`);
  }

  return lines.join('\n');
}

/**
 * Generate bundle ID from title.
 */
export function makePanelBundleId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  const hash = simpleHash(title).toString(16).substring(0, 8);
  return slug ? `panels-${slug}-${hash}` : `panels-${hash}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
