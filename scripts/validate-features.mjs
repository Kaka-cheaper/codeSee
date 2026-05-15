#!/usr/bin/env node
// CodeSee · features.json 校验器
//
// 校验 .codesee/features.json 的结构与字段是否符合 FCG schema。
// 不校验业务语义（步骤顺序合不合理、有没有漏 feature），那是人 review 的事。
//
// 使用：
//   node .codesee/scripts/validate-features.mjs                   # 默认 .codesee/features.json
//   node .codesee/scripts/validate-features.mjs path/to/features.json
//   node .codesee/scripts/validate-features.mjs --strict          # 警告也视为失败
//
// 退出码：
//   0  通过（可能含警告）
//   1  有错误，必须修复
//   2  文件不存在 / JSON 解析失败
//
// 设计原则：zero-deps，单文件，可直接 node 跑。

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/* --------------------------------- enums --------------------------------- */

const TRIGGER_KINDS = [
  'http', 'cli', 'cron', 'event', 'ui', 'manual', 'startup', 'unknown',
]
const STEP_ROLES = [
  'input', 'validation', 'auth',
  'data-read', 'data-write',
  'compute', 'transform',
  'side-effect', 'output', 'error', 'other',
]
const FLOW_KINDS = ['next', 'async', 'conditional', 'loop', 'error']
const CROSS_KINDS = ['depends_on', 'publishes', 'subscribes', 'triggers']
const PROVENANCES = ['ai', 'user']

/* --------------------------------- helpers ------------------------------- */

const isString = (x) => typeof x === 'string'
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x)
const isArray = Array.isArray
const isNumber = (x) => typeof x === 'number' && Number.isFinite(x)
const isBoolean = (x) => typeof x === 'boolean'

function isIsoLike(s) {
  if (!isString(s)) return false
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s) && !Number.isNaN(Date.parse(s))
}

/* --------------------------------- args ---------------------------------- */

function parseArgs(argv) {
  let target = '.codesee/features.json'
  let strict = false
  for (const a of argv) {
    if (a === '--strict') strict = true
    else if (a === '-h' || a === '--help') {
      printHelp()
      process.exit(0)
    } else if (!a.startsWith('-')) {
      target = a
    } else {
      console.error(`未知参数: ${a}`)
      process.exit(2)
    }
  }
  return { target, strict }
}

function printHelp() {
  console.log(`
CodeSee · features.json 校验器

用法:
  node validate-features.mjs [features.json路径] [--strict]

参数:
  路径       默认 .codesee/features.json
  --strict   把 warning 也视为失败（CI 推荐）

退出码:
  0 通过；1 有错误；2 文件/JSON 异常
`)
}

/* --------------------------------- core ---------------------------------- */

const issues = { errors: [], warnings: [] }
const err = (p, msg) => issues.errors.push({ path: p, msg })
const warn = (p, msg) => issues.warnings.push({ path: p, msg })

function validate(data) {
  if (!isObject(data)) {
    err('$', '顶层必须是 JSON 对象')
    return
  }

  if (data.version !== '0') {
    err('$.version', `version 必须是 "0"，实际是 ${JSON.stringify(data.version)}`)
  }

  // manifest
  if (!isObject(data.manifest)) {
    err('$.manifest', 'manifest 必须是对象')
  } else {
    const m = data.manifest
    if (m.generated_at !== undefined) {
      if (!isString(m.generated_at)) err('$.manifest.generated_at', '必须是字符串')
      else if (!isIsoLike(m.generated_at)) warn('$.manifest.generated_at', `不是合法 ISO 时间: ${m.generated_at}`)
    } else {
      warn('$.manifest.generated_at', '建议提供 generated_at（ISO 时间）')
    }
    for (const k of ['repo', 'commit', 'generator']) {
      if (m[k] !== undefined && !isString(m[k])) err(`$.manifest.${k}`, '必须是字符串')
    }
  }

  // epics
  const epicIds = new Set()
  if (data.epics === undefined || !isArray(data.epics)) {
    err('$.epics', '必须是数组（即使为空）')
  } else {
    data.epics.forEach((e, i) => validateEpic(e, i, epicIds))
  }

  // features
  if (!isArray(data.features)) {
    err('$.features', '必须是数组')
    return
  }
  if (data.features.length === 0) {
    warn('$.features', 'features 数组为空，画布上不会显示任何功能')
  }
  const featureIds = new Set()
  data.features.forEach((f, i) => validateFeature(f, i, featureIds, epicIds))

  // cross_feature
  if (data.cross_feature !== undefined) {
    if (!isArray(data.cross_feature)) {
      err('$.cross_feature', '必须是数组（如果提供）')
    } else {
      data.cross_feature.forEach((l, i) => validateCrossFeature(l, i, featureIds))
    }
  }

  // epic_flow
  if (data.epic_flow !== undefined) {
    if (!isArray(data.epic_flow)) {
      err('$.epic_flow', '必须是数组（如果提供）')
    } else {
      const EPIC_FLOW_KINDS = ['next', 'depends_on', 'enables']
      data.epic_flow.forEach((ef, i) => {
        const p = `$.epic_flow[${i}]`
        if (!isObject(ef)) { err(p, '必须是对象'); return }
        if (!isString(ef.from) || !epicIds.has(ef.from)) {
          err(`${p}.from`, `指向不存在的 epic: ${JSON.stringify(ef.from)}`)
        }
        if (!isString(ef.to) || !epicIds.has(ef.to)) {
          err(`${p}.to`, `指向不存在的 epic: ${JSON.stringify(ef.to)}`)
        }
        if (!EPIC_FLOW_KINDS.includes(ef.kind)) {
          err(`${p}.kind`, `必须是 ${EPIC_FLOW_KINDS.join('/')}`)
        }
        if (!isString(ef.note) || !ef.note) {
          err(`${p}.note`, 'note 必填，且必须是中文语义短句（如"配置完成后运行"）')
        }
      })
    }
  }

  // 全局智能检查
  detectFileLevelSmells(data)
}

function validateEpic(e, i, epicIds) {
  const p = `$.epics[${i}]`
  if (!isObject(e)) { err(p, '必须是对象'); return }
  if (!isString(e.id) || !e.id) err(`${p}.id`, 'id 必填且为非空字符串')
  else if (epicIds.has(e.id)) err(`${p}.id`, `epic id 重复: "${e.id}"`)
  else epicIds.add(e.id)
  if (!isString(e.name) || !e.name) err(`${p}.name`, 'name 必填')
  if (e.summary !== undefined && !isString(e.summary)) err(`${p}.summary`, '必须是字符串')
  if (e.tags !== undefined) {
    if (!isArray(e.tags)) err(`${p}.tags`, '必须是字符串数组')
    else e.tags.forEach((t, ti) => { if (!isString(t)) err(`${p}.tags[${ti}]`, '必须是字符串') })
  }
  if (e.order !== undefined && !isNumber(e.order)) err(`${p}.order`, '必须是数字')
  if (e.importance !== undefined) {
    const IMPORTANCES = ['core', 'normal', 'auxiliary']
    if (!IMPORTANCES.includes(e.importance)) {
      err(`${p}.importance`, `必须是 ${IMPORTANCES.join('/')}`)
    }
  }
}

function validateFeature(f, i, featureIds, epicIds) {
  const p = `$.features[${i}]`
  if (!isObject(f)) { err(p, '必须是对象'); return }

  // id
  if (!isString(f.id) || !f.id) err(`${p}.id`, 'id 必填')
  else if (featureIds.has(f.id)) err(`${p}.id`, `feature id 重复: "${f.id}"`)
  else featureIds.add(f.id)

  // name
  if (!isString(f.name) || !f.name) err(`${p}.name`, 'name 必填')

  if (f.summary !== undefined && !isString(f.summary)) err(`${p}.summary`, '必须是字符串')

  // epicId
  if (f.epicId !== undefined) {
    if (!isString(f.epicId)) err(`${p}.epicId`, '必须是字符串')
    else if (!epicIds.has(f.epicId)) err(`${p}.epicId`, `指向不存在的 epic: "${f.epicId}"`)
  }

  // triggers
  if (f.triggers !== undefined) {
    if (!isArray(f.triggers)) err(`${p}.triggers`, '必须是数组')
    else f.triggers.forEach((t, ti) => validateTrigger(t, `${p}.triggers[${ti}]`))
  }

  // confidence
  if (!isNumber(f.confidence)) err(`${p}.confidence`, '必填，必须是数字')
  else if (f.confidence < 0 || f.confidence > 1) err(`${p}.confidence`, '必须在 [0, 1]')

  // provenance
  if (!PROVENANCES.includes(f.provenance)) {
    err(`${p}.provenance`, `必须是 ${PROVENANCES.join('/')}`)
  }

  if (f.locked !== undefined && !isBoolean(f.locked)) err(`${p}.locked`, '必须是布尔值')

  if (f.tags !== undefined) {
    if (!isArray(f.tags)) err(`${p}.tags`, '必须是数组')
    else f.tags.forEach((t, ti) => { if (!isString(t)) err(`${p}.tags[${ti}]`, '必须是字符串') })
  }

  // updated_at
  if (!isString(f.updated_at) || !f.updated_at) err(`${p}.updated_at`, '必填')
  else if (!isIsoLike(f.updated_at)) warn(`${p}.updated_at`, `不是合法 ISO 时间: ${f.updated_at}`)

  // steps
  const stepIds = new Set()
  if (!isArray(f.steps)) {
    err(`${p}.steps`, '必须是数组')
  } else if (f.steps.length === 0) {
    err(`${p}.steps`, '至少要有 1 个 step')
  } else {
    if (f.steps.length === 1) warn(`${p}.steps`, '只有 1 个 step，建议拆分')
    if (f.steps.length > 12) warn(`${p}.steps`, `${f.steps.length} 个 step 超过 12，可能粒度过细，考虑拆成多个 feature`)
    f.steps.forEach((s, si) => validateStep(s, `${p}.steps[${si}]`, stepIds))
  }

  // flow
  if (!isArray(f.flow)) {
    err(`${p}.flow`, '必须是数组')
  } else {
    f.flow.forEach((fl, fi) => validateFlow(fl, `${p}.flow[${fi}]`, stepIds))
    if (isArray(f.steps)) analyzeFlow(f, p, stepIds)
  }
}

function validateTrigger(t, p) {
  if (!isObject(t)) { err(p, '必须是对象'); return }
  if (!TRIGGER_KINDS.includes(t.kind)) err(`${p}.kind`, `必须是 ${TRIGGER_KINDS.join('/')}`)
  if (!isString(t.detail) || !t.detail) err(`${p}.detail`, '必填')
}

function validateStep(s, p, stepIds) {
  if (!isObject(s)) { err(p, '必须是对象'); return }
  if (!isString(s.id) || !s.id) err(`${p}.id`, '必填')
  else if (stepIds.has(s.id)) err(`${p}.id`, `feature 内 step id 重复: "${s.id}"`)
  else stepIds.add(s.id)

  if (!isString(s.name) || !s.name) {
    err(`${p}.name`, '必填')
  } else {
    detectCodeLikeName(s.name, `${p}.name`)
    if (s.name.length > 16) warn(`${p}.name`, `过长（${s.name.length} 字），建议 ≤ 8 字`)
  }

  if (!STEP_ROLES.includes(s.role)) err(`${p}.role`, `必须是 ${STEP_ROLES.join('/')}`)

  if (s.note !== undefined && !isString(s.note)) err(`${p}.note`, '必须是字符串')

  if (s.refs !== undefined) {
    if (!isArray(s.refs)) err(`${p}.refs`, '必须是数组')
    else s.refs.forEach((r, ri) => validateRef(r, `${p}.refs[${ri}]`))
  }
}

/** 启发式检测 step.name 是否像代码标识符 */
function detectCodeLikeName(name, p) {
  // 包含括号：函数调用形式
  if (/[()]/.test(name)) {
    warn(p, `name "${name}" 含括号，看起来像函数调用；改成动作短语，如"校验输入"`)
    return
  }
  // "调用 X" / "call X"
  if (/^调用\s/.test(name) || /^call\s/i.test(name)) {
    warn(p, `name "${name}" 写成了"调用..."；应该写成动作本身，如"比对密码"而不是"调用 bcrypt.compare"`)
    return
  }
  // 全英文 camelCase / snake_case 标识符
  if (/^[a-z][a-zA-Z0-9_]*$/.test(name)) {
    warn(p, `name "${name}" 看起来是英文代码标识符；应该用中文动作短语`)
    return
  }
  // 带 . 的限定名（Foo.bar）
  if (/^[A-Za-z][\w]*\.[A-Za-z][\w]*$/.test(name)) {
    warn(p, `name "${name}" 看起来是限定名；应该写成动作短语`)
    return
  }
  // 中文里夹 ASCII 标识符（如 "推送 tick_advanced" / "构造 RECONNECT_BACKOFF_MS"）
  // 触发条件：含中文 + 含 ASCII 单词且包含下划线 / 大写字母（排除常用术语）
  const COMMON_ACRONYMS = new Set([
    'JWT', 'DTO', 'API', 'URL', 'URI', 'HTTP', 'HTTPS', 'WS', 'SSE', 'JSON',
    'XML', 'YAML', 'CSV', 'PDF', 'HTML', 'CSS', 'SQL', 'CRUD', 'OAuth', 'SAML',
    'UUID', 'ID', 'RPC', 'gRPC', 'CLI', 'GUI', 'UI', 'UX', 'OK', 'NG',
    'CRON', 'TLS', 'SSL', 'CORS', 'CSRF', 'XSS', 'SSR', 'CSR',
  ])
  const hasChinese = /[\u4e00-\u9fa5]/.test(name)
  const asciiToken = name.match(/[a-zA-Z][a-zA-Z0-9_]{2,}/g)
  if (hasChinese && asciiToken) {
    const suspicious = asciiToken.find((t) => {
      if (COMMON_ACRONYMS.has(t)) return false
      // 触发：含下划线（snake_case 标识符），或前小后大的 camelCase（如 tickAdvanced）
      if (/_/.test(t)) return true
      if (/^[a-z]/.test(t) && /[A-Z]/.test(t)) return true
      // 全大写且超过 6 字母（如 RECONNECT_BACKOFF_MS）
      if (t === t.toUpperCase() && t.length >= 7) return true
      return false
    })
    if (suspicious) {
      warn(p, `name "${name}" 中文里嵌 ASCII 标识符 "${suspicious}"，疑似事件名/常量名照搬；改成纯中文动作`)
    }
  }
}

function validateRef(r, p) {
  if (!isObject(r)) { err(p, '必须是对象'); return }
  if (!isString(r.file) || !r.file) err(`${p}.file`, '必填')
  if (r.lines !== undefined) {
    if (!isArray(r.lines) || r.lines.length !== 2 ||
        !isNumber(r.lines[0]) || !isNumber(r.lines[1])) {
      err(`${p}.lines`, '必须是 [start, end] 数字元组')
    } else if (r.lines[0] > r.lines[1]) {
      err(`${p}.lines`, '起始行 > 结束行')
    } else if (r.lines[0] < 1) {
      err(`${p}.lines`, '行号必须 ≥ 1')
    }
  }
}

function validateFlow(fl, p, stepIds) {
  if (!isObject(fl)) { err(p, '必须是对象'); return }

  if (!isString(fl.from) || !fl.from) err(`${p}.from`, '必填')
  else if (!stepIds.has(fl.from)) err(`${p}.from`, `指向不存在的 step "${fl.from}"`)

  if (!isString(fl.to) || !fl.to) err(`${p}.to`, '必填')
  else if (!stepIds.has(fl.to)) err(`${p}.to`, `指向不存在的 step "${fl.to}"`)

  if (fl.from && fl.to && fl.from === fl.to) {
    err(p, `flow 自环: ${fl.from} → ${fl.to}`)
  }

  if (!FLOW_KINDS.includes(fl.kind)) err(`${p}.kind`, `必须是 ${FLOW_KINDS.join('/')}`)

  if (fl.condition !== undefined && !isString(fl.condition)) {
    err(`${p}.condition`, '必须是字符串')
  }
  if ((fl.kind === 'conditional' || fl.kind === 'loop') && !fl.condition) {
    warn(p, `${fl.kind} 边建议填 condition 描述（如"密码错误"、"对每条记录"）`)
  }
}

function analyzeFlow(f, p, stepIds) {
  if (stepIds.size === 0) return
  const steps = isArray(f.steps) ? f.steps : []
  const flow = isArray(f.flow) ? f.flow : []

  const inDeg = new Map()
  const outDeg = new Map()
  for (const s of steps) {
    if (!s || !isString(s.id)) continue
    inDeg.set(s.id, 0)
    outDeg.set(s.id, 0)
  }
  for (const fl of flow) {
    if (!fl) continue
    if (inDeg.has(fl.to)) inDeg.set(fl.to, inDeg.get(fl.to) + 1)
    if (outDeg.has(fl.from)) outDeg.set(fl.from, outDeg.get(fl.from) + 1)
  }

  const entries = [...inDeg.entries()].filter(([, d]) => d === 0).map(([id]) => id)
  if (entries.length === 0 && stepIds.size > 0) {
    err(p, `feature 没有入口 step（所有 step 都有入边，可能存在环）`)
  }

  // 孤立节点：无入无出，且不是唯一节点
  if (steps.length > 1) {
    for (const s of steps) {
      if (!s || !isString(s.id)) continue
      if ((inDeg.get(s.id) || 0) === 0 && (outDeg.get(s.id) || 0) === 0) {
        warn(`${p}.steps[id="${s.id}"]`, `孤立 step "${s.id}"，没有任何 flow 连接`)
      }
    }
  }
}

function validateCrossFeature(l, i, featureIds) {
  const p = `$.cross_feature[${i}]`
  if (!isObject(l)) { err(p, '必须是对象'); return }
  if (!isString(l.from) || !featureIds.has(l.from)) {
    err(`${p}.from`, `指向不存在的 feature: ${JSON.stringify(l.from)}`)
  }
  if (!isString(l.to) || !featureIds.has(l.to)) {
    err(`${p}.to`, `指向不存在的 feature: ${JSON.stringify(l.to)}`)
  }
  if (l.from && l.to && l.from === l.to) {
    err(p, `cross_feature 自环: ${l.from}`)
  }
  if (!CROSS_KINDS.includes(l.kind)) {
    err(`${p}.kind`, `必须是 ${CROSS_KINDS.join('/')}`)
  }
  if (l.note !== undefined && !isString(l.note)) {
    err(`${p}.note`, '必须是字符串')
  }
}

/* ----------------------- 文件级智能警告（启发式）----------------------- */

/**
 * 这一组警告基于真实使用反馈：
 *  - AI 容易漏 error 分支
 *  - AI 容易把异步副作用画成同步
 *  - AI 写 cross_feature 时只看到 triggers，漏了 publishes/subscribes
 *  - AI 给所有 feature 一个固定 confidence（默认值惯性）
 *
 * 这些是建议（warn），不是结构错误（err）。
 */
function detectFileLevelSmells(data) {
  if (!isArray(data.features) || data.features.length === 0) return

  const features = data.features
  const total = features.length

  /* 1. error 分支覆盖率 */
  let withError = 0
  let externallyExposed = 0 // 有 trigger 或 input role 的 feature
  for (const f of features) {
    if (!isObject(f)) continue
    const flow = isArray(f.flow) ? f.flow : []
    if (flow.some((fl) => isObject(fl) && fl.kind === 'error')) withError++
    const triggers = isArray(f.triggers) ? f.triggers : []
    const steps = isArray(f.steps) ? f.steps : []
    if (
      triggers.length > 0 ||
      steps.some((s) => isObject(s) && s.role === 'input')
    ) {
      externallyExposed++
    }
  }
  if (externallyExposed >= 5) {
    const ratio = withError / externallyExposed
    if (ratio < 0.4) {
      warn(
        '$.features',
        `有 ${externallyExposed} 个 feature 有外部入口，但只有 ${withError} 个 (${(ratio * 100).toFixed(0)}%) 画了 error 分支。建议补充：参数校验失败 / 资源不存在 / 鉴权失败 / 依赖故障 等错误路径。`,
      )
    }
  }

  /* 2. async 边比例（异步副作用容易被画成同步 next） */
  let asyncEdges = 0
  let totalEdges = 0
  let hasSideEffect = false
  for (const f of features) {
    if (!isObject(f)) continue
    const flow = isArray(f.flow) ? f.flow : []
    for (const fl of flow) {
      if (!isObject(fl)) continue
      totalEdges++
      if (fl.kind === 'async') asyncEdges++
    }
    const steps = isArray(f.steps) ? f.steps : []
    if (steps.some((s) => isObject(s) && s.role === 'side-effect')) {
      hasSideEffect = true
    }
  }
  if (hasSideEffect && totalEdges >= 20 && asyncEdges / totalEdges < 0.05) {
    warn(
      '$.features',
      `项目中有 side-effect 类型的 step，但 async 边占比仅 ${(
        (asyncEdges / totalEdges) * 100
      ).toFixed(0)}%。WebSocket 推送 / 入队 / fire-and-forget / mutation 链应当用 flow.kind="async"。`,
    )
  }

  /* 3. cross_feature 关系类型多样性 */
  if (isArray(data.cross_feature) && data.cross_feature.length >= 5) {
    const kindCount = { triggers: 0, depends_on: 0, publishes: 0, subscribes: 0 }
    for (const l of data.cross_feature) {
      if (isObject(l) && l.kind in kindCount) kindCount[l.kind]++
    }
    const totalLinks = data.cross_feature.length
    const triggersRatio = kindCount.triggers / totalLinks
    const pubsubCount = kindCount.publishes + kindCount.subscribes
    if (triggersRatio > 0.8 && pubsubCount === 0) {
      warn(
        '$.cross_feature',
        `${kindCount.triggers}/${totalLinks} (${(triggersRatio * 100).toFixed(
          0,
        )}%) 都是 triggers，且没有 publishes/subscribes。如果项目有 WebSocket / 事件总线 / 消息队列，发布订阅关系应当占 ≥ 30%。`,
      )
    }
  }

  /* 4. confidence 默认值惯性 */
  const confidences = features
    .filter((f) => isObject(f) && isNumber(f.confidence))
    .map((f) => f.confidence)
  if (confidences.length >= 10) {
    const counts = new Map()
    for (const c of confidences) counts.set(c, (counts.get(c) || 0) + 1)
    let maxCount = 0
    let maxValue = 0
    for (const [v, c] of counts) {
      if (c > maxCount) {
        maxCount = c
        maxValue = v
      }
    }
    if (maxCount / confidences.length > 0.7) {
      warn(
        '$.features',
        `${maxCount}/${confidences.length} (${(
          (maxCount / confidences.length) *
          100
        ).toFixed(0)}%) feature 的 confidence 都是 ${maxValue}。请按"覆盖到位 / 跨多文件 / 动态调用"区分给值。`,
      )
    }
  }

  /* 5. tab 类 feature 大概率被合并 */
  // 如果某个 feature 的 name 含 "tab" 或 step 数 > 9 且名字带"面板"/"看板"/"中心"，提示拆分
  for (let i = 0; i < features.length; i++) {
    const f = features[i]
    if (!isObject(f)) continue
    const steps = isArray(f.steps) ? f.steps : []
    if (steps.length >= 9 && /(面板|看板|中心|详情页)/.test(f.name || '')) {
      warn(
        `$.features[${i}]`,
        `feature "${f.name}" 步骤多 (${steps.length})，且名字含"面板/看板/中心/详情页"，可能把多个 tab 或子区合并了。考虑拆成多个 feature。`,
      )
    }
  }

  /* 6. epic_flow next 比例（信息提示，不预设阈值） */
  if (isArray(data.epic_flow) && data.epic_flow.length >= 3) {
    const epicFlow = data.epic_flow
    const counts = { next: 0, depends_on: 0, enables: 0 }
    for (const ef of epicFlow) {
      if (isObject(ef) && ef.kind in counts) counts[ef.kind]++
    }
    const total = epicFlow.length
    const enablesRatio = counts.enables / total
    // 只在 enables 异常多时提示——常见症状是 AI 把"先决条件"全写成 enables
    if (enablesRatio > 0.5 && counts.enables >= 3) {
      warn(
        '$.epic_flow',
        `epic_flow ${counts.next}/${total} next、${counts.depends_on}/${total} depends_on、${counts.enables}/${total} enables。enables 较多，请确认这些是否其实是"用户旅程下一步"（next）或"运行时依赖"（depends_on）——enables 仅适用于"解锁能力但非用户顺序"的场景。`,
      )
    }
  }

  /* 7. epic.importance 枚举已在 validateEpic 中校验，不再限制 core 数量 */
}

/* --------------------------------- main ---------------------------------- */

const args = parseArgs(process.argv.slice(2))
const filePath = path.resolve(args.target)

if (!fs.existsSync(filePath)) {
  console.error(`✗ 文件不存在: ${filePath}`)
  console.error(`  提示：传入正确路径或先让 AI 执行 .codesee/prompts/scan.md 生成`)
  process.exit(2)
}

let raw
try {
  raw = fs.readFileSync(filePath, 'utf-8')
} catch (e) {
  console.error(`✗ 无法读取文件: ${e.message}`)
  process.exit(2)
}

let data
try {
  data = JSON.parse(raw)
} catch (e) {
  console.error(`✗ JSON 解析失败: ${e.message}`)
  process.exit(2)
}

validate(data)

const totalE = issues.errors.length
const totalW = issues.warnings.length
const featureCount = isArray(data.features) ? data.features.length : 0
const epicCount = isArray(data.epics) ? data.epics.length : 0

console.log(``)
console.log(`=== features.json 校验 ===`)
console.log(`文件:   ${filePath}`)
console.log(`Epics:  ${epicCount}`)
console.log(`Features: ${featureCount}`)
console.log(``)

if (totalE > 0) {
  console.log(`错误 (${totalE}):`)
  for (const e of issues.errors) console.log(`  ✗ ${e.path}: ${e.msg}`)
  console.log(``)
}
if (totalW > 0) {
  console.log(`警告 (${totalW}):`)
  for (const w of issues.warnings) console.log(`  ⚠ ${w.path}: ${w.msg}`)
  console.log(``)
}

if (totalE === 0 && totalW === 0) {
  console.log('✓ 通过：未发现结构问题')
  process.exit(0)
}

if (totalE > 0) {
  console.log('→ 校验失败，请按上述错误修复后重新运行')
  process.exit(1)
}

if (args.strict) {
  console.log('→ 严格模式：警告视为失败')
  process.exit(1)
}

console.log('→ 通过（含警告，建议修复）')
process.exit(0)
