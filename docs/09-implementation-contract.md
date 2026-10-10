# 09 三个优先模块：实施接口与分工

本章落实第 08 章已获授权的三个优先模块。使用现有 React/Vite 界面，增加无额外运行依赖的 Node HTTP 服务；开发期通过 Vite 代理同源 `/api`，生产期服务端同时提供 `dist`。双人同步采用短轮询，优先保证目标时序与角色隔离。

## 双人自选协议更新（2026-10-10）

候选符号更新：创建接口新增可选 `candidateSet`，取值 `digits`（默认）、`letters`、`cosmos`、`colors`、`faces`、`directions`，分别对应数字、字母、天体图标、颜色、表情和方向。服务端白名单校验并保存到 `settings.candidateSet`，接收者加入不能覆盖。所有协议的 target/guess 仍为 1–5 的位置编号，符号组确定显示映射；天体顺序固定为星星、月亮、太阳、黑洞、地球。候选组整场固定，旧记录缺失该字段按数字处理，导出／导入保留并校验该字段，历史按模块、版本、基线和候选组分别汇总。

用户将双人测验调整为发送者选一个、接收者选一个，再比较是否相同。以下协议 v3 更新覆盖下文原双人 v2 规则；单人模块仍使用 v2。

- 新建双人房间使用 `protocolVersion: 3`、`chanceBaseline: null`。不生成随机目标或随机对照轮。已有 v2 房间按旧规则完成，记录按版本分别汇总。
- 接收者加入后首轮进入 `SELECTING`，只有发送者显示 1–5 和“锁定并发送”。此阶段不计时；接收者等待，不能提交答案。
- 发送者以自身 Bearer 凭证调用 `POST /api/experiments/:id/target`，输入 `{ roundId, target }`，target 必须为 1–5 整数。服务端锁定目标并开始默认各 15 秒的发送期、作答期。v3 中 `targetGeneratedAt` 表示发送者选择锁定的时间。
- 流程为 `SELECTING → SENDING → GUESSING → LOCKED → REVEALED`；接收者未作答超时仍标为 `ABANDONED`。下一轮再次等待发送者选数，由接收者点击进入。
- 重试同一目标幂等且不重置计时，尝试改数拒绝。接收者无权设置目标，发送者无权提交猜测；揭晓前双方快照只包含自己的选择，揭晓后显示发送者、接收者的数值和是否一致。
- 自由选数可能存在数字偏好，不能将 20% 当作固定机会基线。不展示超基线概率或发送／对照差值，只显示一致率、样本数与对应 Beta 模型区间。
- 沿用现有历史存储命名空间和 JSON 导出 `schemaVersion: 2`，其中会话 `protocolVersion` 可为 2 或双人 3；版本分组禁止混算，导入仍校验答案与命中标记一致。
- DSES 的中文界面选项仅显示中文，英文界面仅显示英文；原版 PDF 和量表计分不变。

下文保留初版 v2 的实施与验收记录，供已有数据与房间兼容参考。

## 实施边界

- `hidden`：服务端在轮次创建时生成目标；接收端揭晓前没有目标。
- `precognition`：服务端先锁定合法答案，再生成目标。
- `telepathy`：创建者为发送者，邀请码只能加入接收者席位；随机平衡安排 `sending` / `control` 条件。发送者只在真实发送轮看到目标；接收者在整场结束前不知道条件。
- 每场 5–200 轮，默认 30；五选一机会基线 0.2。数字作为首版候选，后续可以替换图形。
- 双人每轮使用服务端固定的发送期和作答期，默认各 15 秒。提前提交进入 `LOCKED`，到统一 `revealAt` 才揭晓；超时未答标记 `ABANDONED` 并记录原因。结束、退出、刷新和恢复不能重抽已有目标。
- 不开发遥视、设备实验、账号系统或外部部署。不提交或推送 Git。用户追加的独立 DSES 模块见第 10 章。

## HTTP 接口

所有会话操作以 `Authorization: Bearer <token>` 鉴权，按凭证决定角色，不信任客户端传入的角色。创建/加入回传 `{ sessionId, token, role, snapshot }`，其余成功操作直接回传 snapshot；错误回传 `{ error: string }` 与适当 HTTP 状态。

| 方法 | 路径 | 输入／作用 |
|---|---|---|
| POST | `/api/experiments` | `{ experimentType, roundsPerSession, sendingDurationMs?, answerDurationMs? }`；hidden/precognition 立即开始，telepathy 等待加入 |
| POST | `/api/rooms/join` | `{ code }`；单次加入接收席位后自动开始首轮 |
| GET | `/api/experiments/:id` | 获取当前角色允许读取的快照；依服务端时间推进双人阶段 |
| POST | `/api/experiments/:id/guess` | `{ roundId, guess, confidence? }`；仅接收者，guess 为整数 1–5，confidence 为 null 或 0–100 |
| POST | `/api/experiments/:id/next` | `{ roundId }`；仅接收者，上一轮已揭晓／作废后创建下一轮 |
| POST | `/api/experiments/:id/abandon` | 保留已答结果，当前未答轮作废，整场标记 ABANDONED |
| GET | `/api/health` | 服务状态 |

同一轮提交重试相同答案应返回现有快照，改变已锁定答案应拒绝。next 必须按 roundId 防止重复请求多建轮次。

主动 abandon 为明确的提前结束操作：已锁定答案立即揭晓并保留计分，`revealedAt` 为实际结束时间，原 `revealAt` 仍保留计划时间。该场次标记 ABANDONED；不能通过退出删除已提交的猜测。

## 快照

`{ id, experimentType, protocolVersion: 2, chanceBaseline: 0.2, role, status, createdAt, completedAt, settings, rounds, activeRound, roomCode? }`

- session status：`WAITING` / `IN_PROGRESS` / `COMPLETED` / `ABANDONED`。
- 终态的 activeRound 为 null，最后一轮结果保留在 rounds 中。
- settings：`{ roundsPerSession, sendingDurationMs, answerDurationMs }`。
- round：`{ id, index, status, createdAt, targetGeneratedAt?, guessLockedAt?, revealedAt?, sendingEndsAt?, revealAt?, guess?, confidence?, correct?, target?, condition?, invalidReason? }`。
- round status：`TARGET_READY` / `SENDING` / `GUESSING` / `LOCKED` / `REVEALED` / `ABANDONED`。
- 目标仅在揭晓后或真实发送轮的发送者视图中出现；禁止将原始 round/session 直接序列化。
- 条件在接收者视图中仅整场 COMPLETED/ABANDONED 后出现，统计条件差异也仅此时展示。发送者可通过自身页面知道是否发送，但无需提前收到后续轮次信息。
- 揭晓前，发送者不接收接收者答案；接收者可读取自己已锁定的答案。
- token 不能出现在快照、公开房间列表、导出数据或服务端静态资源中。

## 数据与统计

服务端私有 `.data/experiments.json` 持久化真实会话与凭证，采用原子替换并按操作顺序写入。原始文件不得通过 HTTP 提供。浏览器 sessionStorage 保存当前标签页的恢复凭证；localStorage 的独立 v2 命名空间保存终态安全快照及历史。原有 v1 数据保留并作为旧版记录单独展示，不与新协议累计。

新统计模块：`src/lib/experiment-statistics.js` 导出 `summarizeExperiment(session, prior = { alpha: 1, beta: 1 })`、`groupExperimentHistory(sessions, prior)`。

summary：`{ k, n, accuracy, baseline, excess, probAboveChance, credible, conditions? }`；无样本数字返回 null。conditions 在双人终态包含 `sending` 与 `control` 的上述统计和 `difference`（样本率差值；任一无样本则 null）。按 session.id 去重，按 experimentType + protocolVersion + chanceBaseline 分组；仅计 REVEALED，不能把作废轮次当作错误。对开放区间或差值不确定性采用合适方法或明确不展示，禁止伪造置信结论。

`ExperimentResults` 的接口为 `{ session, prior? }`；`ExperimentHistory` 的接口为 `{ sessions, onClear?, onExport?, onImport? }`。主要结果文案为表现、基线及参数后验，不能把模型概率称为超自然能力存在概率。

## 子代理所有权

1. 服务端代理：`server/**` 及服务端必要测试。不得修改 package.json、vite 配置、前端或他人文件。
2. 前端代理：`src/App.jsx`、`src/App.css`、新 `src/components/ExperimentFlow*`、`src/hooks/useExperiment.js`、`src/lib/experiment-api.js`，及相关 App/交互测试。引用另一代理的结果组件，不编辑其文件。
3. 统计代理：新 `src/lib/experiment-statistics.js`、`src/lib/experiment-history.js`、`src/components/ExperimentResults*`、`src/components/ExperimentHistory*`、相关必要测试。不编辑旧版统计、存储或前端主界面。
4. 主代理：协调接口、运行配置、文档、整合、审查与最终必要验证。

## 必要验收

- 服务端：目标过滤、角色鉴权、预知生成时序、锁定与幂等、双人真实发送／控制条件、固定揭晓时间、恢复持久化。
- 统计：协议分组、去重、作废排除及双条件差值。
- 前端：三个入口、请求失败、锁定等待、发送者不出现猜测输入、恢复和终态历史。
- 一次生产构建；一次真实 HTTP 双角色及两个单人模块贯通检查。只有新的失败或审查修正才重跑受影响的检查，不扩展为全面测试矩阵。

## 本次实施与审查记录（2026-10-10）

由四个实际 Claude Code CLI 子代理分别实现后端、前端、统计／历史、DSES，主代理审查并整合。未增加运行依赖，未提交或推送 Git。

审查后补齐严格历史导入，拒绝非终态轮次、答案与命中标记不一致、重复轮次；生产导出使用字段白名单。前端阻止重复动作请求，过期轮询响应不能覆盖动作结果。后端私有文件损坏时拒绝启动，避免重置并覆盖已有会话。放弃已锁定答案时记录实际提前揭晓时间并保留计分。设置中的先验已接入当前结果与历史汇总。

验证结果：

- 与本次修改直接相关的前端、DSES、统计及历史测试共 66 项通过，另有设置所在的旧组件测试 16 项通过；未扩大到全部旧代码测试。
- 服务端 13 项本机 HTTP／持久化测试通过。
- `npm run build` 成功。
- 真实 HTTP 使用正式服务与加密随机源，分别完整完成三个模块各 5 轮，验证双角色过滤、发送／对照平衡、锁定等待、结束统计与严格历史导入。
- 生产原版 PDF 的 SHA-256 与下载记录一致、响应类型为 application/pdf，私有数据路径返回 404。
- `npm run dev` 同时启动服务与 Vite，`/api/health` 同源代理与 PDF 请求成功；默认端口被占用时以 Vite 输出的实际地址为准。检查启动的进程已停止。

双人协议已通过本机双凭证 HTTP 验证，尚未在两台物理设备上进行人工验收。首版提供研究流程与数据记录；账号、公开部署、多人并发管理及严格预注册分析属于后续工作。
