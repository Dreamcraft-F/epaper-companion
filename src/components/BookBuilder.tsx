import { useState, useCallback, useRef } from 'react'
import { BookOpen, Download } from 'lucide-react'
import JSZip from 'jszip'
import { normalizeNovel, formatChaptersIdx, formatBookMeta, makeBookId, decodeText } from '../core/book/normalize'
import { parseBdf, uniqueCodepoints } from '../core/font/bdf-parser'
import { buildEprfFont } from '../core/font/eprf-writer'
import { downloadBlob } from '../core/download'

const FONT_URL = '/fonts/wenquanyi_12pt.bdf'
const SEED_URL = '/seed/reader_font_seed.txt'

interface BookResult {
  bookId: string; title: string; author: string; chapterCount: number
  files: { name: string; blob: Blob }[]
}

export default function BookBuilder() {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [status, setStatus] = useState('ready')
  const [log, setLog] = useState<string[]>([])
  const [result, setResult] = useState<BookResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileDataRef = useRef<ArrayBuffer | null>(null)

  const appendLog = useCallback((msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    const buffer = await file.arrayBuffer()
    fileDataRef.current = buffer
    appendLog(`Loaded: ${file.name} (${(buffer.byteLength / 1024).toFixed(1)} KB)`)
  }, [appendLog])

  const handleBuild = useCallback(async () => {
    if (!fileDataRef.current) { appendLog('Error: select a TXT file first'); return }
    try {
      setStatus('processing...')
      appendLog('Processing...')
      const text = decodeText(fileDataRef.current)
      if (!text || text.trim().length === 0) { appendLog('Error: file is empty'); setStatus('error'); return }

      const novel = normalizeNovel(text)
      const finalTitle = title || novel.title
      const finalAuthor = author || novel.author

      appendLog(`Title: ${finalTitle}`)
      appendLog(`Author: ${finalAuthor || '(unknown)'}`)
      appendLog(`Chapters: ${novel.chapters.length}`)

      const bookId = makeBookId(finalTitle)
      appendLog(`Book ID: ${bookId}`)

      setStatus('generating font...')
      const [fontResp, seedResp] = await Promise.all([fetch(FONT_URL), fetch(SEED_URL)])
      if (!fontResp.ok) throw new Error('Font file not found')
      const fontText = await fontResp.text()
      const font = parseBdf(fontText)
      appendLog(`BDF font: ${font.glyphs.size} glyphs`)

      let seedText = seedResp.ok ? await seedResp.text() : ''
      const allText = novel.text + '\n' + formatChaptersIdx(novel.chapters) + '\n' + seedText
      const codepoints = uniqueCodepoints(allText)
      appendLog(`Characters needed: ${codepoints.length}`)

      const fontBin = buildEprfFont(font, codepoints)
      appendLog(`font.bin: ${(fontBin.byteLength / 1024).toFixed(1)} KB`)

      const meta = formatBookMeta({
        bookId, title: finalTitle, author: finalAuthor,
        chapterCount: novel.chapters.length, fontGlyphCount: codepoints.length,
        fontLineHeight: font.lineHeight, fontBaseline: font.baseline,
      })

      const enc = new TextEncoder()
      const files = [
        { name: `${bookId}/book.txt`, blob: new Blob([enc.encode(novel.text)]) },
        { name: `${bookId}/chapters.idx`, blob: new Blob([enc.encode(formatChaptersIdx(novel.chapters))]) },
        { name: `${bookId}/book.meta`, blob: new Blob([enc.encode(meta)]) },
        { name: `${bookId}/font.bin`, blob: new Blob([fontBin]) },
      ]

      setStatus('done')
      appendLog(`Done! ${files.length} files`)
      setResult({ bookId, title: finalTitle, author: finalAuthor, chapterCount: novel.chapters.length, files })
    } catch (err) {
      setStatus('error')
      appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [title, author, appendLog])

  const handleDownload = useCallback(async () => {
    if (!result) return
    const zip = new JSZip()
    for (const f of result.files) zip.file(f.name, f.blob)
    const blob = await zip.generateAsync({ type: 'blob' })
    await downloadBlob(blob, `${result.bookId}.zip`)
  }, [result])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">书籍打包</h1>
        <p className="text-base text-gray-400 mt-3">将 TXT 小说转换为 EPaper 阅读器专用格式</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">1. 选择文件</h2>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt'; inp.onchange = () => { const f = inp.files?.[0]; if (f) handleFile(f) }; inp.click() }}
          className={`border-2 border-dashed rounded-xl py-14 text-center cursor-pointer transition-all ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
        >
          <BookOpen size={44} className="mx-auto mb-4 text-gray-300" />
          {fileName ? (
            <div>
              <p className="text-base font-medium text-gray-700">{fileName}</p>
              <p className="text-sm text-gray-400 mt-2">点击更换文件</p>
            </div>
          ) : (
            <div>
              <p className="text-base text-gray-500">拖放 TXT 文件到此处，或点击选择</p>
              <p className="text-sm text-gray-400 mt-2">支持 UTF-8、GBK、GB18030 编码</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">2. 书籍信息</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">书名</label>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="留空则自动从文件中提取"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none placeholder:text-gray-300"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">作者</label>
            <input
              type="text" value={author} onChange={e => setAuthor(e.target.value)}
              placeholder="留空则自动从文件中提取"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none placeholder:text-gray-300"
            />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">3. 打包</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={handleBuild}
            disabled={!fileDataRef.current}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            开始打包
          </button>
          {result && (
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm flex items-center gap-2"
            >
              <Download size={16} />
              下载 ZIP
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{status}</span>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm font-medium text-emerald-800">
              {result.title} · {result.chapterCount} 章 · {result.files.length} 个文件
            </p>
          </div>
        )}
      </section>

      {log.length > 0 && (
        <section className="bg-gray-900 text-gray-300 rounded-xl p-4 font-mono text-xs max-h-48 overflow-auto leading-relaxed">
          {log.map((line, i) => (
            <div key={i} className={line.includes('Error') ? 'text-red-400' : ''}>{line}</div>
          ))}
        </section>
      )}
    </div>
  )
}
