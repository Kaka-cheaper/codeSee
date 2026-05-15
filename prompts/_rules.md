# 规则参考（约束分级）

> MUST = 违反会导致画布崩溃或数据不可用
> SHOULD = 违反会降低质量但不崩溃
> MAY = 可选增强

---

## MUST（硬约束）

1. **枚举值不可编造**。只用 `_schema.md` 里列出的值。不确定时用兜底值（role=other, trigger=unknown, flow=next）。
2. **flow.kind 必填**。不能省略或留 undefined。
3. **epic_flow.note 必填**。用 manifest.lang 指定的语言写语义短句，不写技术词。
4. **step.name 必须是用户指定语言的动词短语**（语言由 manifest.lang 决定，默认中文）。禁止：英文标识符、函数调用形式、事件名照搬、"调用 X" 后跟代码标识符。
5. **不修改 locked: true 的 feature**。
6. **不重命名既有 id**。废弃用 tags: ['deprecated']。
7. **写入后跑 validate-features.mjs**。退出码 1 必须修复。

## SHOULD（质量约束）

1. **每个有外部输入的 feature 至少思考一条 error 分支**。
2. **异步副作用用 flow.kind=async**：推送/入队/WebSocket/fire-and-forget/mutation。
3. **条件分支用 conditional + condition 描述**。
4. **cross_feature 不要全是 triggers**。有事件机制时 publishes/subscribes 应有存在。
5. **confidence 不要全写同一个值**。按把握程度区分。
6. **epic.order 是阶段编号**。同阶段共享，不要全递增。
7. **Feature vs Component**：反问"用户一句话能说清吗？"说不清就是组件不是 feature。
8. **每个 step 至少挂 1 条 refs**。

## MAY（可选增强）

1. epic.importance 标注（core/auxiliary）。
2. step.note 补充说明。
3. feature.tags 标记状态（unverified/future/deprecated）。
4. cross_feature.note 说明关系原因。

---

## "调用 → 语义"反例

| ✗ 不要写                     | ✓ 要写           |
| ---------------------------- | ---------------- |
| 调用 bcrypt.compare          | 比对密码         |
| 执行 SQL select              | 查询用户         |
| 用 zod 解析 body             | 校验输入         |
| await fetch(...)             | 调用支付网关     |
| setState(...)                | 更新视图状态     |
| 推送 tick_advanced           | 推送进度事件     |
| 构造 RECONNECT_BACKOFF_MS    | 计算重连等待     |

---

## 校验命令

```bash
node .codesee/scripts/validate-features.mjs
```

退出码：0=通过，1=有错误（必须修），2=文件异常。
