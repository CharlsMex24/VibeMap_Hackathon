import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useDropzone, type FileRejection, type DropEvent } from 'react-dropzone'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
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

type ParsedNode = { id: string; label: string }
type ParsedEdge = { from: string; label: string; to: string }

function parseMermaidSource(chart: string): { nodes: ParsedNode[]; edges: ParsedEdge[] } {
  const nodeMap = new Map<string, string>()
  const edges: ParsedEdge[] = []

  const nodeRe = /\b([A-Za-z_][\w]*)\s*[\[\(\{][\(\{>]?([^\]\)\}>]+)[\]\)\}]/g
  const edgeRe = /\b([A-Za-z_][\w]*)\s*[-=.]+>\s*(?:\|([^|]+)\|\s*)?([A-Za-z_][\w]*)\b/g

  for (const rawLine of chart.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('%%')) continue
    if (/^(graph|flowchart|subgraph|end|classDef|class|click|style|linkStyle)\b/.test(line)) continue

    nodeRe.lastIndex = 0
    let nm: RegExpExecArray | null
    while ((nm = nodeRe.exec(line)) !== null) {
      const id = nm[1]!
      const label = nm[2]!.trim()
      if (!nodeMap.has(id)) nodeMap.set(id, label)
    }

    edgeRe.lastIndex = 0
    let em: RegExpExecArray | null
    while ((em = edgeRe.exec(line)) !== null) {
      edges.push({ from: em[1]!, label: (em[2] ?? '').trim(), to: em[3]! })
    }
  }

  // Auto-include node IDs that appear in edges but never got an explicit label
  for (const e of edges) {
    if (!nodeMap.has(e.from)) nodeMap.set(e.from, e.from)
    if (!nodeMap.has(e.to)) nodeMap.set(e.to, e.to)
  }

  const nodes = Array.from(nodeMap.entries()).map(([id, label]) => ({ id, label }))
  return { nodes, edges }
}

function StepByStepDiagram({ chart }: { chart: string }) {
  const { nodes, edges } = useMemo(() => parseMermaidSource(chart), [chart])
  const labelOf = useMemo(() => new Map(nodes.map((n) => [n.id, n.label])), [nodes])

  const edgesBySource = useMemo(() => {
    const map = new Map<string, ParsedEdge[]>()
    for (const e of edges) {
      if (!map.has(e.from)) map.set(e.from, [])
      map.get(e.from)!.push(e)
    }
    return map
  }, [edges])

  const orderedSources = useMemo(() => {
    const seen = new Set<string>()
    const order: string[] = []
    for (const e of edges) {
      if (!seen.has(e.from)) {
        seen.add(e.from)
        order.push(e.from)
      }
    }
    return order
  }, [edges])

  if (nodes.length === 0) {
    return (
      <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 text-center">
        No se pudo extraer ningún paso del diagrama.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">
          Pasos / componentes
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {nodes.map((n, i) => (
            <div
              key={n.id}
              className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs text-slate-400 uppercase tracking-wider mb-0.5">{n.id}</div>
                <div className="font-semibold text-slate-800 text-base break-words leading-snug">{n.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {edges.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-3">
            Conexiones paso a paso
          </div>
          <div className="space-y-3">
            {orderedSources.map((source) => {
              const sourceEdges = edgesBySource.get(source) ?? []
              return (
                <div key={source} className="bg-white rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-baseline gap-2 mb-3 flex-wrap">
                    <span className="font-bold text-slate-900 text-base">{labelOf.get(source) ?? source}</span>
                    <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">{source}</span>
                  </div>
                  <ul className="space-y-2.5">
                    {sourceEdges.map((e, i) => (
                      <li key={i} className="flex items-start gap-3 text-base leading-relaxed">
                        <span className="text-indigo-500 font-bold mt-0.5 shrink-0">→</span>
                        <span className="text-slate-700 flex-1">
                          {e.label && (
                            <span className="inline-block bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-sm font-medium mr-2 mb-0.5">
                              {e.label}
                            </span>
                          )}
                          <span className="font-semibold text-slate-800">{labelOf.get(e.to) ?? e.to}</span>
                          <span className="font-mono text-xs text-slate-400 ml-2">{e.to}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function unlockSvgSize(container: HTMLElement | null) {
  if (!container) return
  const svg = container.querySelector('svg')
  if (!svg) return
  svg.removeAttribute('style')
  svg.style.maxWidth = 'none'
  svg.style.height = 'auto'
  svg.style.display = 'block'
}

function MermaidFullscreen({ chart, onClose }: { chart: string; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const dragState = useRef<{ active: boolean; x: number; y: number; sl: number; st: number }>({
    active: false,
    x: 0,
    y: 0,
    sl: 0,
    st: 0,
  })

  useEffect(() => {
    if (!stageRef.current || !chart) return
    const id = `mermaid-fs-${crypto.randomUUID()}`
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (stageRef.current) {
          stageRef.current.innerHTML = svg
          unlockSvgSize(stageRef.current)
        }
      })
      .catch(() => {})
  }, [chart])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || (e.key === '=' && e.shiftKey === false)) setZoom((z) => Math.min(4, z + 0.2))
      if (e.key === '-') setZoom((z) => Math.max(0.25, z - 0.2))
      if (e.key === '0') setZoom(1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return
    dragState.current = {
      active: true,
      x: e.clientX,
      y: e.clientY,
      sl: scrollRef.current.scrollLeft,
      st: scrollRef.current.scrollTop,
    }
    if (scrollRef.current) scrollRef.current.style.cursor = 'grabbing'
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragState.current.active || !scrollRef.current) return
    scrollRef.current.scrollLeft = dragState.current.sl - (e.clientX - dragState.current.x)
    scrollRef.current.scrollTop = dragState.current.st - (e.clientY - dragState.current.y)
  }
  const stopDrag = () => {
    dragState.current.active = false
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return
    e.preventDefault()
    setZoom((z) => Math.max(0.25, Math.min(4, z + (e.deltaY < 0 ? 0.15 : -0.15))))
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-slate-950 text-white border-b border-slate-800">
        <span className="font-bold text-sm tracking-widest uppercase text-indigo-300">Diagrama ampliado</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.2))}
            className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold text-lg"
            title="Alejar (-)"
          >
            −
          </button>
          <span className="text-sm font-mono w-16 text-center text-slate-300">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
            className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold text-lg"
            title="Acercar (+)"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-3 h-9 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold"
            title="Tamaño real (0)"
          >
            100%
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 px-4 h-9 bg-rose-600 hover:bg-rose-500 rounded-lg text-sm font-bold"
            title="Cerrar (Esc)"
          >
            Cerrar
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onWheel={onWheel}
        className="flex-1 overflow-auto bg-white select-none"
        style={{ cursor: 'grab' }}
      >
        <div
          ref={stageRef}
          className="p-12 inline-block"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
        />
      </div>
      <div className="px-6 py-2 bg-slate-950 text-slate-400 text-xs text-center border-t border-slate-800">
        Arrastra para mover · Ctrl + rueda para zoom · Esc para cerrar
      </div>
    </div>
  )
}

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [view, setView] = useState<'visual' | 'pasos'>('visual')

  useEffect(() => {
    if (view !== 'visual') return
    if (!ref.current || !chart) return
    setRenderError(null)
    const id = `mermaid-${crypto.randomUUID()}`
    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg
          unlockSvgSize(ref.current)
        }
      })
      .catch((err) => {
        console.error('Mermaid render error:', err)
        setRenderError('No se pudo renderizar el diagrama. Mira la versión paso a paso debajo.')
      })
  }, [chart, view])

  const ViewToggle = (
    <div className="inline-flex bg-slate-100 p-1 rounded-xl">
      <button
        type="button"
        onClick={() => setView('visual')}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
          view === 'visual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        Visual
      </button>
      <button
        type="button"
        onClick={() => setView('pasos')}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
          view === 'pasos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        Paso a paso
      </button>
    </div>
  )

  if (view === 'pasos') {
    return (
      <div className="my-6 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-end px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          {ViewToggle}
        </div>
        <div className="p-6">
          <StepByStepDiagram chart={chart} />
        </div>
      </div>
    )
  }

  if (renderError) {
    return (
      <div className="my-6 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5">
            ⚠️ {renderError}
          </div>
          {ViewToggle}
        </div>
        <div className="p-6">
          <StepByStepDiagram chart={chart} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="my-6 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          {ViewToggle}
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
            title="Ver en pantalla completa"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Ampliar
          </button>
        </div>
        <div className="overflow-auto p-6 max-h-[720px]">
          <div ref={ref} className="inline-block min-w-full" />
        </div>
        <div className="px-4 py-2.5 text-xs text-slate-400 text-center border-t border-slate-100 bg-slate-50/50">
          Arrastra horizontalmente para ver más · pulsa <span className="font-bold">Ampliar</span> para pantalla completa
        </div>
      </div>
      {fullscreen && <MermaidFullscreen chart={chart} onClose={() => setFullscreen(false)} />}
    </>
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
  alta: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  media: 'bg-slate-100 text-slate-600 ring-slate-200',
  baja: 'bg-slate-50 text-slate-400 ring-slate-100',
}

function FileMapView({ fileMap }: { fileMap: FileMap }) {
  return (
    <>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
          Explicación con ejemplo
        </div>
        <p className="text-lg text-slate-800 leading-relaxed">{fileMap.explicacion}</p>
      </div>

      {fileMap.estructura && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
            Estructura usada
          </div>
          <p className="text-sm text-slate-700 font-mono bg-slate-100/60 inline-block px-3 py-1.5 rounded-xl">
            {fileMap.estructura}
          </p>
        </div>
      )}

      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
          Flujo interno
        </div>
        <Mermaid chart={fileMap.diagrama_mermaid} />
      </div>

      {fileMap.funciones.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
            Funciones del archivo
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/70 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left font-bold px-4 py-2">Nombre real</th>
                  <th className="text-left font-bold px-4 py-2">Qué hace y cuándo</th>
                  <th className="text-left font-bold px-4 py-2">Llama a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {fileMap.funciones.map((fn) => (
                  <tr key={fn.real}>
                    <td className="px-4 py-2 font-mono text-indigo-700 align-top whitespace-nowrap">{fn.real}</td>
                    <td className="px-4 py-2 text-slate-700 align-top">{fn.humana}</td>
                    <td className="px-4 py-2 align-top">
                      {fn.llama_a.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {fn.llama_a.map((c) => (
                            <code
                              key={c}
                              className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md"
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
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
            Puntos clave
          </div>
          <ul className="space-y-1.5">
            {fileMap.puntos_clave.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-slate-700 text-sm">
                <span className="text-indigo-400 mt-1">●</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fileMap.resumen_archivo && (
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-1">
            En resumen
          </div>
          <p className="text-slate-800 text-sm font-medium">{fileMap.resumen_archivo}</p>
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
    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onExpand}
        className="w-full text-left px-6 py-5 flex items-start justify-between gap-4 group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ring-1 ${importanciaStyles[archivo.importancia]}`}
            >
              {archivo.importancia}
            </span>
            <code className="text-sm font-mono text-slate-500 truncate">{archivo.ruta}</code>
          </div>
          <p className="text-base text-slate-800 font-medium leading-snug">{archivo.rol}</p>
        </div>
        <div className="text-slate-300 group-hover:text-indigo-500 transition-colors mt-1">
          <svg
            className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-6 py-6 bg-slate-50/40 space-y-5">
          {loading && (
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              </div>
              Generando mapa de este archivo…
            </div>
          )}

          {error && (
            <div className="text-rose-700 text-sm bg-rose-50 border border-rose-100 rounded-xl p-3">
              ⚠️ {error}
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
      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm space-y-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
            Paso 1 — Sube la foto del diagrama
          </div>
          <p className="text-slate-600 text-sm">
            Foto de un flowchart en papel, pizarra, o exportado de Lucidchart/Draw.io. JPG, PNG o WebP. Máx 8 MB.
          </p>
        </div>

        {cameraActive ? (
          <div className="space-y-3">
            <div className="relative bg-black rounded-2xl overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full max-h-[480px] object-contain bg-black"
              />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                  Encendiendo cámara…
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl shadow-md shadow-indigo-200"
              >
                📸 Tomar foto
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-2xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : !imagePreview ? (
          <div className="space-y-3">
            <label
              htmlFor="diagram-upload"
              className="block border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-[2rem] p-12 text-center cursor-pointer transition-colors"
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
                <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-900">Subir archivo de imagen</p>
                <p className="text-slate-400 text-sm">JPG, PNG o WebP — hasta 8 MB</p>
              </div>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">o</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="w-full px-6 py-4 bg-white border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-slate-900 text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Usar webcam
            </button>
          </div>
        ) : (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Vista previa del diagrama"
              className="w-full max-h-96 object-contain rounded-2xl border border-slate-200 bg-slate-50"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-3 right-3 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold rounded-xl backdrop-blur"
            >
              Quitar
            </button>
          </div>
        )}
      </section>

      <section className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm space-y-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
            Paso 2 — Elige el lenguaje destino
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TARGET_LANGUAGE_LABELS) as TargetLanguage[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`px-4 py-2 rounded-2xl text-sm font-bold transition-colors ${
                language === lang
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          className="w-full px-6 py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-base font-black rounded-2xl transition-colors shadow-lg shadow-slate-200"
        >
          {loading ? 'Analizando diagrama…' : 'Generar código'}
        </button>
      </section>

      {error && (
        <div className="bg-rose-50 border-2 border-rose-100 p-6 rounded-[2rem] text-rose-700 font-medium">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
          </div>
          <p className="text-slate-700 font-medium">Gemini está leyendo tu diagrama…</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <section className="bg-indigo-50/60 border border-indigo-100 rounded-[2.5rem] p-8">
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-2">
              Qué entendí del diagrama
            </div>
            <p className="text-slate-800 leading-relaxed whitespace-pre-line">{result.interpretacion}</p>
          </section>

          <section className="bg-slate-950 rounded-[2.5rem] overflow-hidden border border-slate-800">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-indigo-400 font-mono text-xs font-bold tracking-widest uppercase">
                  Código · {result.lenguaje_detectado}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="p-6 text-sm font-mono text-slate-100 overflow-x-auto whitespace-pre">
              {result.codigo || '// Sin código generado'}
            </pre>
          </section>

          {(codeMapLoading || codeMap || codeMapError) && (
            <section className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-white px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-1">
                    Mapa del código
                  </div>
                  <p className="text-sm text-slate-600">Qué hace cada parte del código que se acaba de generar.</p>
                </div>
                {codeMapLoading && (
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
                  </div>
                )}
              </div>
              <div className="p-8 space-y-5">
                {codeMapLoading && !codeMap && (
                  <p className="text-slate-500 text-sm">Generando explicación paso a paso del código…</p>
                )}
                {codeMapError && (
                  <div className="text-rose-700 text-sm bg-rose-50 border border-rose-100 rounded-xl p-3">
                    ⚠️ {codeMapError}
                    <button
                      type="button"
                      onClick={() => result && fetchCodeMap(result.codigo, language, result.interpretacion)}
                      className="ml-3 px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700"
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
            <section className="bg-amber-50 border border-amber-200 rounded-[2.5rem] p-8 space-y-5">
              {result.supuestos.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
                    Supuestos que tuve que hacer
                  </div>
                  <ul className="space-y-1.5">
                    {result.supuestos.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-amber-900 text-sm">
                        <span className="text-amber-500 mt-1">●</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.advertencias.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">
                    Advertencias
                  </div>
                  <ul className="space-y-1.5">
                    {result.advertencias.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-amber-900 text-sm">
                        <span className="text-amber-500 mt-1">⚠</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-amber-700/70 italic pt-2 border-t border-amber-200">
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
    <div className="max-w-6xl mx-auto px-6 py-16 font-sans antialiased text-slate-900">
      <header className="text-center mb-16">
        <div className="inline-block px-4 py-1.5 mb-6 text-sm font-bold tracking-widest text-indigo-600 uppercase bg-indigo-50 rounded-full">
          Hackathon Edition v2.0
        </div>
        <h1 className="text-8xl font-black tracking-tighter mb-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 bg-clip-text text-transparent">
          VibeMap
        </h1>
        <p className="text-2xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
          ¿Codex o Claude te generó código y no entiendes qué hace?
          <br />
          Súbelo y te lo explico como mapa mental, en palabras simples.
        </p>
      </header>

      <div className="flex justify-center mb-12">
        <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('mapa')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'mapa'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Mapa de proyecto
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diagrama')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              activeTab === 'diagrama'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
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
            relative group border-2 border-dashed rounded-[3rem] p-20 text-center transition-all duration-700
            ${
              isDragActive
                ? 'border-indigo-600 bg-indigo-50/30 scale-[1.01] ring-8 ring-indigo-50'
                : 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="space-y-6">
            <div className="w-24 h-24 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 transition-transform duration-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12"
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
            <div className="space-y-2">
              <p className="text-3xl font-black tracking-tight text-slate-900">Suelta tu carpeta de proyecto</p>
              <p className="text-slate-400 text-lg font-medium">
                Funciona con código de cualquier IA: React, Python, Godot, Unity, C++, etc.
              </p>
            </div>
          </div>
        </section>

        {loading && (
          <div className="bg-white rounded-[3rem] p-12 shadow-xl border border-slate-100 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce"></div>
              </div>
              <div>
                <p className="text-xl font-black text-slate-900">
                  Mapeando {fileCount} archivos…
                </p>
                <p className="text-slate-500 text-sm font-medium">Gemini está armando el mapa general.</p>
              </div>
            </div>
            {streamingText && (
              <pre className="text-xs font-mono text-slate-400 bg-slate-50 p-4 rounded-2xl overflow-hidden max-h-40 whitespace-pre-wrap">
                {streamingText.slice(-1200)}
              </pre>
            )}
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border-2 border-rose-100 p-8 rounded-[2.5rem] flex items-center justify-between gap-5">
            <div className="flex items-center gap-5">
              <div className="bg-rose-500 text-white p-3 rounded-2xl shadow-lg shadow-rose-200 shrink-0">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-black text-rose-950">Algo falló</p>
                <p className="text-rose-700 font-medium">{error}</p>
              </div>
            </div>
            {files.length > 0 && (
              <button
                type="button"
                onClick={handleRetry}
                className="shrink-0 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-2xl transition-colors shadow-md shadow-rose-200"
              >
                Reintentar
              </button>
            )}
          </div>
        )}

        {overview && (
          <>
            <section className="bg-white rounded-[3rem] shadow-[0_30px_60px_-16px_rgba(0,0,0,0.08)] border border-slate-50 overflow-hidden">
              <div className="bg-slate-950 px-10 py-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                    <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                    <div className="w-3 h-3 rounded-full bg-slate-800"></div>
                  </div>
                  <div className="h-6 w-px bg-slate-800 mx-2"></div>
                  <span className="text-indigo-400 font-mono text-xs font-bold tracking-[0.4em] uppercase">
                    Mapa General
                  </span>
                </div>
                <div className="px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                  <span className="text-indigo-400 text-xs font-black uppercase tracking-widest">
                    {fileCount} archivos
                  </span>
                </div>
              </div>
              <div className="p-10 space-y-8">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                    De qué va el proyecto
                  </div>
                  <p className="text-2xl text-slate-800 leading-relaxed font-medium">{overview.resumen}</p>
                </div>
                {overview.estructura_general && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                      Estructura general
                    </div>
                    <p className="text-base text-slate-700 font-mono bg-slate-100/60 inline-block px-4 py-2 rounded-xl">
                      {overview.estructura_general}
                    </p>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">
                    Cómo se conecta todo
                  </div>
                  <Mermaid chart={overview.diagrama_mermaid} />
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between mb-4 px-2">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">Archivos del proyecto</h2>
                <p className="text-sm text-slate-400 font-medium">
                  Click para ver el mapa de cada uno
                </p>
              </div>
              <div className="space-y-3">
                {overview.archivos.map((a) => (
                  <FileCard
                    key={a.ruta}
                    archivo={a}
                    expanded={expandedPath === a.ruta}
                    onExpand={() => handleExpandFile(a.ruta)}
                    fileMap={fileMaps[a.ruta] ?? null}
                    loading={!!fileMapLoading[a.ruta]}
                    error={fileMapErrors[a.ruta] ?? null}
                  />
                ))}
              </div>
            </section>

            {overview.recapitulacion && overview.recapitulacion.length > 0 && (
              <section className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50/40 rounded-[3rem] p-12 border border-indigo-100">
                <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 mb-3">
                  Para llevarte
                </div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-6">
                  Si solo recuerdas {overview.recapitulacion.length === 1 ? 'una cosa' : `${overview.recapitulacion.length} cosas`}…
                </h2>
                <ul className="space-y-3">
                  {overview.recapitulacion.map((punto, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-lg text-slate-800 leading-relaxed font-medium pt-0.5">{punto}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
      )}

      <footer className="mt-32 text-center pb-20 space-y-4">
        <div className="w-20 h-1 bg-slate-200 mx-auto rounded-full mb-10"></div>
        <p className="text-slate-400 font-bold tracking-widest uppercase text-sm">
          VibeMap Hackathon Engine &copy; 2026
        </p>
        <p className="text-slate-300 text-sm">Diseñado para entender código generado por IA</p>
      </footer>
    </div>
  )
}

export default App
