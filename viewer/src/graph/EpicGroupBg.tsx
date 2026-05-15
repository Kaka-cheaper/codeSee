import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

export type EpicGroupBgData = {
  label: string
  width: number
  height: number
}

function EpicGroupBgImpl({ data }: NodeProps) {
  const { label, width, height } = data as unknown as EpicGroupBgData
  return (
    <div
      style={{ width, height }}
      className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-2)]/40"
    >
      <div className="px-4 pt-3 text-[11px] font-medium tracking-wide text-[var(--color-fg-subtle)]">
        {label}
      </div>
    </div>
  )
}

export const EpicGroupBg = memo(EpicGroupBgImpl)
