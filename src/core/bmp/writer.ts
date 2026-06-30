/**
 * 1-bit BMP file writer for e-paper display.
 * Produces monochrome BMP files compatible with the EPD firmware.
 */

export interface BmpOptions {
  width: number;
  height: number;
  pixels: Uint8Array; // 1 byte per pixel, 0=black, 255=white
}

/**
 * Create a 1-bit BMP file from pixel data.
 * pixels: row-major, 1 byte per pixel (0=black, 255=white).
 * Returns ArrayBuffer of the BMP file.
 */
export function writeBmp1bit(opts: BmpOptions): ArrayBuffer {
  const { width, height, pixels } = opts;
  const rowStride = Math.floor((width + 31) / 32) * 4; // 4-byte aligned
  const pixelOffset = 14 + 40 + 8; // file header + info header + palette
  const fileSize = pixelOffset + rowStride * height;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // --- File Header (14 bytes) ---
  bytes[0] = 0x42; // 'B'
  bytes[1] = 0x4D; // 'M'
  view.setUint32(2, fileSize, true);
  // reserved = 0
  view.setUint32(10, pixelOffset, true);

  // --- Info Header (BITMAPINFOHEADER, 40 bytes) ---
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 1, true); // bpp
  view.setUint32(30, 0, true); // no compression
  view.setUint32(34, rowStride * height, true); // image size
  view.setInt32(38, 2835, true); // ppm X (72 dpi)
  view.setInt32(42, 2835, true); // ppm Y
  view.setUint32(46, 2, true); // colors used (black + white)
  view.setUint32(50, 2, true); // important colors

  // --- Palette (2 entries, 8 bytes) ---
  const palOff = 54;
  // Entry 0: black
  bytes[palOff] = 0x00;
  bytes[palOff + 1] = 0x00;
  bytes[palOff + 2] = 0x00;
  bytes[palOff + 3] = 0x00;
  // Entry 1: white
  bytes[palOff + 4] = 0xFF;
  bytes[palOff + 5] = 0xFF;
  bytes[palOff + 6] = 0xFF;
  bytes[palOff + 7] = 0x00;

  // --- Pixel Data (bottom-up, 1-bit, MSB first) ---
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // BMP is bottom-up
    const dstOff = pixelOffset + y * rowStride;
    for (let byteIdx = 0; byteIdx < rowStride; byteIdx++) {
      let val = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = byteIdx * 8 + bit;
        if (x < width) {
          const srcIdx = srcRow * width + x;
          // pixel 0=black → bit=0, pixel 255=white → bit=1
          if (pixels[srcIdx] !== 0) {
            val |= 1 << (7 - bit);
          }
        }
      }
      bytes[dstOff + byteIdx] = val;
    }
  }

  return buf;
}

/**
 * Convert RGBA ImageData to 1-byte-per-pixel grayscale.
 * Returns Uint8Array where 0=black, 255=white.
 */
export function imageDataToGrayscale(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/**
 * Apply threshold to grayscale pixels → binary (0=black, 255=white).
 */
export function thresholdPixels(gray: Uint8Array, threshold: number): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = gray[i] >= threshold ? 255 : 0;
  }
  return out;
}

/**
 * Resize image using canvas, return pixel data.
 */
export function resizeImage(
  source: HTMLImageElement | HTMLCanvasElement,
  targetW: number,
  targetH: number,
  mode: 'fit' | 'crop' = 'fit'
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, targetW, targetH);

  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  if (mode === 'crop') {
    const scale = Math.max(targetW / srcW, targetH / srcH);
    const sw = targetW / scale;
    const sh = targetH / scale;
    const sx = (srcW - sw) / 2;
    const sy = (srcH - sh) / 2;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetW, targetH);
  } else {
    // fit mode: scale to fit, center with white padding
    const scale = Math.min(targetW / srcW, targetH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (targetW - dw) / 2;
    const dy = (targetH - dh) / 2;
    ctx.drawImage(source, dx, dy, dw, dh);
  }

  return ctx.getImageData(0, 0, targetW, targetH);
}

/**
 * Load an image from File, return HTMLImageElement.
 */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
