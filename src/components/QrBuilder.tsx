import { useState, useCallback } from 'react'
import { Download, Scissors } from 'lucide-react'
import JSZip from 'jszip'
import { generateQrBmp, formatQrMeta, makeQrBundleId } from '../core/qr/generate'
import { writeBmp1bit, thresholdPixels, imageDataToGrayscale } from '../core/bmp/writer'
import ImageCropper from './common/ImageCropper'

const MAX_ITEMS = 8
const QR_SIZE = 128

interface QrItemState {
  enabled: boolean; mode: 'qr' | 'image'; label: string; value: string
  imageFile: File | null; croppedBlob: Blob | null; preview: string | null
}

export default function QrBuilder() {
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<QrItemState[]>(
    Array.from({ length: MAX_ITEMS }, (_, i) => ({
      enabled: i < 2, mode: 'qr' as const, label: '', value: '',
      imageFile: null, croppedBlob: null, preview: null,
    }))
  )
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null)
  const [status, setStatus] = useState('ready')
  const [log, setLog] = useState<string[]>([])

  const appendLog = useCallback((msg: string) => {
    setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  const updateItem = useCallback((index: number, updates: Partial<QrItemState>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item))
  }, [])

  const handleImageSelect = useCallback((index: number, file: File) => {
    updateItem(index, { imageFile: file, croppedBlob: null }); setCroppingIndex(index)
  }, [updateItem])

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    if (croppingIndex === null) return
    updateItem(croppingIndex, { croppedBlob: blob, preview: URL.createObjectURL(blob) }); setCroppingIndex(null)
  }, [croppingIndex, updateItem])

  const handleBuild = useCallback(async () => {
    if (!title.trim()) { appendLog('Error: enter a title'); return }
    const enabledItems = items.filter(item => item.enabled)
    if (!enabledItems.length) { appendLog('Error: enable at least one item'); return }
    for (let i = 0; i < enabledItems.length; i++) {
      const item = enabledItems[i]; const idx = items.indexOf(item) + 1
      if (!item.label.trim()) { appendLog(`Error: item ${idx} missing label`); return }
      if (item.mode === 'qr' && !item.value.trim()) { appendLog(`Error: item ${idx} QR content empty`); return }
      if (item.mode === 'image' && !item.croppedBlob) { appendLog(`Error: item ${idx} image not cropped`); return }
    }
    try {
      setStatus('generating...')
      const bundleId = makeQrBundleId(title); appendLog(`Bundle ID: ${bundleId}`)
      const files: { name: string; blob: Blob }[] = []
      const activeItems = enabledItems.filter(item => (item.mode === 'qr' && item.value.trim()) || (item.mode === 'image' && item.croppedBlob))
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i]; const fileName = `code${String(i + 1).padStart(2, '0')}.bmp`
        let bmpData: ArrayBuffer
        if (item.mode === 'qr') {
          appendLog(`QR: ${item.label || item.value}`); bmpData = await generateQrBmp(item.value)
        } else {
          if (!item.croppedBlob) continue; appendLog(`Image: ${item.label}`)
          const imgData = await createImageBitmap(new Blob([await item.croppedBlob.arrayBuffer()]))
          const canvas = document.createElement('canvas'); canvas.width = QR_SIZE; canvas.height = QR_SIZE
          const ctx = canvas.getContext('2d')!; ctx.drawImage(imgData, 0, 0, QR_SIZE, QR_SIZE)
          const gray = imageDataToGrayscale(ctx.getImageData(0, 0, QR_SIZE, QR_SIZE))
          bmpData = writeBmp1bit({ width: QR_SIZE, height: QR_SIZE, pixels: thresholdPixels(gray, 160) })
        }
        files.push({ name: `${bundleId}/${fileName}`, blob: new Blob([bmpData]) })
      }
      const meta = formatQrMeta({ title, bundleId, items: activeItems.map((item, i) => ({ label: item.label || `QR ${i + 1}`, payload: item.value, sourceKind: item.mode })) })
      files.push({ name: `${bundleId}/qr.meta`, blob: new Blob([meta]) })
      setStatus('done'); appendLog(`Done! ${files.length} files`)
      const zip = new JSZip(); for (const f of files) zip.file(f.name, f.blob)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${bundleId}.zip`; a.click(); URL.revokeObjectURL(url)
    } catch (err) { setStatus('error'); appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`) }
  }, [title, items, appendLog])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">QR 码制作</h1>
        <p className="text-base text-gray-400 mt-3">生成二维码图片包，传输到 EPaper 设备显示</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">包名称</h2>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder="例如：收款码、常用链接"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none placeholder:text-gray-300" />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">内容项（最多 {MAX_ITEMS} 个）</h2>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className={`border rounded-lg p-5 transition-all ${item.enabled ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-50/30 opacity-40'}`}>
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" checked={item.enabled} onChange={e => updateItem(index, { enabled: e.target.checked })} className="rounded" />
                <span className="text-xs font-mono text-gray-400 w-5">{index + 1}</span>
                <select value={item.mode} onChange={e => updateItem(index, { mode: e.target.value as 'qr' | 'image', value: '', croppedBlob: null, preview: null })} disabled={!item.enabled}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white">
                  <option value="qr">二维码</option><option value="image">图片</option>
                </select>
                <input type="text" value={item.label} onChange={e => updateItem(index, { label: e.target.value })} placeholder="标签名称" disabled={!item.enabled}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div className="flex items-center gap-3 pl-8">
                {item.mode === 'qr' ? (
                  <input type="text" value={item.value} onChange={e => updateItem(index, { value: e.target.value })} placeholder="URL 或文本内容" disabled={!item.enabled}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs" />
                ) : (
                  <div className="flex-1 flex items-center gap-3">
                    <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.onchange = () => { const f = inp.files?.[0]; if (f) handleImageSelect(index, f) }; inp.click() }} disabled={!item.enabled}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-100 transition-colors">选择图片</button>
                    {item.croppedBlob && <button onClick={() => setCroppingIndex(index)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-100 transition-colors flex items-center gap-1"><Scissors size={12} />重新裁剪</button>}
                    <span className="text-xs text-gray-400">{item.croppedBlob ? '已裁剪' : item.imageFile ? '待裁剪' : ''}</span>
                  </div>
                )}
                {item.preview && <img src={item.preview} alt="" className="w-12 h-12 border border-gray-200 rounded" style={{ imageRendering: 'pixelated' }} />}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">生成</h2>
        <div className="flex items-center gap-4">
          <button onClick={handleBuild}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm flex items-center gap-2">
            <Download size={16} />生成并下载
          </button>
          <span className="text-xs text-gray-400 ml-auto">{status}</span>
        </div>
      </section>

      {log.length > 0 && (
        <section className="bg-gray-900 text-gray-300 rounded-xl p-4 font-mono text-xs max-h-48 overflow-auto leading-relaxed">
          {log.map((line, i) => (<div key={i} className={line.includes('Error') ? 'text-red-400' : ''}>{line}</div>))}
        </section>
      )}

      {croppingIndex !== null && items[croppingIndex].imageFile && (
        <ImageCropper file={items[croppingIndex].imageFile!} targetSize={QR_SIZE} onConfirm={handleCropConfirm} onCancel={() => setCroppingIndex(null)} />
      )}
    </div>
  )
}
