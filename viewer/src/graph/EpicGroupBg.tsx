import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

export type EpicGroupBgData = {
  label: string
  width: number
  height: number
  colorIndex?: number
  dimmed?: boolean
}

/**
 * 容器配色：8 种暖色系，低饱和度，按 index 循环。
 * 每种有 bg（容器底色）和 bar（顶部色条）。
 */
const PALETTE = [
  { bg: 'oklch(0.96 0.02 60)',  bar: 'oklch(0.72 0.12 55)' },   // 暖橘
  { bg: 'oklch(0.96 0.02 200)', bar: 'oklch(0.65 0.1 210)' },   // 青蓝
  { bg: 'oklch(0.96 0.02 140)', bar: 'oklch(0.6 0.12 150)' },   // 绿
  { bg: 'oklch(0.96 0.02 300)', bar: 'oklch(0.68 0.1 310)' },   // 紫
  { bg: 'oklch(0.96 0.02 30)',  bar: 'oklch(0.7 0.13 35)' },    // 红橙
  { bg: 'oklch(0.96 0.02 240)', bar: 'oklch(0.62 0.1 245)' },   // 靛蓝
  { bg: 'oklch(0.96 0.02 100)', bar: 'oklch(0.65 0.1 105)' },   // 黄绿
  { bg: 'oklch(0.96 0.02 350)', bar: 'oklch(0.68 0.1 355)' },   // 玫红
]

function EpicGroupBgImpl({ data }: NodeProps) {
  const { label, width, height, colorIndex, dimmed } = data as unknown as EpicGroupBgData
  const palette = PALETTE[(colorIndex ?? 0) % PALETTE.length]

  return (
    <div
      style={{ width, height, background: palette.bg, opacity: dimmed ? 0.25 : 1 }}
      className="rounded-2xl border border-[var(--color-border)] shadow-[0_1px_3px_oklch(0_0_0/0.04)] transition-opacity duration-200"
    >
      {/* 顶部色条 */}
      <div
        className="flex items-center gap-2 rounded-t-2xl px-4 py-2"
        style={{ background: palette.bar }}
      >
        <span className="text-[12px] font-medium text-white/90 drop-shadow-[0_1px_1px_oklch(0_0_0/0.2)]">
          {label}
        </span>
      </div>
    </div>
  )
}

export const EpicGroupBg = memo(EpicGroupBgImpl)
