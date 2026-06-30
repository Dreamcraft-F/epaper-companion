import { type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export default function Input({ label, className = '', ...rest }: Props) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}
      <input
        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-shadow placeholder:text-gray-300"
        {...rest}
      />
    </div>
  )
}
