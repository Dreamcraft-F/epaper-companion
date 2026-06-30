/**
 * QR code bundle builder.
 * Generates QR codes as 128x128 1-bit BMP files.
 */

import QRCode from 'qrcode';
import { writeBmp1bit, thresholdPixels } from '../bmp/writer';

export interface QrItem {
  label: string;
  payload: string; // URL or text to encode
  sourceKind: 'qr' | 'image';
  imageFile?: File; // for image source
}

export interface QrBundle {
  title: string;
  bundleId: string;
  items: QrItem[];
}

const VIEWPORT_SIZE = 128;

/**
 * Generate a QR code as 128x128 pixel data (0=black, 255=white).
 */
export async function generateQrPixels(content: string): Promise<Uint8Array> {
  // Generate QR matrix
  const matrix = QRCode.create(content, { errorCorrectionLevel: 'M' });
  const modules = matrix.modules;
  const moduleCount = modules.size;

  // Calculate module size to fit 128x128 with quiet zone
  const quietZone = 4;
  const available = VIEWPORT_SIZE - quietZone * 2;
  const moduleSize = Math.floor(available / moduleCount);
  const qrSize = moduleSize * moduleCount;
  const offset = Math.floor((VIEWPORT_SIZE - qrSize) / 2);

  // Create pixel array (white background)
  const pixels = new Uint8Array(VIEWPORT_SIZE * VIEWPORT_SIZE).fill(255);

  // Draw QR modules
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules.get(row, col)) {
        const x0 = offset + col * moduleSize;
        const y0 = offset + row * moduleSize;
        for (let dy = 0; dy < moduleSize; dy++) {
          for (let dx = 0; dx < moduleSize; dx++) {
            const px = x0 + dx;
            const py = y0 + dy;
            if (px < VIEWPORT_SIZE && py < VIEWPORT_SIZE) {
              pixels[py * VIEWPORT_SIZE + px] = 0; // black
            }
          }
        }
      }
    }
  }

  return pixels;
}

/**
 * Generate QR BMP file from content string.
 */
export async function generateQrBmp(content: string): Promise<ArrayBuffer> {
  const pixels = await generateQrPixels(content);
  return writeBmp1bit({ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, pixels });
}

/**
 * Process an image file into a 128x128 1-bit BMP.
 */
export async function processImageToBmp(
  file: File,
  mode: 'fit' | 'crop' = 'fit',
  threshold: number = 160
): Promise<ArrayBuffer> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = VIEWPORT_SIZE;
  canvas.height = VIEWPORT_SIZE;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  if (mode === 'crop') {
    const scale = Math.max(VIEWPORT_SIZE / srcW, VIEWPORT_SIZE / srcH);
    const sw = VIEWPORT_SIZE / scale;
    const sh = VIEWPORT_SIZE / scale;
    const sx = (srcW - sw) / 2;
    const sy = (srcH - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
  } else {
    const scale = Math.min(VIEWPORT_SIZE / srcW, VIEWPORT_SIZE / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (VIEWPORT_SIZE - dw) / 2;
    const dy = (VIEWPORT_SIZE - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  const imageData = ctx.getImageData(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
  const gray = rgbaToGrayscale(imageData.data);
  const binary = thresholdPixels(gray, threshold);

  return writeBmp1bit({ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, pixels: binary });
}

/**
 * Generate qr.meta content.
 */
export function formatQrMeta(bundle: QrBundle): string {
  const lines = [
    'format=EPR_QR_V1',
    'version=1',
    `bundle_id=${bundle.bundleId}`,
    `title=${bundle.title}`,
    `item_count=${bundle.items.length}`,
  ];

  for (let i = 0; i < bundle.items.length; i++) {
    const item = bundle.items[i];
    lines.push(`item${i + 1}_label=${item.label}`);
    lines.push(`item${i + 1}_file=code${String(i + 1).padStart(2, '0')}.bmp`);
  }

  return lines.join('\n');
}

/**
 * Generate bundle ID from title.
 */
export function makeQrBundleId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  const hash = simpleHash(title).toString(16).substring(0, 8);
  return slug ? `qr-${slug}-${hash}` : `qr-${hash}`;
}

function rgbaToGrayscale(data: Uint8ClampedArray): Uint8Array {
  const gray = new Uint8Array(data.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
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
