/**
 * BDF bitmap font parser.
 * Parses BDF font files and extracts glyph bitmaps.
 */

export interface GlyphBitmap {
  codepoint: number;
  width: number;
  height: number;
  stride: number;
  advance: number;
  ofsX: number;
  ofsY: number;
  rows: Uint8Array;
}

export interface BdfFont {
  glyphs: Map<number, GlyphBitmap>;
  lineHeight: number;
  baseline: number;
}

/**
 * Parse a BDF font file and return all glyphs.
 */
export function parseBdf(text: string): BdfFont {
  const glyphs = new Map<number, GlyphBitmap>();
  const lines = text.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith('STARTCHAR ')) {
      i++;
      continue;
    }

    let encoding = -1;
    let dwidthX = 0;
    let bbxW = 0, bbxH = 0, bbxXoff = 0, bbxYoff = 0;
    const bitmapRows: string[] = [];
    let inBitmap = false;

    while (i < lines.length) {
      const l = lines[i].trim();

      if (l.startsWith('ENCODING ')) {
        encoding = parseInt(l.split(' ')[1], 10);
      } else if (l.startsWith('DWIDTH ')) {
        const parts = l.split(/\s+/);
        dwidthX = parseInt(parts[1], 10);
      } else if (l.startsWith('BBX ')) {
        const parts = l.split(/\s+/);
        bbxW = parseInt(parts[1], 10);
        bbxH = parseInt(parts[2], 10);
        bbxXoff = parseInt(parts[3], 10);
        bbxYoff = parseInt(parts[4], 10);
      } else if (l === 'BITMAP') {
        inBitmap = true;
      } else if (l === 'ENDCHAR') {
        break;
      } else if (inBitmap && /^[0-9A-Fa-f]+$/.test(l)) {
        bitmapRows.push(l);
      }

      i++;
    }

    if (encoding >= 0 && bitmapRows.length > 0) {
      const stride = Math.floor((bbxW + 7) / 8);
      const rows = new Uint8Array(stride * bbxH);

      for (let row = 0; row < bitmapRows.length && row < bbxH; row++) {
        const hex = bitmapRows[row];
        for (let byteIdx = 0; byteIdx < stride; byteIdx++) {
          const hexStart = byteIdx * 2;
          if (hexStart + 2 <= hex.length) {
            rows[row * stride + byteIdx] = parseInt(hex.substring(hexStart, hexStart + 2), 16);
          }
        }
      }

      glyphs.set(encoding, {
        codepoint: encoding,
        width: bbxW,
        height: bbxH,
        stride,
        advance: dwidthX,
        ofsX: bbxXoff,
        ofsY: -(bbxYoff + bbxH),
        rows,
      });
    }

    i++;
  }

  // Extract global metrics
  let ascent = 14;
  let descent = 2;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('FONT_ASCENT ')) {
      ascent = parseInt(trimmed.split(' ')[1], 10);
    } else if (trimmed.startsWith('FONT_DESCENT ')) {
      descent = parseInt(trimmed.split(' ')[1], 10);
    }
  }

  return {
    glyphs,
    lineHeight: ascent + descent,
    baseline: ascent,
  };
}

/**
 * Extract unique codepoints (>= 0x20) from text, sorted.
 */
export function uniqueCodepoints(text: string): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    if (cp < 0x20) continue;
    if (seen.has(cp)) continue;
    seen.add(cp);
    out.push(cp);
    if (cp > 0xFFFF) i++; // surrogate pair
  }
  out.sort((a, b) => a - b);
  return out;
}
