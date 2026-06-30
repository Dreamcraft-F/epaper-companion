/**
 * Web Serial API upload for EPaper device.
 * Protocol: PING → UPLOAD <path> <size> → chunked data → UPLOAD SAVED
 */

const BAUD_RATE = 115200;
const CHUNK_SIZE = 256;
const CHUNK_DELAY_MS = 12;

export interface UploadProgress {
  file: string;
  sent: number;
  total: number;
  status: 'connecting' | 'uploading' | 'saving' | 'done' | 'error';
  message?: string;
}

/**
 * Check if Web Serial API is available.
 */
export function isSerialSupported(): boolean {
  return 'serial' in navigator;
}

/**
 * Request serial port from user.
 */
export async function requestSerialPort(): Promise<SerialPort> {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: BAUD_RATE });
  return port;
}

/**
 * Read a line from the serial port.
 */
async function readLine(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number = 5000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const chunks: Uint8Array[] = [];
  let totalLen = 0;

  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<{ value: undefined; done: true }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), deadline - Date.now())
      ),
    ]);

    if (done || !value) break;

    chunks.push(value);
    totalLen += value.length;

    // Check for newline
    const text = new TextDecoder().decode(concatUint8Arrays(chunks));
    const newlineIdx = text.indexOf('\n');
    if (newlineIdx >= 0) {
      return text.substring(0, newlineIdx).trim();
    }
  }

  throw new Error('Read timeout');
}

/**
 * Write data to the serial port.
 */
async function writeData(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  data: string | Uint8Array
): Promise<void> {
  if (typeof data === 'string') {
    await writer.write(new TextEncoder().encode(data));
  } else {
    await writer.write(data);
  }
}

/**
 * Upload a single file to the device.
 */
export async function uploadFile(
  port: SerialPort,
  remotePath: string,
  data: ArrayBuffer,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const reader = port.readable!.getReader();
  const writer = port.writable!.getWriter();

  try {
    // PING handshake
    onProgress?.({ file: remotePath, sent: 0, total: data.byteLength, status: 'connecting' });
    await writeData(writer, 'PING\n');
    const pong = await readLine(reader, 3000);
    if (!pong.includes('UPLOAD PONG')) {
      throw new Error(`Unexpected response: ${pong}`);
    }

    // Send UPLOAD command
    await writeData(writer, `UPLOAD ${remotePath} ${data.byteLength}\n`);
    const ready = await readLine(reader, 8000);
    if (!ready.includes('UPLOAD READY')) {
      throw new Error(`Upload rejected: ${ready}`);
    }

    // Send data in chunks
    onProgress?.({ file: remotePath, sent: 0, total: data.byteLength, status: 'uploading' });
    const bytes = new Uint8Array(data);
    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
      await writeData(writer, chunk);
      onProgress?.({
        file: remotePath,
        sent: Math.min(offset + CHUNK_SIZE, bytes.length),
        total: data.byteLength,
        status: 'uploading',
      });
      if (CHUNK_DELAY_MS > 0) {
        await sleep(CHUNK_DELAY_MS);
      }
    }

    // Wait for SAVED confirmation
    onProgress?.({ file: remotePath, sent: data.byteLength, total: data.byteLength, status: 'saving' });
    const saved = await readLine(reader, 30000);
    if (!saved.includes('UPLOAD SAVED')) {
      throw new Error(`Save failed: ${saved}`);
    }

    onProgress?.({ file: remotePath, sent: data.byteLength, total: data.byteLength, status: 'done' });
  } finally {
    reader.releaseLock();
    writer.releaseLock();
  }
}

/**
 * Upload multiple files as a bundle.
 */
export async function uploadBundle(
  port: SerialPort,
  files: { path: string; data: ArrayBuffer }[],
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  for (const file of files) {
    await uploadFile(port, file.path, file.data, onProgress);
  }
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Web Serial API type declarations
interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Navigator {
    serial: {
      requestPort(): Promise<SerialPort>;
    };
  }
}
