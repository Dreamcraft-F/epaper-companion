interface Props {
  lines: string[]
}

export default function LogPanel({ lines }: Props) {
  if (!lines.length) return null
  return (
    <div className="bg-gray-900 text-gray-300 rounded-lg p-3 font-mono text-xs max-h-40 overflow-auto leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className={line.includes('错误') ? 'text-red-400' : ''}>
          {line}
        </div>
      ))}
    </div>
  )
}
