declare module 'qrcode' {
  interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    type?: 'image/png' | 'image/jpeg' | 'image/webp'
    quality?: number
    margin?: number
    color?: { dark?: string; light?: string }
    width?: number
    scale?: number
  }
  interface QRCodeModules {
    size: number
    data: boolean[][]
    get(row: number, col: number): boolean
  }
  interface QRCodeMatrix {
    modules: QRCodeModules
    version: number
  }
  export function create(text: string, options?: QRCodeOptions): QRCodeMatrix
  export function toDataURL(text: string, options?: QRCodeOptions): Promise<string>
  export function toString(text: string, options?: QRCodeOptions): Promise<string>
  export function toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>
  export function toFile(path: string, text: string, options?: QRCodeOptions): Promise<void>
  export function toFileStream(stream: any, text: string, options?: QRCodeOptions): Promise<void>
  const _default: { create: typeof create; toDataURL: typeof toDataURL; toString: typeof toString; toBuffer: typeof toBuffer }
  export default _default
}

declare interface SerialPort {
  open(options: { baudRate: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}
