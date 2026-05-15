import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** 顶层错误边界：渲染异常时展示友好错误提示而不是空白页 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 在开发环境保留 console，方便排查
    console.error('[CodeSee] 渲染异常:', error, info)
  }

  reset = () => {
    this.setState({ error: null })
    // 同时清掉 localStorage 缓存（很可能是上次缓存的坏数据）
    try {
      localStorage.removeItem('codesee.lastFeaturesFile.v0')
    } catch {
      /* noop */
    }
    // 软刷新到首页
    location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex h-full w-full items-center justify-center px-6 text-[var(--color-fg)]">
        <div className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-6 py-6 shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'var(--color-bg-sunken)', color: 'var(--color-accent-strong)' }}
            >
              <AlertTriangle size={16} />
            </span>
            <h2 className="text-[14px] font-medium">画布渲染出错</h2>
          </div>
          <p className="text-[12px] leading-relaxed text-[var(--color-fg-muted)]">
            通常是 features.json 包含 schema 之外的字段（例如 step.role 不在允许的 11 类中、flow.kind 缺失或拼错）。
          </p>
          <p className="text-[11.5px] leading-relaxed text-[var(--color-fg-muted)]">
            建议：在目标项目里跑一次{' '}
            <code className="rounded bg-[var(--color-bg-2)] px-1 font-mono text-[11px]">
              node .codesee/scripts/validate-features.mjs
            </code>{' '}
            按报错修复后重新加载。
          </p>
          <pre className="max-h-32 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-sunken)] p-2 font-mono text-[10.5px] text-[var(--color-fg-muted)]">
            {error.message}
          </pre>
          <div className="flex justify-end">
            <button
              onClick={this.reset}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-1.5 text-[12px] text-[var(--color-fg)] hover:bg-[var(--color-bg-sunken)]"
            >
              清空缓存并重载
            </button>
          </div>
        </div>
      </div>
    )
  }
}
