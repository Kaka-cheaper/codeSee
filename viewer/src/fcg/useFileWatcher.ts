import { useEffect, useRef } from 'react'
import { fetchFromUrl } from './loader'
import { getFeaturesHandle, readFeaturesFromHandle } from './fileSystem'
import type { FeaturesFile } from './types'

const POLL_INTERVAL_MS = 3000

export type WatchSource =
  | { kind: 'url'; url: string }
  | { kind: 'fsa'; repoId: string }

interface Options {
  enabled: boolean
  source: WatchSource | null
  /** 当前内容的 raw（用于对比），变化时调 onChange */
  currentRaw: string
  onChange: (file: FeaturesFile, raw: string) => void
}

/**
 * 文件 watcher：定时轮询数据源，检测到内容变化时调用 onChange。
 *
 * 两种数据源：
 * - url：fetch /features.json（内置示例 / 静态部署）
 * - fsa：File System Access API 文件句柄（用户授权过的本地文件）
 *
 * 关键设计：
 * - 用 raw text 对比而非 JSON.stringify，避免序列化抖动
 * - 文件句柄用 lastModified 优先判断，加速对比
 * - enabled 关闭时彻底停止轮询，不浪费请求
 */
export function useFileWatcher({ enabled, source, currentRaw, onChange }: Options): void {
  const lastRawRef = useRef(currentRaw)
  const lastModifiedRef = useRef<number>(0)
  const inFlightRef = useRef(false)
  const onChangeRef = useRef(onChange)

  // 始终用最新的 onChange（避免依赖触发 setInterval 重置）
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // currentRaw 变化（外部加载新文件）时，重置基线避免误报
  useEffect(() => {
    lastRawRef.current = currentRaw
  }, [currentRaw])

  useEffect(() => {
    if (!enabled || !source) return

    let cancelled = false

    const tick = async () => {
      if (cancelled || inFlightRef.current) return
      inFlightRef.current = true
      try {
        if (source.kind === 'url') {
          const res = await fetchFromUrl(source.url)
          if (!res.ok || cancelled) return
          if (res.raw !== lastRawRef.current) {
            lastRawRef.current = res.raw
            onChangeRef.current(res.file, res.raw)
          }
        } else {
          const handle = await getFeaturesHandle(source.repoId)
          if (!handle || cancelled) return
          const result = await readFeaturesFromHandle(handle)
          if (!result || cancelled) return
          // lastModified 没变就跳过 raw 对比
          if (result.lastModified === lastModifiedRef.current) return
          lastModifiedRef.current = result.lastModified
          if (result.raw !== lastRawRef.current) {
            try {
              const data = JSON.parse(result.raw) as FeaturesFile
              if (data.version === '0' && Array.isArray(data.features)) {
                lastRawRef.current = result.raw
                onChangeRef.current(data, result.raw)
              }
            } catch { /* 解析失败，忽略本次 */ }
          }
        }
      } finally {
        inFlightRef.current = false
      }
    }

    // 立即跑一次（不等 3 秒）
    void tick()
    const timer = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [enabled, source])
}
