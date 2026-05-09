import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDropzone, type FileRejection, type DropEvent } from 'react-dropzone'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  securityLevel: 'strict',
  themeVariables: {
    background: '#F4EEDA',
    primaryColor: '#FAF5E5',
    primaryTextColor: '#18181B',
    primaryBorderColor: '#A88B4C',
    secondaryColor: '#F4EFE0',
    tertiaryColor: '#EFE8D6',
    lineColor: '#3A3935',
    textColor: '#18181B',
    mainBkg: '#FAF5E5',
    nodeBorder: '#A88B4C',
    clusterBkg: '#F4EFE0',
    clusterBorder: '#D9CFB8',
    edgeLabelBackground: '#F4EEDA',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
})

type ProjectFile = { path: string; content: string }

type OverviewArchivo = {
  ruta: string
  rol: string
  importancia: 'alta' | 'media' | 'baja'
}

type Overview = {
  resumen: string
  estructura_general: string
  diagrama_mermaid: string
  archivos: OverviewArchivo[]
  recapitulacion: string[]
}

type FuncionInfo = {
  real: string
  humana: string
  llama_a: string[]
}

type FileMap = {
  explicacion: string
  estructura: string
  diagrama_mermaid: string
  funciones: FuncionInfo[]
  puntos_clave: string[]
  resumen_archivo: string
}

type DiagramToCode = {
  lenguaje_detectado: string
  interpretacion: string
  codigo: string
  supuestos: string[]
  advertencias: string[]
}

type TargetLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'pseudocodigo'
  | 'go'
  | 'java'
  | 'csharp'
  | 'cpp'

const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  pseudocodigo: 'Pseudocódigo',
  go: 'Go',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
}

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current || !chart) return
    setRenderError(null)
    const id = `mermaid-${crypto.randomUUID()}`
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg
      })
      .catch((err) => {
        console.error('Mermaid render error:', err)
        setRenderError('Sintaxis inválida en el diagrama')
      })
  }, [chart])

  if (renderError) {
    return (
      <div className="p-4 bg-[#F4EEDA] border border-[#D9CFB8] rounded-md text-sm font-mono text-[#6B6357]">
        — {renderError}
        <pre className="mt-2 text-xs whitespace-pre-wrap text-[#8B8275]">{chart}</pre>
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className="flex justify-center my-6 overflow-x-auto p-8 bg-[#F4EEDA] rounded-md border border-[#D9CFB8]"
    />
  )
}

const isBinary = (buffer: Uint8Array): boolean => {
  const checkSize = Math.min(buffer.length, 1024)
  let nonPrintable = 0
  for (let i = 0; i < checkSize; i++) {
    if (buffer[i] === 0) return true
    if (buffer[i]! < 32 && ![9, 10, 13].includes(buffer[i]!)) nonPrintable++
  }
  return nonPrintable / checkSize > 0.3
}

const readEntry = async (entry: FileSystemEntry): Promise<ProjectFile[]> => {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry
    return new Promise((resolve) => {
      fileEntry.file(async (file) => {
        try {
          if (file.size > 1024 * 1024 * 10) {
            resolve([{ path: entry.fullPath, content: '[CONTENIDO OMITIDO: ARCHIVO MAYOR A 10MB]' }])
            return
          }
          const arrayBuffer = await file.arrayBuffer()
          const uint8 = new Uint8Array(arrayBuffer)
          if (isBinary(uint8)) {
            resolve([{ path: entry.fullPath, content: '[ARCHIVO BINARIO O MULTIMEDIA]' }])
            return
          }
          const decoder = new TextDecoder('utf-8', { fatal: false })
          resolve([{ path: entry.fullPath, content: decoder.decode(uint8) }])
        } catch (err) {
          console.error(`Error leyendo ${entry.fullPath}:`, err)
          resolve([{ path: entry.fullPath, content: '[ERROR DE LECTURA]' }])
        }
      })
    })
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry
    const reader = dirEntry.createReader()
    const readAll = async () => {
      let all: FileSystemEntry[] = []
      let batch: FileSystemEntry[] = []
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve) => {
          reader.readEntries(resolve, () => resolve([]))
        })
        all = all.concat(batch)
      } while (batch.length > 0)
      return all
    }
    const entries = await readAll()
    const filtered = entries.filter(
      (e) =>
        !['node_modules', '.git', 'dist', '.import', '.godot', 'build', 'bin', 'obj', '.next', '.cache'].includes(
          e.name,
        ),
    )
    const results = await Promise.all(filtered.map((e) => readEntry(e)))
    return results.flat()
  }
  return []
}

const importanciaStyles: Record<OverviewArchivo['importancia'], string> = {
  alta: 'bg-[#F4EFE0] text-[#A88B4C] ring-[#D9CFB8]',
  media: 'bg-[#F4EEDA] text-[#6B6357] ring-[#E5DDC9]',
  baja: 'bg-transparent text-[#8B8275] ring-[#E5DDC9]',
}

function FileMapView({ fileMap }: { fileMap: FileMap }) {
  return (
    <>
      <div>
        <div className="text-[10px] smallcaps text-[#A88B4C] mb-2 font-semibold">
          Explicación con ejemplo
        </div>
        <p className="text-lg serif text-[#18181B] leading-relaxed">{fileMap.explicacion}</p>
      </div>

      {fileMap.estructura && (
        <div>
          <div className="text-[10px] smallcaps text-[#A88B4C] mb-2 font-semibold">
            Estructura usada
          </div>
          <p className="text-sm text-[#3A3935] font-mono bg-[#F4EEDA] border border-[#E5DDC9] inline-block px-3 py-1.5 rounded">
            {fileMap.estructura}
          </p>
        </div>
      )}

      <div>
        <div className="text-[10px] smallcaps text-[#A88B4C] mb-2 font-semibold">
          Flujo interno
        </div>
        <Mermaid chart={fileMap.diagrama_mermaid} />
      </div>

      {fileMap.funciones.length > 0 && (
        <div>
          <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
            Funciones del archivo
          </div>
          <div className="overflow-hidden rounded-md border border-[#D9CFB8] bg-[#F4EEDA]">
            <table className="w-full text-sm">
              <thead className="bg-[#F4EFE0] text-[#3A3935] text-xs smallcaps">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Nombre real</th>
                  <th className="text-left font-semibold px-4 py-3">Qué hace y cuándo</th>
                  <th className="text-left font-semibold px-4 py-3">Llama a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DDC9]">
                {fileMap.funciones.map((fn) => (
                  <tr key={fn.real} className="hover:bg-[#F4EFE0]/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-[#A88B4C] align-top whitespace-nowrap">{fn.real}</td>
                    <td className="px-4 py-3 text-[#3A3935] align-top">{fn.humana}</td>
                    <td className="px-4 py-3 align-top">
                      {fn.llama_a.length === 0 ? (
                        <span className="text-[#8B8275]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {fn.llama_a.map((c) => (
                            <code
                              key={c}
                              className="text-xs bg-[#FAF5E5] text-[#6B6357] border border-[#E5DDC9] px-1.5 py-0.5 rounded"
                            >
                              {c}
                            </code>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {fileMap.puntos_clave.length > 0 && (
        <div>
          <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
            Puntos clave
          </div>
          <ul className="space-y-2">
            {fileMap.puntos_clave.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-[#3A3935] text-sm leading-relaxed">
                <span className="catalog-num text-xs mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fileMap.resumen_archivo && (
        <div className="relative bg-[#F4EEDA] border-l-2 border-[#A88B4C] pl-5 py-3 pr-4">
          <div className="text-[10px] smallcaps text-[#A88B4C] mb-1 font-semibold">
            En resumen
          </div>
          <p className="serif text-[#18181B] text-base italic leading-relaxed">{fileMap.resumen_archivo}</p>
        </div>
      )}
    </>
  )
}

function FileCard({
  archivo,
  onExpand,
  expanded,
  fileMap,
  loading,
  error,
}: {
  archivo: OverviewArchivo
  onExpand: () => void
  expanded: boolean
  fileMap: FileMap | null
  loading: boolean
  error: string | null
}) {
  return (
    <div className="gallery-card row-hover rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left px-7 py-5 flex items-start justify-between gap-4 group cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-[10px] smallcaps font-semibold px-2 py-0.5 rounded ring-1 ${importanciaStyles[archivo.importancia]}`}
            >
              {archivo.importancia}
            </span>
            <code className="text-xs font-mono text-[#8B8275] truncate">{archivo.ruta}</code>
          </div>
          <p className="text-base serif text-[#18181B] leading-snug">{archivo.rol}</p>
        </div>
        <div className="text-[#A88B4C]/40 group-hover:text-[#A88B4C] transition-colors mt-1">
          <svg
            className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#E5DDC9] px-7 py-7 bg-[#F4EEDA]/60 space-y-6">
          {loading && (
            <div className="flex items-center gap-3 text-[#6B6357] text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-[#A88B4C] rounded-full animate-bounce" />
              </div>
              <span className="serif italic">Componiendo el mapa de este archivo…</span>
            </div>
          )}

          {error && (
            <div className="text-[#B0584C] text-sm bg-[#F3DAD3]/40 border border-[#B0584C]/20 rounded p-3">
              — {error}
            </div>
          )}

          {fileMap && <FileMapView fileMap={fileMap} />}
        </div>
      )}
    </div>
  )
}

const MAX_DIAGRAM_BYTES = 8 * 1024 * 1024

const LANG_TO_FILENAME: Record<TargetLanguage, string> = {
  python: 'generado.py',
  javascript: 'generado.js',
  typescript: 'generado.ts',
  pseudocodigo: 'generado.txt',
  go: 'generado.go',
  java: 'Generado.java',
  csharp: 'Generado.cs',
  cpp: 'generado.cpp',
}

function readImageAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Formato de imagen inesperado'))
        return
      }
      const commaIdx = result.indexOf(',')
      const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result
      resolve({ base64, mimeType: file.type || 'image/jpeg' })
    }
    reader.readAsDataURL(file)
  })
}

function DiagramToCodePanel() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [language, setLanguage] = useState<TargetLanguage>('python')
  const [result, setResult] = useState<DiagramToCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [codeMap, setCodeMap] = useState<FileMap | null>(null)
  const [codeMapLoading, setCodeMapLoading] = useState(false)
  const [codeMapError, setCodeMapError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const handleFileChange = useCallback((file: File | null) => {
    setError(null)
    setResult(null)
    setCodeMap(null)
    setCodeMapError(null)
    setCopied(false)
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.')
      return
    }
    if (file.size > MAX_DIAGRAM_BYTES) {
      setError('La imagen pesa más de 8 MB. Reduce la calidad o recórtala.')
      return
    }
    setImageFile(file)
    const url = URL.createObjectURL(file)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
  }, [])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setCameraReady(false)
  }, [])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no soporta cámara web. Usa Chrome, Edge o Firefox actualizados.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
    } catch (err: any) {
      const name = err?.name as string | undefined
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Permiso de cámara denegado. Habilítalo en tu navegador y vuelve a intentar.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No se detectó ninguna cámara conectada.')
      } else {
        setError('No se pudo abrir la cámara: ' + (err?.message || 'error desconocido'))
      }
    }
  }, [])

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      const video = videoRef.current
      video.srcObject = streamRef.current
      const onReady = () => setCameraReady(true)
      video.addEventListener('loadedmetadata', onReady)
      video.play().catch(() => {})
      return () => video.removeEventListener('loadedmetadata', onReady)
    }
  }, [cameraActive])

  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video || !cameraReady) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('No se pudo procesar la imagen de la cámara.')
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('No se pudo generar la foto.')
          return
        }
        const file = new File([blob], `camara-${Date.now()}.jpg`, { type: 'image/jpeg' })
        handleFileChange(file)
        stopCamera()
      },
      'image/jpeg',
      0.92,
    )
  }, [cameraReady, handleFileChange, stopCamera])

  const fetchCodeMap = useCallback(async (code: string, lang: TargetLanguage, interpretation: string) => {
    if (!code.trim()) return
    setCodeMapLoading(true)
    setCodeMapError(null)
    setCodeMap(null)
    try {
      const response = await fetch('/api/file-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: LANG_TO_FILENAME[lang],
          content: code,
          projectContext: `Código generado a partir de un diagrama de flujo. Lo que dice el diagrama: ${interpretation}`,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error generando el mapa del código')
      }
      const data: FileMap = await response.json()
      setCodeMap(data)
    } catch (err: any) {
      setCodeMapError(err?.message || 'Error inesperado')
    } finally {
      setCodeMapLoading(false)
    }
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!imageFile) return
    setLoading(true)
    setError(null)
    setResult(null)
    setCodeMap(null)
    setCodeMapError(null)
    setCopied(false)
    try {
      const { base64, mimeType } = await readImageAsBase64(imageFile)
      const response = await fetch('/api/diagram-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          lenguajeObjetivo: language,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error analizando el diagrama')
      }
      const data: DiagramToCode = await response.json()
      setResult(data)
      if (data.codigo?.trim()) {
        void fetchCodeMap(data.codigo, language, data.interpretacion)
      }
    } catch (err: any) {
      setError(err?.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }, [imageFile, language, fetchCodeMap])

  const handleCopy = useCallback(async () => {
    if (!result?.codigo) return
    try {
      await navigator.clipboard.writeText(result.codigo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }, [result])

  const handleClear = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    setResult(null)
    setError(null)
    setCopied(false)
    setCodeMap(null)
    setCodeMapError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [imagePreview])

  return (
    <div className="space-y-8">
      <section className="gallery-card rounded-md p-10 space-y-6">
        <div>
          <div className="step-label mb-2">
            <span className="step-label-num">I</span>
            <span>Sube la foto del diagrama</span>
          </div>
          <p className="text-[#6B6357] text-sm leading-relaxed pl-11">
            Foto de un flowchart en papel, pizarra, o exportado de Lucidchart/Draw.io. JPG, PNG o WebP. Máx 8 MB.
          </p>
        </div>

        {cameraActive ? (
          <div className="space-y-3">
            <div className="relative bg-[#18181B] rounded-md overflow-hidden border border-[#D9CFB8]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full max-h-[480px] object-contain bg-[#18181B]"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-[#EFE8D6] text-sm serif italic">
                  Encendiendo cámara…
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="flex-1 px-6 py-3 bg-[#18181B] hover:bg-[#3A3935] disabled:bg-[#D9CFB8] disabled:cursor-not-allowed text-[#EFE8D6] text-sm font-medium rounded-md transition-colors cursor-pointer"
              >
                Tomar foto
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-6 py-3 bg-[#F4EEDA] hover:bg-[#FAF5E5] border border-[#D9CFB8] hover:border-[#A88B4C] text-[#3A3935] text-sm font-medium rounded-md transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : !imagePreview ? (
          <div className="space-y-4">
            <label
              htmlFor="diagram-upload"
              className="block border border-dashed border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#F4EEDA] rounded-md p-12 text-center cursor-pointer transition-all"
            >
              <input
                id="diagram-upload"
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div className="space-y-3">
                <div className="w-14 h-14 bg-[#F4EEDA] border border-[#A88B4C]/40 text-[#A88B4C] rounded-full flex items-center justify-center mx-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="serif text-xl text-[#18181B]">Subir archivo de imagen</p>
                <p className="text-[#8B8275] text-xs smallcaps">JPG · PNG · WebP — hasta 8 MB</p>
              </div>
            </label>
            <div className="gallery-divider">
              <span className="text-[10px] smallcaps text-[#8B8275] font-semibold">o</span>
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="w-full px-6 py-4 bg-[#F4EEDA] border border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#FAF5E5] text-[#18181B] text-sm font-medium rounded-md transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#A88B4C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="smallcaps text-xs font-semibold">Usar webcam</span>
            </button>
          </div>
        ) : (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Vista previa del diagrama"
              className="w-full max-h-96 object-contain rounded-md border border-[#D9CFB8] bg-[#F4EEDA]"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-3 right-3 px-3 py-1.5 bg-[#18181B]/85 hover:bg-[#18181B] text-[#EFE8D6] text-[10px] smallcaps font-semibold rounded backdrop-blur cursor-pointer"
            >
              Quitar
            </button>
          </div>
        )}
      </section>

      <section className="gallery-card rounded-md p-10 space-y-6">
        <div>
          <div className="step-label">
            <span className="step-label-num">II</span>
            <span>Elige el lenguaje destino</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TARGET_LANGUAGE_LABELS) as TargetLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`px-4 py-2 rounded text-sm font-medium transition-all cursor-pointer border ${
                language === lang
                  ? 'bg-[#18181B] text-[#EFE8D6] border-[#18181B]'
                  : 'bg-[#F4EEDA] text-[#3A3935] border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#FAF5E5]'
              }`}
            >
              {TARGET_LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!imageFile || loading}
          className="w-full px-6 py-4 bg-[#18181B] hover:bg-[#3A3935] disabled:bg-[#D9CFB8] disabled:cursor-not-allowed text-[#EFE8D6] text-sm font-semibold smallcaps rounded transition-colors cursor-pointer"
        >
          {loading ? 'Analizando diagrama…' : 'Generar código'}
        </button>
      </section>

      {error && (
        <div className="bg-[#F3DAD3]/40 border border-[#B0584C]/30 p-6 rounded-md text-[#B0584C] font-medium">
          — {error}
        </div>
      )}

      {loading && (
        <div className="gallery-card rounded-md p-10 flex items-center gap-4">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce" />
          </div>
          <p className="text-[#3A3935] serif italic">Gemini está leyendo tu diagrama…</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <section className="gallery-card rounded-md p-10">
            <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
              Qué entendí del diagrama
            </div>
            <p className="serif text-lg text-[#18181B] leading-relaxed whitespace-pre-line">{result.interpretacion}</p>
          </section>

          <section className="rounded-md overflow-hidden border border-[#3A3935] bg-[#18181B] shadow-[0_12px_32px_-16px_rgba(24,24,27,0.3)]">
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#3A3935] bg-[#18181B]">
              <div className="flex items-center gap-3">
                <span className="text-[#C9AE74] font-mono text-[10px] smallcaps font-semibold">
                  Código · {result.lenguaje_detectado}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-1.5 bg-transparent border border-[#C9AE74]/40 hover:border-[#C9AE74] hover:bg-[#C9AE74]/10 text-[#C9AE74] text-[10px] smallcaps font-semibold rounded transition-colors cursor-pointer"
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="p-6 text-sm font-mono text-[#EFE8D6] overflow-x-auto whitespace-pre">
              {result.codigo || '// Sin código generado'}
            </pre>
          </section>

          {(codeMapLoading || codeMap || codeMapError) && (
            <section className="gallery-card rounded-md overflow-hidden">
              <div className="bg-[#F4EEDA] px-8 py-5 border-b border-[#E5DDC9] flex items-center justify-between">
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-1 font-semibold">
                    Mapa del código
                  </div>
                  <p className="text-sm text-[#6B6357] serif italic">Qué hace cada parte del código que se acaba de generar.</p>
                </div>
                {codeMapLoading && (
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-[#A88B4C] rounded-full animate-bounce" />
                  </div>
                )}
              </div>
              <div className="p-8 space-y-6">
                {codeMapLoading && !codeMap && (
                  <p className="text-[#6B6357] text-sm serif italic">Componiendo explicación paso a paso del código…</p>
                )}
                {codeMapError && (
                  <div className="text-[#B0584C] text-sm bg-[#F3DAD3]/40 border border-[#B0584C]/30 rounded p-3 flex items-center gap-3">
                    <span>— {codeMapError}</span>
                    <button
                      type="button"
                      onClick={() => result && fetchCodeMap(result.codigo, language, result.interpretacion)}
                      className="px-3 py-1 bg-[#B0584C] text-white text-[10px] smallcaps font-semibold rounded hover:bg-[#9a4d42] cursor-pointer"
                    >
                      Reintentar
                    </button>
                  </div>
                )}
                {codeMap && <FileMapView fileMap={codeMap} />}
              </div>
            </section>
          )}

          {(result.supuestos.length > 0 || result.advertencias.length > 0) && (
            <section className="gallery-card rounded-md p-8 space-y-5 border-l-2 border-l-[#A88B4C]">
              {result.supuestos.length > 0 && (
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                    Supuestos que tuve que hacer
                  </div>
                  <ul className="space-y-2">
                    {result.supuestos.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-[#3A3935] text-sm">
                        <span className="catalog-num text-xs mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.advertencias.length > 0 && (
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                    Advertencias
                  </div>
                  <ul className="space-y-2">
                    {result.advertencias.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-[#3A3935] text-sm">
                        <span className="text-[#A88B4C] mt-0.5 shrink-0">—</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-[#8B8275] serif italic pt-3 border-t border-[#E5DDC9]">
                El código es un borrador generado a partir de la imagen. Revísalo antes de usarlo.
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

type TabKey = 'mapa' | 'diagrama'

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('mapa')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [streamingText, setStreamingText] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState<number>(0)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [fileMaps, setFileMaps] = useState<Record<string, FileMap>>({})
  const [fileMapLoading, setFileMapLoading] = useState<Record<string, boolean>>({})
  const [fileMapErrors, setFileMapErrors] = useState<Record<string, string>>({})

  const filesByPath = useMemo(() => {
    const map = new Map<string, ProjectFile>()
    for (const f of files) map.set(f.path, f)
    return map
  }, [files])

  const runOverview = useCallback(async (collected: ProjectFile[]) => {
    setLoading(true)
    setError(null)
    setOverview(null)
    setStreamingText('')
    setExpandedPath(null)
    setFileMaps({})
    setFileMapErrors({})

    try {
      const response = await fetch('/api/overview-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: collected }),
      })

      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Error generando el mapa general')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalOverview: Overview | null = null
      let streamErr: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          if (!evt.trim()) continue
          const lines = evt.split('\n')
          let evtName = 'message'
          let dataStr = ''
          for (const line of lines) {
            if (line.startsWith('event:')) evtName = line.slice(6).trim()
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim()
          }
          if (!dataStr) continue
          try {
            const payload = JSON.parse(dataStr)
            if (evtName === 'chunk') {
              setStreamingText(payload.accumulated ?? '')
            } else if (evtName === 'done') {
              finalOverview = payload as Overview
            } else if (evtName === 'error') {
              streamErr = payload.error ?? 'Error desconocido'
            }
          } catch {
            /* ignore malformed event */
          }
        }
      }

      if (streamErr) throw new Error(streamErr)
      if (!finalOverview) throw new Error('El mapa general nunca se completó.')
      setOverview(finalOverview)
      setStreamingText('')
    } catch (err: any) {
      setError(err?.message || 'Error inesperado en VibeMap')
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[], _fileRejections: FileRejection[], event: DropEvent) => {
    setLoading(true)
    setError(null)
    setOverview(null)
    setStreamingText('')
    setFileCount(0)
    setFiles([])

    try {
      let collected: ProjectFile[] = []
      const dataTransfer = (event as DragEvent | undefined)?.dataTransfer
      const items = dataTransfer?.items
      if (items) {
        const entries = Array.from(items)
          .map((item) => item.webkitGetAsEntry())
          .filter((e): e is FileSystemEntry => e !== null)
        const nested = await Promise.all(entries.map((e) => readEntry(e)))
        collected = nested.flat()
      } else {
        collected = await Promise.all(
          acceptedFiles.map(async (f) => ({ path: f.name, content: await f.text() })),
        )
      }

      if (collected.length === 0) {
        throw new Error('No se encontraron archivos procesables.')
      }

      setFileCount(collected.length)
      setFiles(collected)
      await runOverview(collected)
    } catch (err: any) {
      setError(err?.message || 'Error inesperado en VibeMap')
      setLoading(false)
    }
  }, [runOverview])

  const handleRetry = useCallback(() => {
    if (files.length > 0) runOverview(files)
  }, [files, runOverview])

  const handleExpandFile = useCallback(
    async (ruta: string) => {
      if (expandedPath === ruta) {
        setExpandedPath(null)
        return
      }
      setExpandedPath(ruta)

      if (fileMaps[ruta] || fileMapLoading[ruta]) return

      const file = filesByPath.get(ruta)
      if (!file) {
        setFileMapErrors((p) => ({ ...p, [ruta]: 'Archivo no encontrado en el upload.' }))
        return
      }
      if (!file.content || file.content.startsWith('[')) {
        setFileMapErrors((p) => ({ ...p, [ruta]: 'No hay contenido legible para este archivo.' }))
        return
      }

      setFileMapLoading((p) => ({ ...p, [ruta]: true }))
      setFileMapErrors((p) => {
        const { [ruta]: _, ...rest } = p
        return rest
      })

      try {
        const response = await fetch('/api/file-map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: file.path,
            content: file.content,
            projectContext: overview?.resumen ?? '',
          }),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || 'Error generando mapa del archivo')
        }
        const data: FileMap = await response.json()
        setFileMaps((p) => ({ ...p, [ruta]: data }))
      } catch (err: any) {
        setFileMapErrors((p) => ({ ...p, [ruta]: err?.message || 'Error inesperado' }))
      } finally {
        setFileMapLoading((p) => ({ ...p, [ruta]: false }))
      }
    },
    [expandedPath, fileMaps, fileMapLoading, filesByPath, overview],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className="max-w-5xl mx-auto px-6 py-20 font-sans antialiased text-[#18181B]">
      {/* Decorative frame corners */}
      <div className="corner-ornament corner-tl" aria-hidden="true"><span className="dot" /></div>
      <div className="corner-ornament corner-tr" aria-hidden="true"><span className="dot" /></div>
      <div className="corner-ornament corner-bl" aria-hidden="true"><span className="dot" /></div>
      <div className="corner-ornament corner-br" aria-hidden="true"><span className="dot" /></div>

      {/* Side ornament (right edge) */}
      <div className="side-ornament" aria-hidden="true">
        <span className="mark-square" />
        <span className="mark-line" />
        <span className="mark-text">Vibe · Map</span>
        <span className="mark-line" />
        <span className="mark-dot" />
      </div>

      <header className="text-center mb-20">
        <h1 className="serif text-7xl md:text-8xl font-medium tracking-tight mb-6 text-[#18181B] leading-none">
          Vibe<span className="text-[#5E3A3A]">M</span>ap
        </h1>
        <div className="flex items-center justify-center gap-3 mb-8" aria-hidden="true">
          <span className="h-px w-10 bg-[#18181B]" />
          <span className="text-[#A88B4C] text-base">❖</span>
          <span className="h-px w-10 bg-[#18181B]" />
        </div>
        <p className="serif italic text-xl md:text-2xl text-[#3A3935] max-w-2xl mx-auto leading-relaxed">
          ¿Codex o Claude te generó código y no entiendes qué hace?
        </p>
        <p className="text-base text-[#6B6357] max-w-xl mx-auto mt-3 leading-relaxed">
          Súbelo y te lo explico como mapa mental, en palabras simples.
        </p>
      </header>

      <div className="flex justify-center mb-16">
        <div className="inline-flex border-b border-[#D9CFB8] gap-12">
          <button
            type="button"
            onClick={() => setActiveTab('mapa')}
            className={`pb-3 text-sm smallcaps font-semibold transition-all border-b-2 -mb-px cursor-pointer ${
              activeTab === 'mapa'
                ? 'text-[#18181B] border-[#A88B4C]'
                : 'text-[#8B8275] border-transparent hover:text-[#3A3935]'
            }`}
          >
            Mapa de proyecto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagrama')}
            className={`pb-3 text-sm smallcaps font-semibold transition-all border-b-2 -mb-px cursor-pointer ${
              activeTab === 'diagrama'
                ? 'text-[#18181B] border-[#A88B4C]'
                : 'text-[#8B8275] border-transparent hover:text-[#3A3935]'
            }`}
          >
            Diagrama → Código
          </button>
        </div>
      </div>

      {activeTab === 'diagrama' ? (
        <main>
          <DiagramToCodePanel />
        </main>
      ) : (
      <main className="space-y-12">
        <section
          {...getRootProps()}
          className={`
            gallery-card relative group border border-dashed rounded-md p-20 text-center transition-all duration-300 cursor-pointer
            ${
              isDragActive
                ? 'border-[#A88B4C] bg-[#F4EFE0] scale-[1.005]'
                : 'border-[#D9CFB8] hover:border-[#A88B4C] hover:bg-[#F4EEDA]'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="space-y-6">
            <div className="w-20 h-20 bg-[#F4EEDA] border border-[#A88B4C]/40 text-[#A88B4C] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:border-[#A88B4C] transition-all duration-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-9 w-9"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="space-y-3">
              <p className="serif text-3xl text-[#18181B] tracking-tight">Suelta tu carpeta de proyecto</p>
              <p className="text-[#6B6357] text-sm leading-relaxed max-w-md mx-auto">
                Funciona con código de cualquier IA: React, Python, Godot, Unity, C++, etc.
              </p>
            </div>
          </div>
        </section>

        {loading && (
          <div className="gallery-card rounded-md p-10 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex space-x-2">
                <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2.5 h-2.5 bg-[#A88B4C] rounded-full animate-bounce"></div>
              </div>
              <div>
                <p className="serif text-xl text-[#18181B]">
                  Componiendo el mapa de {fileCount} archivos…
                </p>
                <p className="text-[#6B6357] text-sm italic serif">Gemini está armando el mapa general.</p>
              </div>
            </div>
            {streamingText && (
              <pre className="text-xs font-mono text-[#8B8275] bg-[#F4EEDA] border border-[#E5DDC9] p-4 rounded overflow-hidden max-h-40 whitespace-pre-wrap">
                {streamingText.slice(-1200)}
              </pre>
            )}
          </div>
        )}

        {error && (
          <div className="bg-[#F3DAD3]/40 border border-[#B0584C]/30 p-8 rounded-md flex items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <div className="bg-[#B0584C]/15 border border-[#B0584C]/30 text-[#B0584C] p-3 rounded shrink-0">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="serif text-xl text-[#B0584C]">Algo falló</p>
                <p className="text-[#B0584C]/80 text-sm">{error}</p>
              </div>
            </div>
            {files.length > 0 && (
              <button
                type="button"
                onClick={handleRetry}
                className="shrink-0 px-5 py-2.5 bg-[#B0584C] hover:bg-[#9a4d42] text-[#EFE8D6] text-[10px] smallcaps font-semibold rounded transition-colors cursor-pointer"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {overview && (
          <>
            <section className="gallery-card rounded-md overflow-hidden">
              <div className="bg-[#18181B] px-10 py-5 flex items-center justify-between border-b border-[#3A3935]">
                <div className="flex items-center gap-4">
                  <span className="text-[#C9AE74] font-mono text-[10px] smallcaps font-semibold">
                    — Sala I · Mapa General —
                  </span>
                </div>
                <div className="px-3 py-1 border border-[#C9AE74]/30 rounded">
                  <span className="text-[#C9AE74] text-[10px] smallcaps font-semibold">
                    {fileCount} archivos
                  </span>
                </div>
              </div>
              <div className="p-10 space-y-10">
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                    De qué va el proyecto
                  </div>
                  <p className="serif text-2xl text-[#18181B] leading-relaxed">{overview.resumen}</p>
                </div>
                {overview.estructura_general && (
                  <div>
                    <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                      Estructura general
                    </div>
                    <p className="text-base text-[#3A3935] font-mono bg-[#F4EEDA] border border-[#E5DDC9] inline-block px-4 py-2 rounded">
                      {overview.estructura_general}
                    </p>
                  </div>
                )}
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                    Cómo se conecta todo
                  </div>
                  <Mermaid chart={overview.diagrama_mermaid} />
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between mb-6 px-1">
                <div>
                  <div className="text-[10px] smallcaps text-[#A88B4C] mb-1 font-semibold">— Sala II —</div>
                  <h2 className="serif text-3xl text-[#18181B] tracking-tight">Archivos del proyecto</h2>
                </div>
                <p className="text-sm text-[#8B8275] serif italic">
                  Click para ver el mapa de cada uno
                </p>
              </div>
              <div className="space-y-3">
                {overview.archivos.map((a, i) => (
                  <div key={a.ruta} className="flex items-start gap-4">
                    <span className="catalog-num text-sm pt-7 w-8 shrink-0 text-right">
                      {String(i + 1).padStart(2, '0')}.
                    </span>
                    <div className="flex-1">
                      <FileCard
                        archivo={a}
                        expanded={expandedPath === a.ruta}
                        onExpand={() => handleExpandFile(a.ruta)}
                        fileMap={fileMaps[a.ruta] ?? null}
                        loading={!!fileMapLoading[a.ruta]}
                        error={fileMapErrors[a.ruta] ?? null}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {overview.recapitulacion && overview.recapitulacion.length > 0 && (
              <section className="gallery-card rounded-md p-12 border-l-2 border-l-[#A88B4C]">
                <div className="text-[10px] smallcaps text-[#A88B4C] mb-3 font-semibold">
                  — Sala III · Para llevarte —
                </div>
                <h2 className="serif text-3xl tracking-tight text-[#18181B] mb-8 italic">
                  Si solo recuerdas {overview.recapitulacion.length === 1 ? 'una cosa' : `${overview.recapitulacion.length} cosas`}…
                </h2>
                <ul className="space-y-5">
                  {overview.recapitulacion.map((punto, i) => (
                    <li key={i} className="flex items-start gap-5">
                      <span className="catalog-num text-2xl shrink-0 leading-none mt-1 w-10 text-right">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className="serif text-lg text-[#18181B] leading-relaxed pt-0.5">{punto}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
      )}

      <footer className="mt-32 text-center pb-16 space-y-4">
        <div className="gallery-divider mb-10">
          <span className="text-[#A88B4C] font-serif text-sm">◆</span>
        </div>
        <p className="text-[#8B8275] text-sm serif italic">Una galería para el código generado por IA</p>
      </footer>
    </div>
  )
}

export default App
