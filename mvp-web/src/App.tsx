import { ReactFlowProvider } from '@xyflow/react'
import { GraphCanvas } from '@/graph/GraphCanvas'
import { TopBar } from '@/app/TopBar'
import { sampleUcg } from '@/ucg/sample'

export default function App() {
  // MVP：直接吃示例 UCG。后续替换为加载本地 / HTTP 拿到的 ucg.json
  const ucg = sampleUcg

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-bg-0)] text-[var(--color-fg)]">
      <TopBar ucg={ucg} />
      <div className="relative flex-1">
        <ReactFlowProvider>
          <GraphCanvas ucg={ucg} />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
