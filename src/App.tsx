import { useState } from 'react'
import { BookOpen, QrCode, Image, Upload } from 'lucide-react'
import './index.css'
import BookBuilder from './components/BookBuilder'
import QrBuilder from './components/QrBuilder'
import PanelBuilder from './components/PanelBuilder'
import DeviceUpload from './components/DeviceUpload'

type Page = 'book' | 'qr' | 'panel' | 'upload'

const NAV: { id: Page; label: string; icon: typeof BookOpen }[] = [
  { id: 'book', label: '书籍打包', icon: BookOpen },
  { id: 'qr', label: 'QR 制作', icon: QrCode },
  { id: 'panel', label: '图片帖', icon: Image },
  { id: 'upload', label: '上传', icon: Upload },
]

export default function App() {
  const [page, setPage] = useState<Page>('book')

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg)]">
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t border-gray-200 bg-white/95 backdrop-blur-sm z-50 pb-[env(safe-area-inset-bottom)]">
        {NAV.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center py-3 text-xs transition-colors ${
                active ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.5} />
              <span className="mt-1 font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-white shrink-0">
        <div className="px-6 py-8 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">EPaper 工具箱</h1>
          <p className="text-xs text-gray-400 mt-2">EPaper Companion App</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map(item => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.5} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        <div className="max-w-5xl mx-auto px-6 py-10 md:px-12 md:py-14 lg:px-20 lg:py-16">
          {page === 'book' && <BookBuilder />}
          {page === 'qr' && <QrBuilder />}
          {page === 'panel' && <PanelBuilder />}
          {page === 'upload' && <DeviceUpload />}
        </div>
      </main>
    </div>
  )
}
