# CodeSee · 扫描模式 Prompt（入口）

> 用途：第一次接入一个项目，让 AI 通读代码后产出 `features.json`。
> 用法：把整段拷给 AI（任何 IDE 都行），它会先做项目规模自检，再选对应子 prompt 执行。

---

## 我希望你做什么

阅读项目代码，从**用户/业务可感知的功能**视角，生成一份 `features.json`，
让另一个不看代码的人能在画布上理解"这个项目都有哪些功能、每个功能怎么发生的"。

> **核心要求：你描述的是语义流程，不是调用关系。**
> 类比：如果功能是"西红柿炒鸡蛋"，你要写的是"备菜 → 打蛋 → 热油 → 下锅 → 调味 → 出锅"，
> 不是"`prepare()` 调用 `slice()`，再调用 `whisk()`"。

## 工具策略

**用你所在 IDE 自带的代码探索能力**（@Codebase / @workspace / Agent / file search / grep / read_file 等），不要自己模拟遍历或猜测目录结构。

我不告诉你怎么探索代码，那是工具的事；我只告诉你**要找什么、产出什么**。

## 第一步：项目规模自检

先用工具读以下文件（存在就读，不存在跳过）：

- `README.md` / `README*.md`
- `package.json` / `pyproject.toml` / `requirements.txt` / `pom.xml` / `Cargo.toml` / `go.mod`
- 顶层目录列表（一级 + 二级）
- 路由 / 端点入口的目录（`routes/`、`api/`、`controllers/`、`urls.py`、`main.py` 等存在性）

然后判断项目规模并**告诉我你的判断**：

```
| 维度              | 轻型 (light)              | 重型 (heavy)                  |
| ----------------- | ------------------------- | ----------------------------- |
| 文件数            | < 100 个源码文件          | ≥ 100 个源码文件              |
| 子模块/包          | 1-3 个                    | ≥ 4 个，或多服务/多前后端      |
| 路由/端点数       | < 30                      | ≥ 30，或难以一次列全          |
| 上下文一次能读完  | 是                        | 否，必须分块读                |
| 业务领域数        | 1-3                       | ≥ 4                           |
```

只要任意 2 项命中"重型"，就走 heavy 流程。

## 第二步：按规模选择子 prompt 执行

- **轻型项目** → 完整执行 `.codesee/prompts/scan-light.md`
- **重型项目** → 完整执行 `.codesee/prompts/scan-heavy.md`

**告诉我你选了哪一档**，再开始执行对应文件里的步骤。如果你看不到那两份子文件，请要求我提供。

## 通用约束（两档都适用）

### 命名

- `feature.id` 用 `f-xxx` 前缀，slug 全小写连字符
- `epic.id` 用单词或短词组：`user`、`order`、`content`
- `step.id` 在 feature 内唯一：`input`、`validate`、`save`、`ok`、`fail`
- `step.name` 必须**中文动词短语**，2-8 字，禁止用代码标识符做名字

### "调用 → 语义"反例对照

| 不要写                       | 要写                       |
| ---------------------------- | -------------------------- |
| `调用 bcrypt.compare`        | 比对密码                   |
| `执行 SQL select`            | 查询用户                   |
| `用 zod 解析 body`           | 校验输入                   |
| `await fetch(...)`           | 调用支付网关               |
| `setState(...)`              | 更新视图状态               |
| `调用 UserService.create`    | 创建用户                   |

### 写入位置

最终把生成的 JSON **覆盖写入**：

```
.codesee/features.json
```

只输出**单个 JSON 对象**到该文件，不要 markdown 包裹、不要解释、不要数组顶层。

### Schema（速查；完整定义见对应子 prompt）

```ts
type FeaturesFile = {
  version: '0'
  manifest: { repo?: string; commit?: string; generated_at: string; generator?: string }
  epics: Epic[]
  features: Feature[]
  cross_feature?: CrossFeatureLink[]
}
```

完整字段约束写在 `.codesee/prompts/scan-light.md` / `.codesee/prompts/scan-heavy.md` 里。
