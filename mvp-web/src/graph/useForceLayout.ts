import { useCallback, useEffect, useRef } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { FcgViewEdge, FcgViewNode } from './fcgView'

interface ForceNode extends SimulationNodeDatum {
  id: string
  width: number
  height: number
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  id: string
}

interface UseForceLayoutOptions {
  nodes: FcgViewNode[]
  edges: FcgViewEdge[]
  measuredSizes: Map<string, { width: number; height: number }>
  enabled: boolean
  onTick: (positions: Map<string, { x: number; y: number }>) => void
}

const DEFAULT_SIZE = { width: 300, height: 100 }

/**
 * 力导向布局 hook（概览视图专用）。
 * 持续模拟物理力：节点互相排斥 + 有边的互相吸引 + 碰撞检测防重叠。
 * 拖动节点时固定该节点位置，其他节点实时弹开。
 */
export function useForceLayout({
  nodes,
  edges,
  measuredSizes,
  enabled,
  onTick,
}: UseForceLayoutOptions) {
  const simRef = useRef<Simulation<ForceNode, ForceLink> | null>(null)
  const nodesRef = useRef<ForceNode[]>([])

  // 初始化 / 更新模拟
  useEffect(() => {
    if (!enabled) {
      simRef.current?.stop()
      simRef.current = null
      return
    }

    const forceNodes: ForceNode[] = nodes.map((n) => {
      const size = measuredSizes.get(n.id) ?? DEFAULT_SIZE
      // 复用上次位置（如果有）
      const prev = nodesRef.current.find((p) => p.id === n.id)
      return {
        id: n.id,
        x: prev?.x ?? Math.random() * 600 - 300,
        y: prev?.y ?? Math.random() * 400 - 200,
        width: size.width,
        height: size.height,
      }
    })
    nodesRef.current = forceNodes

    const forceLinks: ForceLink[] = edges
      .filter((e) => forceNodes.some((n) => n.id === e.source) && forceNodes.some((n) => n.id === e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }))

    const sim = forceSimulation<ForceNode>(forceNodes)
      .force(
        'link',
        forceLink<ForceNode, ForceLink>(forceLinks)
          .id((d) => d.id)
          .distance(280)
          .strength(0.4),
      )
      .force('charge', forceManyBody<ForceNode>().strength(-800))
      .force(
        'collide',
        forceCollide<ForceNode>()
          .radius((d) => Math.max(d.width, d.height) / 2 + 30)
          .strength(0.8),
      )
      .force('center', forceCenter(0, 0).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.4)
      .on('tick', () => {
        const positions = new Map<string, { x: number; y: number }>()
        for (const n of forceNodes) {
          positions.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 })
        }
        onTick(positions)
      })

    simRef.current = sim

    return () => {
      sim.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nodes.length, edges.length])

  /** 拖动开始：固定节点 */
  const onDragStart = useCallback((nodeId: string) => {
    const sim = simRef.current
    if (!sim) return
    sim.alphaTarget(0.3).restart()
    const n = nodesRef.current.find((d) => d.id === nodeId)
    if (n) {
      n.fx = n.x
      n.fy = n.y
    }
  }, [])

  /** 拖动中：更新固定位置 */
  const onDrag = useCallback((nodeId: string, x: number, y: number) => {
    const n = nodesRef.current.find((d) => d.id === nodeId)
    if (n) {
      n.fx = x
      n.fy = y
    }
  }, [])

  /** 拖动结束：释放节点 */
  const onDragEnd = useCallback((nodeId: string) => {
    const sim = simRef.current
    if (!sim) return
    sim.alphaTarget(0)
    const n = nodesRef.current.find((d) => d.id === nodeId)
    if (n) {
      n.fx = null
      n.fy = null
    }
  }, [])

  return { onDragStart, onDrag, onDragEnd }
}
