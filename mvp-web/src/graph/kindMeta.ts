import type { EdgeKind, NodeKind } from '@/ucg/types'

/** 节点 kind 的视觉与语言无关的元数据。 */
export const NODE_KIND_META: Record<
  NodeKind,
  { label: string; color: string; dot: string }
> = {
  module: {
    label: 'Module',
    color: 'var(--color-kind-module)',
    dot: 'oklch(0.78 0.12 250)',
  },
  class: {
    label: 'Class',
    color: 'var(--color-kind-class)',
    dot: 'oklch(0.78 0.13 200)',
  },
  function: {
    label: 'Function',
    color: 'var(--color-kind-function)',
    dot: 'oklch(0.82 0.14 160)',
  },
  method: {
    label: 'Method',
    color: 'var(--color-kind-function)',
    dot: 'oklch(0.82 0.14 160)',
  },
  route: {
    label: 'Route',
    color: 'var(--color-kind-route)',
    dot: 'oklch(0.82 0.14 80)',
  },
  task: {
    label: 'Task',
    color: 'var(--color-kind-task)',
    dot: 'oklch(0.78 0.16 30)',
  },
  signal: {
    label: 'Signal',
    color: 'var(--color-kind-task)',
    dot: 'oklch(0.78 0.16 30)',
  },
  data_model: {
    label: 'Data',
    color: 'var(--color-kind-data)',
    dot: 'oklch(0.78 0.13 320)',
  },
  external: {
    label: 'External',
    color: 'var(--color-kind-external)',
    dot: 'oklch(0.65 0.02 260)',
  },
}

export const EDGE_KIND_META: Record<EdgeKind, { label: string; stroke: string; dashed: boolean }> = {
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
