# 灵性测试 · 设计文档索引

当前实现包含隐藏信息、未来事件预知、双人心灵感应三个服务端实验，以及独立的 DSES 自评量表。01–07 保留原版单机方案的设计背景；扩展实现以 08–10 和项目 README 为准。

> ⚠️ **方法论说明（修订记录）**：早期版本曾以 ROPE-based `P(p ∉ [0.15, 0.25] | data)` 作为默认指标。经用户举反例（`n = 1e8, p̂ = 0.21` 应判起效，但 ROPE 会判不起效），已修订为 **Savage-Dickey 密度比**（详见 `06-statistics.md` 6.3）。ROPE 方案被否决并完整记录在文档中以便将来参考。

## 文档列表

| # | 文件 | 说明 |
|---|---|---|
| 01 | [`01-product-overview.md`](./01-product-overview.md) | 产品定位、用户故事、术语表、非目标 |
| 02 | [`02-architecture.md`](./02-architecture.md) | 技术选型、文件结构、模块划分 |
| 03 | [`03-core-mechanics.md`](./03-core-mechanics.md) | **核心机制：随机数时序、状态机、轮次流程** |
| 04 | [`04-ui-design.md`](./04-ui-design.md) | macOS 风格 UI 设计、组件规格、动效 |
| 05 | [`05-data-persistence.md`](./05-data-persistence.md) | localStorage schema、读写策略、导入导出 |
| 06 | [`06-statistics.md`](./06-statistics.md) | **贝叶斯模型、灵性起效概率的定义与算法（Savage-Dickey 密度比）** |
| 07 | [`07-implementation-plan.md`](./07-implementation-plan.md) | 分阶段实施计划、测试策略、风险清单 |
| 08 | [`08-experiment-design.md`](./08-experiment-design.md) | **多维测验扩展方案：能力分类、实验流程、盲法、统计与复验、文献来源** |
| 09 | [`09-implementation-contract.md`](./09-implementation-contract.md) | **三个优先模块的服务端协议、角色边界、计时与存储** |
| 10 | [`10-dses-questionnaire.md`](./10-dses-questionnaire.md) | **DSES 英文原版来源、中文辅助范围、2022 计分规则** |
| 11 | [`11-account-and-reports.md`](./11-account-and-reports.md) | **raricy 登录、游客与账号保存边界、PDF 图表报告** |

第 08 章的前三个优先模块及 DSES 已进入当前实现，其余实验仍属后续设计。前面章节中的统一目标时序和零后端描述属于原有方案，不适用于当前三个实验。

## 设计三大原则

1. **逻辑可验证**：所有关键不变量（如"目标数先于用户选择存在"）必须在架构层强制，而不是依赖编码约定。
2. **角色隔离与独立存储**：目标、计时和凭证由服务端管理；游客历史在本机，登录用户按账号归档，各种测验分开计分。
3. **统计严谨**：贝叶斯模型选型有明确理由，参数可替换，结果可复现。

## 阅读顺序建议

新成员进入项目时按 01 → 02 → 03 → 04 → 05 → 06 → 07 顺序阅读，再阅读 08 了解多维测验扩展方案；

修改已有功能时先看对应章节再下笔；尤其在改动 **随机数时序**（03.1）或 **灵性起效定义**（06.3）时必须重新阅读相关章节，并在代码评审中重点考察。
