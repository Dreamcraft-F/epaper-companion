import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { FilePicker } from '@capawesome/capacitor-file-picker'

export async function downloadBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    await downloadNative(blob, filename)
  } else {
    downloadBrowser(blob, filename)
  }
}

function downloadBrowser(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadNative(blob: Blob, filename: string) {
  try {
    const result = await FilePicker.pickDirectory()
    if (!result.path) return

    const base64 = await blobToBase64(blob)
    await Filesystem.writeFile({
      path: `${result.path}/${filename}`,
      data: base64,
      directory: Directory.ExternalStorage,
    })
    alert(`已保存：${result.path}/${filename}`)
  } catch {
    // user cancelled picker
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
