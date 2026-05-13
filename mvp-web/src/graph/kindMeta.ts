import type { EdgeKind, NodeKind } from '@/ucg/types'

/**
 * 节点 kind 的视觉元数据（语言无关）。
 * 设计：浅色暖底 + 深色字图标，避免任何饱和高、对比强的配色。
 */
export const NODE_KIND_META: Record<
  NodeKind,
  { label: string; chipBg: string; chipFg: string; minimap: string }
> = {
  module: {
    label: 'Module',
    chipBg: 'var(--color-kind-module)',
    chipFg: 'var(--color-kind-module-fg)',
    minimap: 'oklch(0.78 0.04 240)',
  },
  class: {
    label: 'Class',
    chipBg: 'var(--color-kind-class)',
    chipFg: 'var(--color-kind-class-fg)',
    minimap: 'oklch(0.78 0.05 200)',
  },
  function: {
    label: 'Function',
    chipBg: 'var(--color-kind-function)',
    chipFg: 'var(--color-kind-function-fg)',
    minimap: 'oklch(0.78 0.06 150)',
  },
  method: {
    label: 'Method',
    chipBg: 'var(--color-kind-function)',
    chipFg: 'var(--color-kind-function-fg)',
    minimap: 'oklch(0.78 0.06 150)',
  },
  route: {
    label: 'Route',
    chipBg: 'var(--color-kind-route)',
    chipFg: 'var(--color-kind-route-fg)',
    minimap: 'oklch(0.8 0.09 75)',
  },
  task: {
    label: 'Task',
    chipBg: 'var(--color-kind-task)',
    chipFg: 'var(--color-kind-task-fg)',
    minimap: 'oklch(0.78 0.11 45)',
  },
  signal: {
    label: 'Signal',
    chipBg: 'var(--color-kind-task)',
    chipFg: 'var(--color-kind-task-fg)',
    minimap: 'oklch(0.78 0.11 45)',
  },
  data_model: {
    label: 'Data',
    chipBg: 'var(--color-kind-data)',
    chipFg: 'var(--color-kind-data-fg)',
    minimap: 'oklch(0.8 0.06 305)',
  },
  external: {
    label: 'External',
    chipBg: 'var(--color-kind-external)',
    chipFg: 'var(--color-kind-external-fg)',
    minimap: 'oklch(0.8 0.012 70)',
  },
}

export const EDGE_KIND_META: Record<
  EdgeKind,
  { label: string; stroke: string; dashed: boolean }
> = {
  call: { label: 'call', stroke: 'var(--color-edge-call)', dashed: false },
  import: { label: 'import', stroke: 'var(--color-edge-import)', dashed: false },
  inherit: { label: 'inherit', stroke: 'var(--color-edge-import)', dashed: false },
  read: { label: 'read', stroke: 'var(--color-edge-import)', dashed: false },
  write: { label: 'write', stroke: 'var(--color-edge-import)', dashed: false },
  route_to: { label: 'route', stroke: 'var(--color-edge-route)', dashed: false },
  publish: { label: 'publish', stroke: 'var(--color-edge-route)', dashed: true },
  subscribe: { label: 'subscribe', stroke: 'var(--color-edge-route)', dashed: true },
  contains: { label: 'contains', stroke: 'var(--color-edge-import)', dashed: false },
}
