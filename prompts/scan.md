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

## 第一步：规模自检

读 README、package.json/pyproject.toml、顶层目录，判断：

| 维度          | 轻型            | 重型                |
| ------------- | --------------- | ------------------- |
| 源码文件数    | < 100           | ≥ 100               |
| 子模块/包     | 1-3             | ≥ 4 或多服务        |
| 路由/端点数   | < 30            | ≥ 30                |
| 业务领域数    | 1-3             | ≥ 4                 |

任意 2 项命中重型 → 走 heavy。

## 第二步：执行

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
