/**
 * Normalizer test — run with: npx tsx test-normalize.ts
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { normalizeNovel } from './src/core/book/normalize'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, 'test-fixtures')

interface TestCase {
  name: string
  file: string
  expectTitle: string
  expectAuthor?: string
  expectChapterCount: number
  expectFirstChapter: string
  expectNoDoubleBlankLines?: boolean
  expectContinuation?: boolean
  expectChapterTitles?: string[]
  expectIndentClean?: boolean
  expectWindowsNewlines?: boolean
}

const tests: TestCase[] = [
  {
    name: 'standard (single blank line)',
    file: 'standard.txt',
    expectTitle: '测试小说',
    expectAuthor: '张三',
    expectChapterCount: 3,
    expectFirstChapter: '第一章 初遇',
  },
  {
    name: 'double blank lines',
    file: 'double-blank.txt',
    expectTitle: '双空行格式',
    expectAuthor: '李四',
    expectChapterCount: 3,
    expectFirstChapter: '第一章 开始',
    expectNoDoubleBlankLines: true,
  },
  {
    name: 'no blank lines',
    file: 'no-blank.txt',
    expectTitle: '无空行格式',
    expectAuthor: '王五',
    expectChapterCount: 3,
    expectFirstChapter: '第一章 开始',
    expectNoDoubleBlankLines: true,
  },
  {
    name: 'english gutenberg',
    file: 'english-gutenberg.txt',
    expectTitle: 'Chapter 1 The Beginning',
    expectChapterCount: 3,
    expectFirstChapter: 'Chapter 1 The Beginning',
  },
  {
    name: 'chinese numerals',
    file: 'chinese-numerals.txt',
    expectTitle: '中文数字章节',
    expectAuthor: '赵六',
    expectChapterCount: 3,
    expectFirstChapter: '第十二章 风起',
  },
  {
    name: 'english continuation lines',
    file: 'english-continuation.txt',
    expectTitle: 'Chapter 1',
    expectChapterCount: 2,
    expectFirstChapter: 'Chapter 1',
    expectContinuation: true,
  },
  {
    name: 'mixed header with separator',
    file: 'mixed-header.txt',
    expectTitle: '混合格式',
    expectAuthor: '测试',
    expectChapterCount: 3,
    expectFirstChapter: '第1章 序章',
  },
  {
    name: 'edge cases (卷/回/缩进/数字章)',
    file: 'edge-cases.txt',
    expectTitle: '边缘场景测试',
    expectAuthor: '测试员B',
    expectChapterCount: 7,
    expectFirstChapter: '卷一 开篇',
    expectChapterTitles: [
      '卷一 开篇',
      '卷二 发展',
      '123章 数字章节',
      '第四十二回 古代格式',
      '序章 没有第',
      '第五章 正常章节',
      'Chapter 10 English Again',
    ],
    expectIndentClean: true,
  },
  {
    name: 'comprehensive (all scenarios)',
    file: 'comprehensive.txt',
    expectTitle: '综合格式测试',
    expectAuthor: '测试大师',
    expectChapterCount: 11,
    expectFirstChapter: '第一章 标准双空行分段',
    expectNoDoubleBlankLines: true,
    expectIndentClean: true,
    expectContinuation: true,
    expectChapterTitles: [
      '第一章 标准双空行分段',
      '第二章 多空行应该被压缩',
      '第三章 没有空行的连续内容',
      '第四章 缩进测试',
      '第五章 混合中英文',
      '123章 纯数字章节标记',
      '第四十二回 传统章回体',
      '卷一 卷册格式',
      '序章 无"第"字的特殊标记',
      'Chapter 9 English Chapter',
      'Chapter 10 Final',
    ],
  },
  {
    name: 'windows line endings (\\r\\n)',
    file: 'windows-line-endings.txt',
    expectTitle: 'Windows换行',
    expectAuthor: '测试员C',
    expectChapterCount: 2,
    expectFirstChapter: '第一章 测试',
    expectWindowsNewlines: true,
  },
]

let passed = 0
let failed = 0

for (const t of tests) {
  const raw = readFileSync(join(FIXTURES, t.file), 'utf-8')
  const result = normalizeNovel(raw)
  const errors: string[] = []

  if (result.title !== t.expectTitle) {
    errors.push(`title: got "${result.title}", want "${t.expectTitle}"`)
  }
  if (t.expectAuthor !== undefined && result.author !== t.expectAuthor) {
    errors.push(`author: got "${result.author}", want "${t.expectAuthor}"`)
  }
  if (result.chapters.length !== t.expectChapterCount) {
    errors.push(`chapters: got ${result.chapters.length}, want ${t.expectChapterCount}`)
    console.log(`    actual chapters: ${result.chapters.map(c => c.title).join(' | ')}`)
  }
  if (result.chapters.length > 0 && result.chapters[0].title !== t.expectFirstChapter) {
    errors.push(`first chapter: got "${result.chapters[0].title}", want "${t.expectFirstChapter}"`)
  }
  if (t.expectNoDoubleBlankLines && /\n\n\n/.test(result.text)) {
    errors.push('found triple+ blank lines')
  }
  if (t.expectContinuation) {
    if (!result.text.includes('continues on the next line') && !result.text.includes('paragraph that continues')) {
      errors.push('continuation lines not merged')
    }
  }
  if (t.expectChapterTitles) {
    const actual = result.chapters.map(c => c.title)
    for (let i = 0; i < t.expectChapterTitles.length; i++) {
      if (actual[i] !== t.expectChapterTitles[i]) {
        errors.push(`chapter[${i}]: got "${actual[i]}", want "${t.expectChapterTitles[i]}"`)
      }
    }
  }
  if (t.expectIndentClean) {
    // Check no lines start with spaces or full-width spaces
    const hasIndent = result.text.split('\n').some(l => /^[\s\u3000]/.test(l))
    if (hasIndent) {
      errors.push('found indented lines in output')
    }
  }
  if (t.expectWindowsNewlines) {
    if (/\r/.test(result.text)) {
      errors.push('found \\r in output')
    }
  }

  if (errors.length === 0) {
    console.log(`  ✓ ${t.name}`)
    passed++
  } else {
    console.log(`  ✗ ${t.name}`)
    for (const e of errors) console.log(`    - ${e}`)
    failed++
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
