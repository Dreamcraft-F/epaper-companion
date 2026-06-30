/**
 * WiFi HTTP upload for EPaper device.
 * The device runs an HTTP server at 192.168.4.1 when in upload mode.
 */

const DEFAULT_BASE_URL = 'http://192.168.4.1';

export interface WifiUploadProgress {
  file: string;
  status: 'connecting' | 'uploading' | 'saving' | 'done' | 'error';
  message?: string;
}

export interface DeviceStatus {
  ssid: string;
  state: string;
  detail: string;
}

/**
 * Check device status.
 */
export async function getDeviceStatus(baseUrl: string = DEFAULT_BASE_URL): Promise<DeviceStatus> {
  const resp = await fetch(`${baseUrl}/status`);
  const text = await resp.text();
  const lines = text.trim().split('\n');
  return {
    ssid: lines[0] || '',
    state: lines[1] || '',
    detail: lines[2] || '',
  };
}

/**
 * Upload a single file via HTTP POST.
 */
export async function uploadFileWifi(
  baseUrl: string,
  kind: 'book' | 'qr' | 'panel',
  bundleId: string,
  fileName: string,
  data: ArrayBuffer,
  isFinal: boolean,
  onProgress?: (progress: WifiUploadProgress) => void
): Promise<void> {
  const params = new URLSearchParams({
    kind,
    book: bundleId,
    file: fileName,
    final: isFinal ? '1' : '0',
  });

  onProgress?.({ file: fileName, status: 'uploading' });

  const resp = await fetch(`${baseUrl}/upload?${params}`, {
    method: 'POST',
    body: data,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload failed: ${resp.status} ${text}`);
  }

  onProgress?.({ file: fileName, status: isFinal ? 'saving' : 'done' });
}

/**
 * Upload a complete bundle via WiFi.
 */
export async function uploadBundleWifi(
  files: { name: string; data: ArrayBuffer }[],
  kind: 'book' | 'qr' | 'panel',
  bundleId: string,
  baseUrl: string = DEFAULT_BASE_URL,
  onProgress?: (progress: WifiUploadProgress) => void
): Promise<void> {
  for (let i = 0; i < files.length; i++) {
    const isFinal = i === files.length - 1;
    await uploadFileWifi(baseUrl, kind, bundleId, files[i].name, files[i].data, isFinal, onProgress);
  }

  // Poll for completion
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const status = await getDeviceStatus(baseUrl);
    if (status.state === 'SUCCESS' || status.state === 'ERROR') {
      if (status.state === 'ERROR') {
        throw new Error(`Device error: ${status.detail}`);
      }
      break;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
