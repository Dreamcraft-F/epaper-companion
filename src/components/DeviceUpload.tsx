import { Wifi, Monitor, ArrowRight } from 'lucide-react'

export default function DeviceUpload() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">上传到设备</h1>
        <p className="text-base text-gray-400 mt-3">将生成好的数据包传输到 EPaper 设备</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">操作步骤</h2>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">1</span>
            <div>
              <p className="text-sm font-medium text-gray-900">在 EPaper 设备上进入「传输」应用</p>
              <p className="text-xs text-gray-400 mt-1">主页面按 PWR 键选择 Apps，再选择「传输」</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">2</span>
            <div>
              <p className="text-sm font-medium text-gray-900">连接设备的 WiFi 热点</p>
              <div className="flex items-center gap-2 mt-2 p-3 bg-gray-50 rounded-lg">
                <Wifi size={16} className="text-gray-400" />
                <span className="text-sm font-mono text-gray-700">EPAPER-XXXX</span>
                <span className="text-xs text-gray-400 ml-2">密码：12345678</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">3</span>
            <div>
              <p className="text-sm font-medium text-gray-900">浏览器打开上传页面</p>
              <div className="flex items-center gap-2 mt-2 p-3 bg-gray-50 rounded-lg">
                <Monitor size={16} className="text-gray-400" />
                <span className="text-sm font-mono text-gray-700">http://192.168.4.1</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-bold shrink-0">4</span>
            <div>
              <p className="text-sm font-medium text-gray-900">选择 ZIP 文件上传</p>
              <p className="text-xs text-gray-400 mt-1">上传完成后设备会自动解压并显示</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-50 border border-blue-200 rounded-2xl p-8">
        <div className="flex items-start gap-3">
          <ArrowRight size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">提示</p>
            <p className="text-sm text-blue-700 mt-1">
              先在「书籍打包」「QR 码制作」「图片帖」页面生成数据包并下载 ZIP 文件，再按上述步骤上传到设备。
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
