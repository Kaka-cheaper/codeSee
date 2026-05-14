import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { loadUcg } from '@/ucg/loader'
import { loadAnnotations } from '@/ucg/annotations'
import type { AnnotationsFile, Ucg } from '@/ucg/types'

export default function App() {
  const [ucg, setUcg] = useState<Ucg | null>(null)
  const [annotations, setAnnotations] = useState<AnnotationsFile | null>(null)
  const [source, setSource] = useState<'fetched' | 'sample'>('sample')
  const [hasAnnotations, setHasAnnotations] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadUcg(), loadAnnotations()]).then(([ucgRes, annotRes]) => {
      if (cancelled) return
      setUcg(ucgRes.ucg)
      setSource(ucgRes.source)
      setAnnotations(annotRes)
      setHasAnnotations(!!annotRes)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col text-[var(--color-fg)]">
      {ucg && <TopBar ucg={ucg} source={source} hasAnnotations={hasAnnotations} />}
      <div className="relative flex-1">
        {ucg ? (
          <ReactFlowProvider>
            <GraphCanvas ucg={ucg} annotations={annotations} />
          </ReactFlowProvider>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-[var(--color-fg-subtle)]">
            正在加载 UCG…
          </div>
        )}
      </div>
    </div>
  )
}
