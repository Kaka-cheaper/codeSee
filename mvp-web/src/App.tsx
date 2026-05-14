import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { loadFeatures } from '@/fcg/loader'
import type { FeaturesFile } from '@/fcg/types'

export default function App() {
  const [file, setFile] = useState<FeaturesFile | null>(null)
  const [loaded, setLoaded] = useState<'pending' | 'ok' | 'missing'>('pending')

  useEffect(() => {
    let cancelled = false
    loadFeatures().then((f) => {
      if (cancelled) return
      if (f) {
        setFile(f)
        setLoaded('ok')
      } else {
        setLoaded('missing')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col text-[var(--color-fg)]">
      <TopBar file={file} loaded={loaded} />
      <div className="relative flex-1">
        {file ? (
          <ReactFlowProvider>
            <GraphCanvas file={file} />
          </ReactFlowProvider>
        ) : (
          <EmptyState loaded={loaded} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ loaded }: { loaded: 'pending' | 'ok' | 'missing' }) {
  if (loaded === 'pending') {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[var(--color-fg-subtle)]">
        正在加载 features.json…
      </div>
    )
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[14px] font-medium text-[var(--color-fg)]">
        没有找到 features.json
      </p>
      <p className="max-w-md text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
        把语义化的功能流程写到{' '}
        <code className="rounded bg-[var(--color-bg-2)] px-1 font-mono text-[11px]">
          mvp-web/public/features.json
        </code>{' '}
        即可加载。可以让 AI IDE 直接生成或维护这份文件。
      </p>
    </div>
  )
}
