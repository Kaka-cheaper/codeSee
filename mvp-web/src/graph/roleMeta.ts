import type { StepRole } from '@/fcg/types'

/**
 * Step 角色的视觉与中文标签。
 * 配色思路：相邻角色用同色相不同明度，避免画布颜色喧宾夺主。
 */
export const ROLE_META: Record<
  StepRole,
  { label: string; bg: string; fg: string; minimap: string }
> = {
  input: {
    label: '入口',
    bg: 'oklch(0.93 0.04 230)',
    fg: 'oklch(0.42 0.07 230)',
    minimap: 'oklch(0.78 0.05 230)',
  },
  validation: {
    label: '校验',
    bg: 'oklch(0.93 0.04 200)',
    fg: 'oklch(0.42 0.06 200)',
    minimap: 'oklch(0.78 0.05 200)',
  },
  auth: {
    label: '鉴权',
    bg: 'oklch(0.92 0.06 50)',
    fg: 'oklch(0.46 0.13 40)',
    minimap: 'oklch(0.78 0.11 45)',
  },
  'data-read': {
    label: '读数据',
    bg: 'oklch(0.92 0.04 160)',
    fg: 'oklch(0.4 0.07 150)',
    minimap: 'oklch(0.78 0.06 150)',
  },
  'data-write': {
    label: '写数据',
    bg: 'oklch(0.91 0.05 140)',
    fg: 'oklch(0.4 0.08 140)',
    minimap: 'oklch(0.76 0.07 140)',
  },
  compute: {
    label: '计算',
    bg: 'oklch(0.93 0.04 280)',
    fg: 'oklch(0.42 0.07 280)',
    minimap: 'oklch(0.78 0.05 280)',
  },
  transform: {
    label: '转换',
    bg: 'oklch(0.93 0.035 305)',
    fg: 'oklch(0.42 0.07 305)',
    minimap: 'oklch(0.8 0.06 305)',
  },
  'side-effect': {
    label: '副作用',
    bg: 'oklch(0.92 0.06 30)',
    fg: 'oklch(0.5 0.13 30)',
    minimap: 'oklch(0.78 0.11 30)',
  },
  output: {
    label: '出口',
    bg: 'oklch(0.93 0.04 130)',
    fg: 'oklch(0.42 0.07 130)',
    minimap: 'oklch(0.78 0.05 130)',
  },
  error: {
    label: '错误',
    bg: 'oklch(0.92 0.06 25)',
    fg: 'oklch(0.5 0.14 25)',
    minimap: 'oklch(0.78 0.12 25)',
  },
  other: {
    label: '其他',
    bg: 'oklch(0.92 0.012 70)',
    fg: 'oklch(0.5 0.018 65)',
    minimap: 'oklch(0.8 0.012 70)',
  },
}

import type { FlowKind } from '@/fcg/types'

export const FLOW_META: Record<
  FlowKind,
  { label: string; stroke: string; dashed: boolean; animated: boolean }
> = {
  next: {
    label: '',
    stroke: 'var(--color-edge-call)',
    dashed: false,
    animated: false,
  },
  async: {
    label: '异步',
    stroke: 'var(--color-edge-route)',
    dashed: true,
    animated: true,
  },
  conditional: {
    label: '条件',
    stroke: 'oklch(0.6 0.02 50)',
    dashed: false,
    animated: false,
  },
  loop: {
    label: '循环',
    stroke: 'oklch(0.55 0.06 240)',
    dashed: false,
    animated: false,
  },
  error: {
    label: '错误',
    stroke: 'oklch(0.6 0.13 25)',
    dashed: true,
    animated: false,
  },
}
