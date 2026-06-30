import { useState, useCallback } from 'react'
import { Download, Scissors } from 'lucide-react'
import JSZip from 'jszip'
import { formatPanelMeta, makePanelBundleId } from '../core/panel/convert'
import { writeBmp1bit, thresholdPixels, imageDataToGrayscale } from '../core/bmp/writer'
import { downloadBlob } from '../core/download'
import ImageCropper from './common/ImageCropper'

const MAX_ITEMS = 6
const PANEL_SIZE = 200
const DEFAULT_THRESHOLD = 168

interface PanelItemState {
  enabled: boolean; label: string; imageFile: File | null
  croppedBlob: Blob | null; preview: string | null; threshold: number
}

export default function PanelBuilder() {
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<PanelItemState[]>(
    Array.from({ length: MAX_ITEMS }, (_, i) => ({
      enabled: i === 0, label: '', imageFile: null, croppedBlob: null, preview: null, threshold: DEFAULT_THRESHOLD,
    }))
  )
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null)
  const [status, setStatus] = useState('ready')
  const [log, setLog] = useState<string[]>([])

  const appendLog = useCallback((msg: string) => { setLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]) }, [])
  const updateItem = useCallback((index: number, updates: Partial<PanelItemState>) => { setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item)) }, [])

  const handleImageSelect = useCallback((index: number, file: File) => {
    updateItem(index, { imageFile: file, croppedBlob: null, preview: null }); setCroppingIndex(index)
  }, [updateItem])

  const handleCropConfirm = useCallback(async (blob: Blob) => {
    if (croppingIndex === null) return
    updateItem(croppingIndex, { croppedBlob: blob, preview: null }); setCroppingIndex(null)
  }, [croppingIndex, updateItem])

  const generatePreview = useCallback(async (index: number) => {
    const item = items[index]; if (!item.croppedBlob) return
    try {
      const imgData = await createImageBitmap(new Blob([await item.croppedBlob.arrayBuffer()]))
      const canvas = document.createElement('canvas'); canvas.width = PANEL_SIZE; canvas.height = PANEL_SIZE
      const ctx = canvas.getContext('2d')!; ctx.drawImage(imgData, 0, 0, PANEL_SIZE, PANEL_SIZE)
      const gray = imageDataToGrayscale(ctx.getImageData(0, 0, PANEL_SIZE, PANEL_SIZE))
      const binary = thresholdPixels(gray, item.threshold)
      const pc = document.createElement('canvas'); pc.width = PANEL_SIZE; pc.height = PANEL_SIZE
      const pctx = pc.getContext('2d')!; const pd = pctx.createImageData(PANEL_SIZE, PANEL_SIZE)
      for (let i = 0; i < binary.length; i++) { const v = binary[i]; pd.data[i*4]=v; pd.data[i*4+1]=v; pd.data[i*4+2]=v; pd.data[i*4+3]=255 }
      pctx.putImageData(pd, 0, 0); updateItem(index, { preview: pc.toDataURL('image/png') })
    } catch { /* ignore */ }
  }, [items, updateItem])

  const handleBuild = useCallback(async () => {
    if (!title.trim()) { appendLog('Error: enter a title'); return }
    const enabledItems = items.filter(item => item.enabled)
    if (!enabledItems.length) { appendLog('Error: enable at least one image'); return }
    for (let i = 0; i < enabledItems.length; i++) {
      const item = enabledItems[i]; const idx = items.indexOf(item) + 1
      if (!item.label.trim()) { appendLog(`Error: image ${idx} missing label`); return }
      if (!item.imageFile) { appendLog(`Error: image ${idx} no file`); return }
      if (!item.croppedBlob) { appendLog(`Error: image ${idx} not cropped`); return }
    }
    try {
      setStatus('generating...')
      const bundleId = makePanelBundleId(title); appendLog(`Bundle ID: ${bundleId}`)
      const files: { name: string; blob: Blob }[] = []
      const activeItems = enabledItems.filter(item => item.croppedBlob)
      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i]; if (!item.croppedBlob) continue
        appendLog(`Processing: ${item.label} threshold=${item.threshold}`)
        const imgData = await createImageBitmap(new Blob([await item.croppedBlob.arrayBuffer()]))
        const canvas = document.createElement('canvas'); canvas.width = PANEL_SIZE; canvas.height = PANEL_SIZE
        const ctx = canvas.getContext('2d')!; ctx.drawImage(imgData, 0, 0, PANEL_SIZE, PANEL_SIZE)
        const gray = imageDataToGrayscale(ctx.getImageData(0, 0, PANEL_SIZE, PANEL_SIZE))
        const binary = thresholdPixels(gray, item.threshold)
        const bmpData = writeBmp1bit({ width: PANEL_SIZE, height: PANEL_SIZE, pixels: binary })
        files.push({ name: `${bundleId}/panel${String(i+1).padStart(2,'0')}.bmp`, blob: new Blob([bmpData]) })
      }
      const meta = formatPanelMeta({ title, bundleId, items: activeItems.map(item => ({ label: item.label || 'panel', imageFile: item.imageFile! })), threshold: DEFAULT_THRESHOLD, mode: 'crop' })
      files.push({ name: `${bundleId}/panel.meta`, blob: new Blob([meta]) })
      setStatus('done'); appendLog(`Done! ${files.length} files`)
      const zip = new JSZip(); for (const f of files) zip.file(f.name, f.blob)
      const blob = await zip.generateAsync({ type: 'blob' })
      await downloadBlob(blob, `${bundleId}.zip`)
    } catch (err) { setStatus('error'); appendLog(`Error: ${err instanceof Error ? err.message : String(err)}`) }
  }, [title, items, appendLog])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">图片帖</h1>
        <p className="text-base text-gray-400 mt-3">将图片转换为 200×200 黑白面板，适配 EPaper 屏幕</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">包名称</h2>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：旅行照片、摄影作品"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none placeholder:text-gray-300" />
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">图片（最多 {MAX_ITEMS} 张）</h2>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className={`border rounded-lg p-5 transition-all ${item.enabled ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-gray-50/30 opacity-40'}`}>
              <div className="flex items-center gap-3 mb-3">
                <input type="checkbox" checked={item.enabled} onChange={e => updateItem(index, { enabled: e.target.checked })} className="rounded" />
                <span className="text-xs font-mono text-gray-400 w-5">{index + 1}</span>
                <input type="text" value={item.label} onChange={e => updateItem(index, { label: e.target.value })} placeholder="标签名称" disabled={!item.enabled}
                  className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-xs" />
                <button onClick={() => { const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=()=>{const f=inp.files?.[0]; if(f)handleImageSelect(index,f)}; inp.click() }} disabled={!item.enabled}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-100 transition-colors">选择图片</button>
                {item.croppedBlob && <button onClick={() => setCroppingIndex(index)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-100 transition-colors flex items-center gap-1"><Scissors size={12} />重新裁剪</button>}
                <span className="text-xs text-gray-400 truncate flex-1">{item.croppedBlob ? '已裁剪' : item.imageFile ? '待裁剪' : ''}</span>
              </div>
              {item.croppedBlob && (
                <div className="flex items-center gap-3 pl-8 mb-3">
                  <span className="text-xs text-gray-400 w-16 shrink-0">二值化阈值</span>
                  <input type="range" min={96} max={224} value={item.threshold} onChange={e => updateItem(index, { threshold: Number(e.target.value) })} className="flex-1" />
                  <span className="text-xs font-mono text-gray-500 w-8 text-right">{item.threshold}</span>
                  <button onClick={() => generatePreview(index)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-xs hover:bg-gray-100 transition-colors">预览</button>
                </div>
              )}
              {item.preview && <div className="pl-8"><img src={item.preview} alt="" className="w-24 h-24 border border-gray-200 rounded-lg" style={{ imageRendering: 'pixelated' }} /></div>}
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
        <ImageCropper file={items[croppingIndex].imageFile!} targetSize={PANEL_SIZE} onConfirm={handleCropConfirm} onCancel={() => setCroppingIndex(null)} />
      )}
    </div>
  )
}
