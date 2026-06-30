import { type ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  disabled?: boolean
}

export default function Card({ children, className = '', disabled = false }: Props) {
  return (
    <div
      className={`border rounded-lg p-6 transition-all ${
        disabled
          ? 'border-gray-100 bg-gray-50/50 opacity-50'
          : 'border-gray-200 bg-white shadow-sm'
      } ${className}`}
    >
      {children}
    </div>
  )
}
