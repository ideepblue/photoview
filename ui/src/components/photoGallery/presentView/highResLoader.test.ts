import { fetchHighResBlob } from './highResLoader'

const streamResponse = (chunks: Uint8Array[], contentLength?: number) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })

  return new Response(body, {
    headers:
      contentLength == undefined
        ? { 'content-type': 'image/jpeg' }
        : {
            'content-type': 'image/jpeg',
            'content-length': String(contentLength),
          },
  })
}

test('reports determinate progress while streaming a high-resolution image', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      streamResponse([new Uint8Array(4), new Uint8Array(6)], 10)
    )
  vi.stubGlobal('fetch', fetchMock)
  const progress = vi.fn()

  const blob = await fetchHighResBlob(
    '/photo.jpg',
    new AbortController().signal,
    progress
  )

  const [requestedUrl, requestedOptions] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ]
  expect(requestedUrl).toBe('/photo.jpg')
  expect(requestedOptions.credentials).toBe('include')
  expect(requestedOptions.signal).toBeInstanceOf(AbortSignal)
  expect(progress).toHaveBeenNthCalledWith(1, 0)
  expect(progress).toHaveBeenNthCalledWith(2, 0.4)
  expect(progress).toHaveBeenNthCalledWith(3, 1)
  expect(blob.type).toBe('image/jpeg')
})

test('keeps progress indeterminate when the server does not provide a content length', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(streamResponse([new Uint8Array(5)]))
  )
  const progress = vi.fn()

  await fetchHighResBlob('/photo.jpg', new AbortController().signal, progress)

  expect(progress).toHaveBeenCalledWith(null)
})
