/**
 * EPRF font binary format writer.
 * Produces font.bin files compatible with the EPD firmware.
 *
 * Format:
 *   Header (20 bytes): magic "EPRF" + version(1) + glyph_count + line_height + baseline + reserved
 *   Glyph entries (24 bytes each): codepoint + bitmap_offset + bitmap_size + adv_w + box_w + box_h + ofs_x + ofs_y + bpp + stride
 *   Bitmap data: concatenated glyph bitmaps
 */

import type { GlyphBitmap, BdfFont } from './bdf-parser';

const MAGIC = 0x46525045; // "EPRF" in little-endian
const VERSION = 1;
const HEADER_SIZE = 20;
const GLYPH_ENTRY_SIZE = 24;

/**
 * Build an EPRF font.bin from a subset of glyphs.
 */
export function buildEprfFont(
  font: BdfFont,
  codepoints: number[]
): ArrayBuffer {
  // Filter to glyphs that exist in the font
  const subset: GlyphBitmap[] = [];
  for (const cp of codepoints) {
    const glyph = font.glyphs.get(cp);
    if (glyph) {
      subset.push(glyph);
    }
  }

  // Sort by codepoint for binary search on device
  subset.sort((a, b) => a.codepoint - b.codepoint);

  const glyphCount = subset.length;
  const tableSize = glyphCount * GLYPH_ENTRY_SIZE;
  const bitmapBaseOffset = HEADER_SIZE + tableSize;

  // Calculate total bitmap size and offsets
  let bitmapTotal = 0;
  const bitmapOffsets: number[] = [];
  const bitmapSizes: number[] = [];

  for (const glyph of subset) {
    bitmapOffsets.push(bitmapTotal);
    const size = glyph.stride * glyph.height;
    bitmapSizes.push(size);
    bitmapTotal += size;
  }

  const totalSize = bitmapBaseOffset + bitmapTotal;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // --- Header ---
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, glyphCount, true);
  view.setUint16(12, font.lineHeight, true);
  view.setUint16(14, font.baseline, true);
  view.setUint32(16, bitmapBaseOffset, true); // bitmap data offset

  // --- Glyph table ---
  for (let i = 0; i < glyphCount; i++) {
    const glyph = subset[i];
    const off = HEADER_SIZE + i * GLYPH_ENTRY_SIZE;

    view.setUint32(off, glyph.codepoint, true);
    view.setUint32(off + 4, bitmapOffsets[i], true);
    view.setUint32(off + 8, bitmapSizes[i], true);
    view.setUint16(off + 12, glyph.advance, true);
    view.setUint8(off + 14, glyph.width);
    view.setUint8(off + 15, glyph.height);
    view.setInt8(off + 16, glyph.ofsX);
    view.setInt8(off + 17, glyph.ofsY);
    view.setUint8(off + 18, 1); // bpp = 1
    view.setUint8(off + 19, glyph.stride);
    // bytes 20-23 reserved
  }

  // --- Bitmap data ---
  let writePos = bitmapBaseOffset;
  for (let i = 0; i < glyphCount; i++) {
    const glyph = subset[i];
    bytes.set(glyph.rows, writePos);
    writePos += bitmapSizes[i];
  }

  return buf;
}

/**
 * Load seed text from a file content string.
 * Returns the text content for codepoint extraction.
 */
export function extractSeedText(content: string): string {
  return content;
}
