import { useCallback, useRef } from 'react'

type Position = { x: number; y: number }
type Snapshot = Map<string, Position>

const MAX_HISTORY = 50

/**
 * Undo/Redo hook for node positions.
 * Records a snapshot each time the user finishes dragging (not every frame).
 * Each view (overview/features/steps) has its own independent history stack.
 */
export function useUndoRedo() {
  // 按 viewKey 分桶的历史栈
  const stacksRef = useRef<Map<string, {
    past: Snapshot[]
    future: Snapshot[]
  }>>(new Map())

  const getStack = useCallback((viewKey: string) => {
    let stack = stacksRef.current.get(viewKey)
    if (!stack) {
      stack = { past: [], future: [] }
      stacksRef.current.set(viewKey, stack)
    }
    return stack
  }, [])

  /** 记录一个快照（拖动结束时调用） */
  const record = useCallback((viewKey: string, snapshot: Snapshot) => {
    const stack = getStack(viewKey)
    stack.past.push(snapshot)
    if (stack.past.length > MAX_HISTORY) stack.past.shift()
    // 新操作清空 future（不能 redo 了）
    stack.future = []
  }, [getStack])

  /** Undo：回到上一个快照，返回该快照；如果没有历史返回 null */
  const undo = useCallback((viewKey: string, current: Snapshot): Snapshot | null => {
    const stack = getStack(viewKey)
    if (stack.past.length === 0) return null
    // 把当前状态推入 future
    stack.future.push(current)
    // 弹出上一个状态
    return stack.past.pop()!
  }, [getStack])

  /** Redo：前进到下一个快照，返回该快照；如果没有 future 返回 null */
  const redo = useCallback((viewKey: string, current: Snapshot): Snapshot | null => {
    const stack = getStack(viewKey)
    if (stack.future.length === 0) return null
    // 把当前状态推入 past
    stack.past.push(current)
    // 弹出下一个状态
    return stack.future.pop()!
  }, [getStack])

  /** 是否可以 undo/redo */
  const canUndo = useCallback((viewKey: string) => {
    return (stacksRef.current.get(viewKey)?.past.length ?? 0) > 0
  }, [])

  const canRedo = useCallback((viewKey: string) => {
    return (stacksRef.current.get(viewKey)?.future.length ?? 0) > 0
  }, [])

  return { record, undo, redo, canUndo, canRedo }
}
