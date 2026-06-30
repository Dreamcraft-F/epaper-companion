import { type ReactNode, useCallback, useState } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onFile: (file: File) => void
  accept?: string
  icon?: ReactNode
  hint?: string
}

export default function FileDropZone({ onFile, accept, icon, hint }: Props) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const handleClick = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) onFile(file)
    }
    input.click()
  }, [onFile, accept])

  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
        dragging
          ? 'border-blue-400 bg-blue-50/50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-gray-300">{icon || <Upload size={32} />}</span>
        <p className="text-sm text-gray-400">{hint || '拖拽文件到这里，或点击选择'}</p>
      </div>
    </div>
  )
}
