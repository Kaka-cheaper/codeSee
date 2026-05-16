# CodeSee · 扫描模式

> 第一次接入项目时执行。产出 `.codesee/features.json`。

---

## 目标

从**用户/业务视角**描述项目的功能流程图。

> 类比：功能是"西红柿炒鸡蛋"→ 你写"备菜 → 打蛋 → 热油 → 下锅 → 调味 → 出锅"，
> 不是"`prepare()` 调用 `slice()`"。

## 工具策略

用 IDE 自带的代码探索能力（@Codebase / @workspace / Agent 等）。
我不告诉你怎么探索，只告诉你**要找什么、产出什么**。

## 第零步：确认输出语言

在开始扫描前，**询问用户**希望用什么语言撰写语义内容（step.name、epic_flow.note、summary、note 等所有面向人类阅读的文本）。

常见选择：
- `zh-CN`（中文，默认）
- `en`（English）
- `ja`（日本語）
- 其他

如果用户未指定，默认使用**中文（zh-CN）**。

确认后，在 `features.json` 的 `manifest` 中写入：

```json
"manifest": {
  "lang": "zh-CN",
  ...
}
```

后续所有语义文本（step.name、epic.name、feature.name、summary、note、epic_flow.note、cross_feature.note、condition）都使用该语言。

## 第一步：规模自检

读 README、package.json/pyproject.toml、顶层目录，判断：

| 维度          | 轻型            | 重型                |
| ------------- | --------------- | ------------------- |
| 源码文件数    | < 100           | ≥ 100               |
| 子模块/包     | 1-3             | ≥ 4 或多服务        |
| 路由/端点数   | < 30            | ≥ 30                |
| 业务领域数    | 1-3             | ≥ 4                 |

任意 2 项命中重型 → 走 heavy。

**特殊情况：纯文档/规划项目**

如果项目几乎没有代码（只有 README、设计文档、需求文档，或仅有脚手架），走 **planning 模式**而不是 light/heavy。

判断条件（满足任一即视为规划项目）：
- 没有源码文件，或源码文件 < 5 个且都是配置/入口
- 业务逻辑代码为空，只有文档说明要做什么
- 用户明确说"这个项目还没开始写"

## 第二步：执行

- **规划项目** → 读并执行 `.codesee/prompts/scan-planning.md`
- **轻型** → 读并执行 `.codesee/prompts/scan-light.md`
- **重型** → 读并执行 `.codesee/prompts/scan-heavy.md`

**告诉我你选了哪一档**再开始。

## 参考文件

- Schema + 枚举 + 示例：`.codesee/prompts/_schema.md`
- 规则（MUST/SHOULD/MAY）：`.codesee/prompts/_rules.md`

## 写入位置

```
.codesee/features.json
```
