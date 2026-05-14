import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { loadUcg } from '@/ucg/loader'
import type { Ucg } from '@/ucg/types'

export default function App() {
  const [ucg, setUcg] = useState<Ucg | null>(null)
  const [source, setSource] = useState<'fetched' | 'sample'>('sample')

  useEffect(() => {
    let cancelled = false
    loadUcg().then((res) => {
      if (cancelled) return
      setUcg(res.ucg)
      setSource(res.source)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col text-[var(--color-fg)]">
      {ucg && <TopBar ucg={ucg} source={source} />}
      <div className="relative flex-1">
        {ucg ? (
          <ReactFlowProvider>
            <GraphCanvas ucg={ucg} />
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
