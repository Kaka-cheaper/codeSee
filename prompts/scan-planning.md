# CodeSee · 扫描 · 规划模式

> 前置：项目处于文档/规划阶段，还没有代码（或代码极少）。
> 用途：把"想做什么"画成功能流程图，方便和 AI 讨论、修改、对齐。
> 参考：`_schema.md`、`_rules.md`

---

## 适用场景

- 只有 README、设计文档、需求文档，没写任何代码
- 有少量脚手架代码但还没实现业务逻辑
- 在做项目立项、技术选型、架构讨论

走这个模式后，等开始写代码时切到 `sync.md` 增量更新。

## 执行步骤

### 1. 读所有文档

用 IDE 工具通读：
- README、CONTRIBUTING、设计文档（DESIGN.md 等）
- 需求文档、PRD、架构图说明
- 接口约定（OpenAPI / GraphQL schema 等，如果有）
- TODO / ROADMAP 文件

### 2. 询问用户（如果文档不够）

如果文档不足以支撑一份功能图，**主动问用户**：
- 这个项目主要解决什么问题？
- 有哪些关键功能？
- 用户旅程大致是怎样的？

不要凭空编造功能。规划阶段的功能图必须反映用户真实的设计意图。

### 3. 划 Epic

按用户旅程划分（同 scan-light 的规则）：
- 3-6 个 Epic
- `order` 表示阶段
- 可选 `importance`

### 4. 抽 Feature

每个计划中的功能写一个 feature。**重点是覆盖度，不是细节**：
- 用户能感知的能力都列出来
- 即使实现方式还没定，feature.name 能写就写
- 不确定的功能可以先列出来，标 `tags: ['planned', 'tbd']`

### 5. 写 steps + flow（粗粒度）

规划阶段允许粗粒度：
- 3-6 个 step 即可（不用细到 8-10）
- step.name 仍然是动词短语
- flow.kind 必填，不确定时用 `next`
- 错误分支可以先不写（等实现时补）

### 6. refs 留空

规划阶段没有代码，refs 字段不写或写空数组。

等代码实现后，sync 流程会自动补上 refs。

### 7. cross_feature 和 epic_flow

按设计意图画。这是规划阶段最有价值的部分——能让用户在画布上看到"功能之间应该怎么串起来"。

### 8. confidence 一律标低

规划阶段所有 feature：
- `confidence: 0.3` 或更低（"仅凭设计意图"）
- `tags: ['planned']` 必加

这样用户在画布上一眼能看出"这是规划，不是现实"。

## 必加的 tags

```json
"tags": ["planned"]
```

可选追加：
- `"tbd"`：连功能名都还没定
- `"v1"` / `"v2"`：版本规划
- `"deferred"`：暂缓实现

## 自检

- [ ] 所有 feature 都有 `tags: ['planned']`
- [ ] 所有 feature confidence ≤ 0.5
- [ ] step.name 全是动词短语
- [ ] flow.kind 全部填写
- [ ] refs 留空（因为没代码）
- [ ] 有完整的 epic_flow 串起用户旅程

## 完成

1. 写入 `.codesee/features.json`
2. 跑 `node .codesee/scripts/validate-features.mjs`
3. 简短总结：N epic / M feature / 哪些功能还需要进一步明确

## 之后怎么办

当用户开始写代码：
- 每写完一个功能，触发 `sync.md`
- sync 流程会把 `planned` 标记移除，补上 refs，提升 confidence
- 没实现的功能保持 `planned`，画布上一眼能看出"已实现 vs 规划中"
