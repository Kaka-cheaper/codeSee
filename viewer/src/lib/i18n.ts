import { createContext, useContext } from 'react'

export type Locale = 'zh-CN' | 'en'

const dict = {
  'zh-CN': {
    // TopBar
    'topbar.noData': '无数据',
    'topbar.open': '打开',
    'topbar.openTitle': '打开 features.json',
    'topbar.clearTitle': '清除已加载的文件并回到示例',

    // EmptyState
    'empty.loading': '正在加载…',
    'empty.title': '打开一份 features.json',
    'empty.desc': '把目标项目的 {code} 拖到这里，或点下面按钮选择文件。',
    'empty.hint': '没有这个文件？让 AI IDE 在你的项目里读取 {code} 自动生成。',
    'empty.pick': '选择文件',

    // Drag overlay
    'drag.hint': '松手即可加载 features.json',

    // ViewSwitcher
    'view.overview': '概览',
    'view.features': '功能',
    'view.steps': '流程',
    'view.auto': '自动',
    'view.autoOnTitle': '自动保存：开（拖动后自动写入 layout.json）',
    'view.autoOffTitle': '自动保存：关 — 点击启用（首次会请求授权选择 .codesee 目录）',
    'view.saveTitle': '保存当前布局到 .codesee/layout.json（首次会请求授权选择 .codesee 目录）',
    'view.undoTitle': '撤销 (Ctrl+Z)',
    'view.redoTitle': '重做 (Ctrl+Shift+Z)',
    'view.resetTitle': '重置布局（清除当前视图保存的位置）',
    'view.stepsLabel': '流程：',
    'view.stepsNeedFeature': '请先在功能视图双击一个功能',
    'view.saved': '已保存到 layout.json',
    'view.downloaded': '已下载（请放回 .codesee/）',
    'view.failed': '保存失败',
    'view.newNodes': '+{count} 个新节点',

    // Language
    'lang.switch': '中/En',
    'lang.title': '切换语言 / Switch Language',

    // Live reload
    'live.on': '实时',
    'live.off': '实时',
    'live.onTitle': '实时刷新：开（每 3 秒检查一次 features.json 变化）',
    'live.offTitle': '实时刷新：关',
    'live.updated': '已更新',

    // Projects
    'projects.yours': '你的项目',
    'projects.bundled': '内置示例',
    'projects.add': '添加项目（选目录或文件）',
    'projects.remove': '从列表中移除',
    'projects.confirmRemove': '确认从项目列表移除「{name}」吗？目录授权和缓存都会被清除。',

    // Reauthorize banner
    'reauth.message': '「{name}」需要重新授权才能访问目录（当前显示的是默认示例）',
    'reauth.action': '重新授权',
    'reauth.dismiss': '关闭提示',
  },
  en: {
    // TopBar
    'topbar.noData': 'no data',
    'topbar.open': 'Open',
    'topbar.openTitle': 'Open features.json',
    'topbar.clearTitle': 'Clear loaded file and return to example',

    // EmptyState
    'empty.loading': 'Loading…',
    'empty.title': 'Open a features.json',
    'empty.desc': 'Drag your project\'s {code} here, or click the button below to select a file.',
    'empty.hint': 'Don\'t have this file? Let your AI IDE read {code} to generate it automatically.',
    'empty.pick': 'Select File',

    // Drag overlay
    'drag.hint': 'Drop to load features.json',

    // ViewSwitcher
    'view.overview': 'Overview',
    'view.features': 'Features',
    'view.steps': 'Steps',
    'view.auto': 'Auto',
    'view.autoOnTitle': 'Auto-save: ON (writes layout.json after drag)',
    'view.autoOffTitle': 'Auto-save: OFF — click to enable (first time will ask for directory access)',
    'view.saveTitle': 'Save layout to .codesee/layout.json (first time will ask for directory access)',
    'view.undoTitle': 'Undo (Ctrl+Z)',
    'view.redoTitle': 'Redo (Ctrl+Shift+Z)',
    'view.resetTitle': 'Reset layout (clear saved positions for this view)',
    'view.stepsLabel': 'Flow: ',
    'view.stepsNeedFeature': 'Double-click a feature in Features view first',
    'view.saved': 'Saved to layout.json',
    'view.downloaded': 'Downloaded (please move to .codesee/)',
    'view.failed': 'Save failed',
    'view.newNodes': '+{count} new nodes',

    // Language
    'lang.switch': 'En/中',
    'lang.title': 'Switch Language / 切换语言',

    // Live reload
    'live.on': 'Live',
    'live.off': 'Live',
    'live.onTitle': 'Live reload: ON (poll features.json every 3s)',
    'live.offTitle': 'Live reload: OFF',
    'live.updated': 'Updated',

    // Projects
    'projects.yours': 'Your projects',
    'projects.bundled': 'Examples',
    'projects.add': 'Add project (folder or file)',
    'projects.remove': 'Remove from list',
    'projects.confirmRemove': 'Remove "{name}" from project list? Directory access and cache will be cleared.',

    // Reauthorize banner
    'reauth.message': '"{name}" needs re-authorization to access the directory (showing default example for now)',
    'reauth.action': 'Reauthorize',
    'reauth.dismiss': 'Dismiss',
  },
} as const

export type I18nKey = keyof (typeof dict)['zh-CN']

export function t(locale: Locale, key: I18nKey, params?: Record<string, string | number>): string {
  let text: string = dict[locale][key] ?? dict['zh-CN'][key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

export interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: I18nKey, params?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  setLocale: () => {},
  t: (key) => key,
})

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
