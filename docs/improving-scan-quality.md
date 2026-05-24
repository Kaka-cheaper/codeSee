# 提升 scan 质量的研究笔记

> 这是 codesee 产品方向的研究分析，**不是**已落地功能的说明。
> 用途：让贡献者 / 用户了解我们在思考什么、为什么不做什么、未来要走哪条路。

---

## 真实痛点

codesee 的 scan 阶段 = AI 把代码或 spec 文档抽象成 `features.json`。**质量瓶颈不在工具，在 LLM 自己**：

1. 一次性输出 15K+ token 的 JSON——长输出末尾质量下降是已知现象
2. 输出过程没有"中间态可审"——错了一处影响后续所有 feature
3. AI 自己读了一遍代码，没有自纠机会
4. 项目大时（>40 feature）容易漏 / 错 / 编造枚举值

经过 6 个月迭代（Polisim 40+ feature 项目 + 美团 hackathon），这是**剩下最大的质量问题**。

---

## 两个潜在改进方向

我们认真分析过两个方向。**结论先放在这**：

```
| 方向                              | 收益面    | 推荐
|-----------------------------------|----------|------
| 方向 A：KG / 本体作为代码理解中间层 | ~25%     | ✗ 不做
| 方向 B：增量写入 + 自纠循环         | ~70-80%  | ⭐ 做
```

下面分别展开。

---

## 方向 A：KG / 本体（已评估，决定不做）

### 思路

让 AI 不直接读源码，而是先读"代码知识图谱"：节点是文件 / 类 / 函数，边是 calls / imports / contains。AI 基于结构化关系再做语义抽象。

参考工具：
- [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) — 21k stars，CLI + MCP
- [abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus) — 40k stars，浏览器 + RAG
- 学术：[GraphCodeBERT](https://arxiv.org/abs/2009.08366), [GraphRAG](https://arxiv.org/abs/2404.16130)

### 为什么不做

把 features.json 字段拆开看代码 KG 能帮多少：

```
| FCG 字段              | KG 能帮多少
|----------------------|------------
| step.refs             | ⭐⭐⭐⭐⭐ 巨大
| cross_feature         | ⭐⭐⭐⭐ 大
| flow 顺序             | ⭐⭐ 部分
| epic 划分             | ⭐ 小
| feature.name          | 0
| feature.summary       | 0
| step.name             | 0
| step.role             | 0
| confidence            | 0
```

只有 25% 字段受益。剩下 75%（命名 / 摘要 / 角色 / 置信度）是**纯语义层**，LLM 看代码事实没用，必须自己抽象。

### 范畴错位问题

```
代码 KG 的概念：
  file / class / function / variable / type
  calls / imports / contains / inherits

features.json 需要的概念：
  Epic / Feature / Step / 角色 / 流程
  ↑ 用户视角概念，代码里根本不存在
```

KG 是"代码事实层"，FCG 是"用户视角层"。两者之间需要 LLM 翻译——KG 不能减轻翻译难度。

### 战略风险

如果 codesee 集成第三方 KG 工具（如 codegraph），定位会从"独立 AI 协作工具"变成"codegraph 的语义层"。在 codesee 26 star、codegraph 21k star 的现状下，这是被吸收为子集的风险。

### 决策

```
✗ 不集成第三方 KG 工具
✗ 不自建 KG / 本体
✗ 不做"先建图再喂 AI"的架构
✓ 保持 AI 直接消费源码 / spec 的现状
```

如果未来要补足 25% 收益面（refs 准确性 + cross_feature 覆盖），考虑做"轻量符号校验"——validator 加跨文件引用检查。**这是 validator 升级，不是架构改变。**

---

## 方向 B：增量写入 + 自纠循环（推荐）

### 思路

不再让 AI 一次性输出整份 features.json。改成 **per-epic 或 per-feature 的增量循环**——写一段 → 校验 → 自纠 → 写下一段。

### 学术依据

跟 LLM 长输出可靠性的主流研究方向一致：

```
| Paper                                  | 核心
|---------------------------------------|---------
| Self-Refine (CMU 2023)                 | LLM 自审 + 改自己输出
| Reflexion (NEU 2023)                   | 反思循环
| Self-RAG (UW 2023)                     | 决定何时检索 + 何时反思
| Constitutional AI (Anthropic)          | 按预设约束自查
```

业界共识：**长输出严谨性必须靠"分段 + 闭环"。**

### 收益对比

```
| 维度                  | 一次性写  | 增量写
|----------------------|----------|----------
| 错误定位粒度          | 整体      | 单 feature
| 后期 feature 质量    | 衰减     | 稳定
| token 总开销          | 低       | 高（prompt 重复）
| 时间                  | 快       | 慢 3-5x
| 中间态可审            | 不可     | 可
| AI 自纠能力           | 0        | 每步可纠
| 跟 patch 协议契合     | 不天然   | 天然契合
```

### 三档实施方案

```
| 档位 | 流程                                    | 工时    | 推荐度
|------|----------------------------------------|---------|-----
| 1    | Per-Epic 循环：一个 epic 一组 feature  | ~6h     | ⭐ 入手
|      | 写完就 patch + validator + 修         |         |
| 2    | Per-Feature 循环 + 自 review            | ~12h    |
|      | 单 feature 完成时 LLM 自查 step 命名/   |         |
|      | flow 顺序                              |         |
| 3    | Critic-Actor：双 LLM 角色互相评审       | ~24h    | 暂不做
|      | 严谨性最高，token 翻 3-4x              |         |
```

### 推荐执行路径

```
P1：先做档 1（Per-Epic 增量）
   → 利用 codesee 已有的 RFC 6902 patch 协议
   → 改 prompts/scan-light.md 与 scan-heavy.md 几段
   → 不引入新基础设施

P2：在 Polisim 真实项目验证效果
   → 对比 features.json 质量
   → 看 token 开销是否可接受

P3：根据数据决定是否升档 2
   → 质量明显改善 → 推广
   → 改善不明显 → 评估 prompt 工程是否还有优化空间
   → 永远不直接跳到档 3
```

### 跟现有架构的契合度

codesee 已经为这个方向做好了基础设施：

- ✓ RFC 6902 patch 协议（apply-patch.mjs）天然支持增量
- ✓ validator 已经能给精确 JSONPath 错误位置
- ✓ Checkpoint 协议在 sync.md 里已经存在
- ✓ scan-heavy.md 已经是 4 阶段累积模式

剩下的工作：把 scan-light 的"一次性写全文"改造成 per-epic 循环。

---

## 决策状态

```
2026-05-20 brainstorm
  - 方向 A（KG / 本体）：评估完成，决定不做
  - 方向 B（增量写入）：识别为最大 ROI，等待实施
  - 推荐先做档 1（Per-Epic 增量），约 6h 工时
  - 路线图加 "增量 scan + 自纠" 条目，标记 [ ] planned
  
下一步：
  - 不立即实施
  - 等当前 Polisim 真实使用反馈
  - 或贡献者认领该方向
```

---

## 给贡献者的话

这是公开研究方向。如果你对 LLM 输出可靠性 / Self-Refine / 工程化 prompt engineering 感兴趣，**这条路欢迎贡献**：

1. 先在 [Issues](https://github.com/Kaka-cheaper/codeSee/issues) 开一条讨论 issue 描述你的实施思路
2. 拍板档位（1 / 2 / 3）后再写代码
3. 改造 `prompts/scan-light.md` 是改 prompt，不是改 viewer——风险低、影响面小

如果对学术原型感兴趣（critic-actor / tree-of-thoughts on FCG），欢迎做实验性 fork，验证后再回 PR。

---

## 参考资料

- [Self-Refine: Iterative Refinement with Self-Feedback (arXiv 2303.17651)](https://arxiv.org/abs/2303.17651)
- [Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv 2303.11366)](https://arxiv.org/abs/2303.11366)
- [Self-RAG: Learning to Retrieve, Generate, and Critique (arXiv 2310.11511)](https://arxiv.org/abs/2310.11511)
- [GraphRAG (Microsoft 2024)](https://arxiv.org/abs/2404.16130)
- [GraphCodeBERT (Microsoft 2020)](https://arxiv.org/abs/2009.08366)
- [Anthropic Prompt Engineering Documentation](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview)
