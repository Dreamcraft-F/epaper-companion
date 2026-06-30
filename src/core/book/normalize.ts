/**
 * TXT novel normalizer — full port of build_book_package.py.
 */

export interface NormalizeResult {
  title: string;
  author: string;
  text: string;
  chapters: ChapterInfo[];
}

export interface ChapterInfo {
  index: number;
  title: string;
  byteOffset: number;
}

const DISALLOWED_CODEPOINTS = new Set([
  0x02D8, 0x0300, 0x0301, 0x0325, 0x0942, 0x0CA1, 0x10E6, 0x2323,
]);

const NUMERAL_CHARS = new Set(
  '0123456789零一二三四五六七八九十百千万两'.split('')
);
const SECTION_MARKS = new Set('章卷部回节篇幕集'.split(''));

// Patterns that start with a section mark (卷一、部二 etc.)
const LEADING_SECTION_MARKS = new Set('卷部'.split(''));

export function decodeText(buffer: ArrayBuffer): string {
  const decoders = ['utf-8-sig', 'utf-8', 'gbk', 'gb18030'];
  for (const enc of decoders) {
    try {
      const dec = new TextDecoder(enc, { fatal: true });
      return dec.decode(buffer);
    } catch { /* try next */ }
  }
  return new TextDecoder('utf-8').decode(buffer);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.substring(1) : text;
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripDecorativeNoise(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)!;
    if (!DISALLOWED_CODEPOINTS.has(cp)) {
      out += text[i];
      if (cp > 0xFFFF) i++; // surrogate pair
    }
  }
  return out;
}

function stripGutenbergWrapper(text: string): string {
  const startMarker = '*** START OF THE PROJECT GUTENBERG EBOOK';
  const endMarker = '*** END OF THE PROJECT GUTENBERG EBOOK';
  let si = text.indexOf(startMarker);
  if (si >= 0) {
    si = text.indexOf('\n', si);
    text = si >= 0 ? text.substring(si + 1) : text;
  }
  const ei = text.indexOf(endMarker);
  if (ei >= 0) {
    text = text.substring(0, ei);
  }
  return text;
}

function stripBookInfoHeader(text: string): string {
  const lines = text.split('\n');
  if (!lines.length) return text;
  const first = lines[0].trim();
  if (first !== '书籍信息' && first !== '作品相关' && first !== '正文') {
    return text;
  }
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const s = lines[i].trim();
    if (s && s.length >= 8 && /^[-—_=]+$/.test(s)) {
      return lines.slice(i + 1).join('\n');
    }
  }
  return text;
}

function isChapterTitle(line: string): boolean {
  const s = line.trim();
  if (s.length < 2 || s.length > 50) return false;
  // English patterns
  if (/^Chapter\s+\d+/i.test(s)) return true;
  // Pattern: digits + 章 (e.g. "123章 xxx", "1章")
  if (/^\d{1,5}章(\s|$)/.test(s)) return true;
  // Pattern: section mark + numerals (e.g. "卷一 xxx", "部二")
  if (LEADING_SECTION_MARKS.has(s[0])) {
    let sawNumeral = false;
    for (let i = 1; i < Math.min(s.length, 16); i++) {
      if (NUMERAL_CHARS.has(s[i])) { sawNumeral = true; continue; }
      if (s[i] === ' ' || s[i] === '\t') return sawNumeral;
      return false;
    }
    return sawNumeral;
  }
  // Pattern: 第 + numerals + section mark (e.g. "第十二章", "第三回")
  if (s.startsWith('第')) {
    let sawNumeral = false;
    for (let i = 1; i < Math.min(s.length, 16); i++) {
      const ch = s[i];
      if (NUMERAL_CHARS.has(ch)) { sawNumeral = true; continue; }
      if (SECTION_MARKS.has(ch)) return sawNumeral;
      return false;
    }
    return false;
  }
  // Pattern: 序章/楔子/引子 (common Chinese novel preamble markers)
  if (/^(序章|楔子|引子|尾声|终章|后记|番外)(\s|$)/.test(s)) return true;
  return false;
}

function mergeParagraphLines(lines: string[]): string[] {
  const merged: string[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      if (merged.length && merged[merged.length - 1] !== '') {
        merged.push('');
      }
      continue;
    }
    if (merged.length && merged[merged.length - 1] !== '') {
      const prev = merged[merged.length - 1];
      // English alphanumeric continuation: add space
      const prevLast = prev[prev.length - 1];
      const curFirst = stripped[0];
      if (isAsciiAlnum(prevLast) && isAsciiAlnum(curFirst)) {
        merged[merged.length - 1] = prev + ' ' + stripped;
      } else {
        merged[merged.length - 1] = prev + stripped;
      }
    } else {
      merged.push(stripped);
    }
  }
  // Remove trailing empty lines
  while (merged.length && merged[merged.length - 1] === '') {
    merged.pop();
  }
  return merged;
}

function isAsciiAlnum(ch: string): boolean {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A);
}

function detectTitle(text: string): string {
  for (const line of text.split('\n').slice(0, 40)) {
    const s = line.trim();
    if (s && s.startsWith('书名：')) {
      return s.substring(3).trim() || '';
    }
  }
  for (const line of text.split('\n').slice(0, 10)) {
    const s = line.trim();
    if (s && s.length <= 30 && !/^[-—_=]/.test(s)) {
      return s;
    }
  }
  return '';
}

function detectAuthor(text: string): string {
  for (const line of text.split('\n').slice(0, 40)) {
    const s = line.trim();
    if (s && s.startsWith('作者：')) {
      return s.substring(3).trim();
    }
  }
  const m = text.match(/(?:作者|著|by)[：:\s]*(.{2,10})/i);
  return m ? m[1].trim() : '';
}

/**
 * Main normalization pipeline — matches Python normalize_text() + build_chapters_from_normalized().
 */
export function normalizeNovel(input: string): NormalizeResult {
  // Extract title/author from raw text BEFORE any stripping
  const rawTitle = detectTitle(stripBom(normalizeNewlines(input)));
  const rawAuthor = detectAuthor(stripBom(normalizeNewlines(input)));

  let text = stripBom(input);
  text = normalizeNewlines(text);
  text = stripDecorativeNoise(text);
  text = stripGutenbergWrapper(text);
  text = stripBookInfoHeader(text);

  // Line-level cleanup
  let lines = text.split('\n');
  lines = lines.map(l => l.replace(/^[\s\u3000]+/, '').replace(/[\s\u3000]+$/, ''));

  // Skip content before first chapter
  let firstChapter = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isChapterTitle(lines[i])) {
      firstChapter = i;
      break;
    }
  }
  if (firstChapter >= 0) {
    lines = lines.slice(firstChapter);
  } else {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) { lines = lines.slice(i); break; }
    }
  }

  // Compress multiple blank lines to single
  const compressed: string[] = [];
  let blankPending = false;
  for (const line of lines) {
    const s = line.trim();
    if (!s) {
      if (!blankPending && compressed.length) compressed.push('');
      blankPending = true;
      continue;
    }
    compressed.push(s);
    blankPending = false;
  }
  while (compressed.length && compressed[0] === '') compressed.shift();
  while (compressed.length && compressed[compressed.length - 1] === '') compressed.pop();

  // Build chapters by scanning lines, then merge paragraphs within each chapter
  // This matches Python's build_chapters_from_normalized logic
  const encoder = new TextEncoder();
  const paragraphs: string[] = [];
  const chapters: ChapterInfo[] = [];
  let currentParaLines: string[] = [];
  let pendingChapterTitle: string | null = null;
  let bytePos = 0;
  let chapterNo = 1;

  const flushParagraph = () => {
    // First: commit any pending chapter title
    if (pendingChapterTitle !== null) {
      const chapterOffset = paragraphs.length > 0 ? bytePos + 1 : bytePos;
      chapters.push({ index: chapterNo, title: pendingChapterTitle, byteOffset: chapterOffset });
      chapterNo++;
      pendingChapterTitle = null;
    }

    if (!currentParaLines.length) return;
    const mergedLines = mergeParagraphLines(currentParaLines);
    if (!mergedLines.length) { currentParaLines = []; return; }
    const merged = mergedLines[0];

    if (paragraphs.length) bytePos += 1; // second \n of \n\n separator (first \n is in the previous paragraph's +1)
    paragraphs.push(merged);
    bytePos += encoder.encode(merged).length + 1; // +1 for trailing \n
    currentParaLines = [];
  };

  for (const line of compressed) {
    if (isChapterTitle(line)) {
      flushParagraph();
      pendingChapterTitle = line.trim();
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    currentParaLines.push(line.trim());
  }
  flushParagraph();

  if (!paragraphs.length) {
    const fallbackTitle = pendingChapterTitle || '全文';
    return { title: rawTitle || 'Untitled', author: rawAuthor, text: '\n', chapters: [{ index: 1, title: fallbackTitle, byteOffset: 0 }] };
  }

  if (!chapters.length) {
    chapters.push({ index: 1, title: '全文', byteOffset: 0 });
  }

  const resultText = paragraphs.join('\n\n') + '\n';
  return { title: rawTitle || 'Untitled', author: rawAuthor, text: resultText, chapters };
}

export function formatChaptersIdx(chapters: ChapterInfo[]): string {
  return chapters.map(ch => `${ch.index}\t${ch.byteOffset}\t${ch.title}`).join('\n');
}

export function formatBookMeta(opts: {
  bookId: string; title: string; author: string;
  chapterCount: number; fontGlyphCount: number;
  fontLineHeight: number; fontBaseline: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return [
    `format=EPR_BOOK_V2`, `version=2`,
    `book_id=${opts.bookId}`, `title=${opts.title}`, `author=${opts.author}`,
    `text_file=book.txt`, `chapters_file=chapters.idx`, `font_file=font.bin`,
    `chapter_count=${opts.chapterCount}`, `font_glyph_count=${opts.fontGlyphCount}`,
    `font_line_height=${opts.fontLineHeight}`, `font_baseline=${opts.fontBaseline}`,
    `source_name=web_companion`, `imported_at=${now}`,
  ].join('\n');
}

export function makeBookId(title: string): string {
  // Only ASCII alphanumeric, _, -, . — firmware rejects anything else
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  const hash = simpleHash(title).toString(16).substring(0, 8);
  return slug ? `${slug}-${hash}` : `book-${hash}`;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
