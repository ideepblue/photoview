export type HighResProgress = number | null

export const fetchHighResBlob = async (
  url: string,
  signal: AbortSignal,
  onProgress: (progress: HighResProgress) => void
) => {
  const response = await fetch(url, {
    credentials: 'include',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to load high-resolution image: ${response.status}`)
  }

  const contentLength = Number(response.headers.get('content-length'))
  const totalBytes =
    Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  const contentType = response.headers.get('content-type') || 'image/*'

  if (!response.body) {
    onProgress(null)
    return response.blob()
  }

  onProgress(totalBytes == undefined ? null : 0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0

  let reading = true
  while (reading) {
    const { done, value } = await reader.read()
    if (done) {
      reading = false
      continue
    }
    if (value == undefined) continue

    chunks.push(value)
    receivedBytes += value.byteLength
    onProgress(totalBytes == undefined ? null : receivedBytes / totalBytes)
  }

  return new Blob(chunks, { type: contentType })
}
