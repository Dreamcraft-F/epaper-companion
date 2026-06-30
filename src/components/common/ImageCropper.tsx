import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  file: File
  targetSize: number
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

const P = 360
const B = 280
const LO = (P - B) / 2
const MIN_S = 0.2
const MAX_S = 5.0
const MID = P / 2

export default function ImageCropper({ file, targetSize, onConfirm, onCancel }: Props) {
  const cvsRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  // offset = top-left of scaled image on canvas (Python convention)
  const st = useRef({ s: 1, ox: MID, oy: MID, base: 1 })
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)
  const [, bump] = useState(0)

  const clamp = useCallback((ox: number, oy: number, sc: number) => {
    const img = imgRef.current
    if (!img) return { ox, oy }
    const sw = img.width * sc, sh = img.height * sc
    let nx = ox, ny = oy
    if (sw <= B) { nx = MID - sw / 2 }
    else { nx = Math.max(MID + B / 2 - sw, Math.min(MID - B / 2, ox)) }
    if (sh <= B) { ny = MID - sh / 2 }
    else { ny = Math.max(MID + B / 2 - sh, Math.min(MID - B / 2, oy)) }
    return { ox: nx, oy: ny }
  }, [])

  const draw = useCallback(() => {
    const c = cvsRef.current, img = imgRef.current, s = st.current
    if (!c || !img) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, P, P)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, P, P)
    const sw = Math.max(1, Math.round(img.width * s.s))
    const sh = Math.max(1, Math.round(img.height * s.s))
    ctx.drawImage(img, s.ox, s.oy, sw, sh)
    ctx.fillStyle = 'rgba(180,180,180,0.55)'
    ctx.fillRect(0, 0, P, LO)
    ctx.fillRect(0, LO + B, P, P)
    ctx.fillRect(0, LO, LO, B)
    ctx.fillRect(LO + B, LO, P, B)
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2
    ctx.strokeRect(LO, LO, B, B)
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const base = Math.max(B / img.width, B / img.height)
      const sc = Math.max(1, base)
      const cl = clamp(MID, MID, sc)
      st.current = { s: sc, ox: cl.ox, oy: cl.oy, base }
      bump(n => n + 1)
      draw()
    }
    img.src = URL.createObjectURL(file)
    return () => URL.revokeObjectURL(img.src)
  }, [file, clamp, draw])

  const toCvs = useCallback((cx: number, cy: number) => {
    const r = cvsRef.current!.getBoundingClientRect()
    return { x: (cx - r.left) * (P / r.width), y: (cy - r.top) * (P / r.height) }
  }, [])

  // Zoom: keep canvas-center point stable
  const applyZoom = useCallback((ns: number) => {
    const s = st.current
    const sc = Math.max(Math.min(ns, MAX_S), s.base, MIN_S)
    if (Math.abs(sc - s.s) < 1e-6) return
    const f = sc / s.s
    const cl = clamp(MID + (s.ox - MID) * f, MID + (s.oy - MID) * f, sc)
    st.current = { ...s, s: sc, ox: cl.ox, oy: cl.oy }
    bump(n => n + 1)
    draw()
  }, [clamp, draw])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    applyZoom(st.current.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  }, [applyZoom])

  const onDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toCvs(e.clientX, e.clientY)
    drag.current = { px: p.x, py: p.y, ox: st.current.ox, oy: st.current.oy }
  }, [toCvs])

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return
    const p = toCvs(e.clientX, e.clientY)
    const cl = clamp(drag.current.ox + (p.x - drag.current.px), drag.current.oy + (p.y - drag.current.py), st.current.s)
    st.current.ox = cl.ox
    st.current.oy = cl.oy
    draw()
  }, [toCvs, clamp, draw])

  const onUp = useCallback(() => { drag.current = null }, [])

  const onReset = useCallback(() => {
    const s = st.current
    const sc = Math.max(1, s.base)
    const cl = clamp(MID, MID, sc)
    st.current = { s: sc, ox: cl.ox, oy: cl.oy, base: s.base }
    bump(n => n + 1)
    draw()
  }, [clamp, draw])

  const handleConfirm = useCallback(() => {
    const img = imgRef.current, s = st.current
    if (!img) return
    const sx = (LO - s.ox) / s.s
    const sy = (LO - s.oy) / s.s
    const sz = B / s.s
    const sx2 = Math.max(0, Math.min(sx, img.width - sz))
    const sy2 = Math.max(0, Math.min(sy, img.height - sz))
    const sz2 = Math.max(1, Math.min(sz, img.width - sx2, img.height - sy2))
    const c = document.createElement('canvas')
    c.width = targetSize; c.height = targetSize
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, targetSize, targetSize)
    ctx.drawImage(img, sx2, sy2, sz2, sz2, 0, 0, targetSize, targetSize)
    c.toBlob(b => { if (b) onConfirm(b) }, 'image/png')
  }, [targetSize, onConfirm])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg">裁切图片</h3>
        <div className="flex justify-center">
          <canvas ref={cvsRef} width={P} height={P}
            className="border border-gray-300 rounded touch-none"
            style={{ width: '100%', maxWidth: P, cursor: 'grab' }}
            onPointerDown={onDown} onPointerMove={onMove}
            onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-10">缩放</span>
          <input type="range" min={MIN_S} max={MAX_S} step={0.01} value={st.current.s}
            onChange={e => applyZoom(parseFloat(e.target.value))} className="flex-1" />
          <button onClick={onReset} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">重置</button>
        </div>
        <p className="text-xs text-gray-400">拖动图片调整位置，滚轮或滑块缩放</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
          <button onClick={handleConfirm} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">使用裁切</button>
        </div>
      </div>
    </div>
  )
}
