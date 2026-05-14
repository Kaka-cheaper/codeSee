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
