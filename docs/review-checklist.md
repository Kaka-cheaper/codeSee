# features.json 评审清单

> AI 跑完 scan 后，用这份清单系统评估产出质量；
> 把命中的问题反馈给我，我会基于真实失败样本改 prompt，比闭门优化精准得多。

---

## 一、覆盖度（漏没漏）

最关键的指标。**漏 feature 比写错 feature 严重得多**。

- [ ] 项目所有 HTTP 路由是否都有对应 feature？
  - 反向核对：列出项目里所有路由，逐一对照 features.json
  - 漏的反馈格式：`漏了 POST /api/xxx`
- [ ] 后台任务 / 定时器 / 消息消费者是否覆盖？
- [ ] CLI 子命令是否覆盖？
- [ ] 前端关键交互（如果项目带前端）是否有 feature？
- [ ] WebSocket / SSE / Webhook 这种"非标准入口"是否覆盖？

## 二、粒度（粗了细了）

- [ ] feature 数量是否合理？
  - 重型项目 20-200，过少说明合并粒度太粗，过多说明把实现细节当 feature
- [ ] 平均每个 feature 的 step 数是否在 3-10？
  - < 3：粒度太粗，应该拆得更细
  - \> 10：粒度太细，把"调用关系"误当 step 了
- [ ] 有没有 step 名字像代码标识符？（应该是中文动词短语）
  - 例：`call_save_user` 错；`保存用户` 对

## 三、语义质量（步骤是不是人话）

抽 3 个 feature 详细看：

- [ ] step.name 是否一眼能看懂这一步在做什么？
- [ ] flow 顺序合不合理？跟你脑中"这功能怎么发生"的链条对不对得上？
- [ ] async / conditional / loop / error 用得对吗？
  - 有没有该 async 的写成 next（异步任务被画成同步链）
  - 有没有该 conditional 的写成 next（隐藏了"密码错误怎么办"）
  - 有没有 error 分支被遗漏

## 四、cross_feature

- [ ] 跨功能关系是否覆盖了真实的发布订阅 / 调用 / 触发？
  - 重点检查：定时器是否触发了某个 feature；上传完成是否触发了下游处理

## 五、refs（源码引用）

- [ ] 每个 step 是否至少挂了一条 file ref？
- [ ] file 路径是否真实存在（拼写、大小写）？
  - 简单验证方式：随机抽 5 个 ref 用 IDE 跳转，能跳到为佳
- [ ] lines 范围是否合理？

## 六、置信度真实性

- [ ] confidence 是否真的反映把握？
  - 反例：所有 feature 都是 1.0（明显在装懂）
  - 反例：所有 feature 都是 0.5（没有甄别能力）
  - 期望：动态路由 / 配置驱动 / 反射调用相关的 feature 应该 ≤ 0.6

## 七、Epic 划分

- [ ] Epic 名字是否和你心中的"业务大块"对得上？
- [ ] 有没有 feature 被错放到不相干的 Epic？
- [ ] 'misc' / '其他' Epic 里的内容是否有显著归属歧义？

---

## 反馈给我的格式

把这份 checklist 跑一遍后，反馈用这个结构：

```
覆盖度问题：
- 漏 feature: ...（列具体的）
- 多余 feature: ...

粒度问题：
- step 太多/太少的 feature：feature_id (N steps)
- step 写成代码标识符：feature_id - step_id

语义问题：
- 流程顺序错了：feature_id（应该是 X→Y→Z，AI 写成 X→Z→Y）
- 该 async 的写成 next：feature_id, step_id
- 漏了 error 分支：feature_id

整体观感：
- AI 哪些东西做得好
- 哪些根本没把握住要点
```

我拿到这份反馈后会精准改 prompt，而不是泛泛而调。
