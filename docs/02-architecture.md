# 02 技术架构

## 2.1 技术选型

| 角色 | 选型 | 理由 |
|---|---|---|
| 视图框架 | **React 18+**（hooks + function components） | 用户指定 |
| 语言 | **TypeScript**（strict mode） | 类型安全尤其利于"状态机 + 不可变 target"的不变量 |
| 构建 | **Vite 5+** | 开箱即用 HMR、ESM；启动快 |
| 样式 | **CSS Modules + CSS 变量（tokens）** | macOS 风的 token 化排版容易；不引入 Tailwind/CSS-in-JS 的复杂度 |
| 持久化 | **浏览器 localStorage** | 无后端、零依赖；schema 版本化 |
| ID 生成 | `crypto.randomUUID()` | 现代浏览器原生 |
| 状态管理 | React `useReducer` + 自定义 hooks（不使用 Redux） | 状态机集中、规模可控 |
| 数值计算 | 自实现 `betainc`（Numerical Recipes 风格） | 无外部依赖、避免统计包膨胀 |
| 测试 | **Vitest** + **@testing-library/react** + **Playwright** | 单元测试纯函数、E2E 验证流程 |

不引入：
- ❌ Redux / Zustand / Jotai（本项目状态机纯度足够覆盖）
- ❌ Tailwind（用 CSS Modules 更可控）
- ❌ 任何远程依赖（无后端）
- ❌ 任何统计 / 概率 npm 包（自实现 + 自测）

## 2.2 文件结构

```
spiritality-test/
├── docs/                               # 本设计文档
├── public/
├── src/
│   ├── main.tsx                        # 入口
│   ├── App.tsx                         # 顶层视图
│   ├── components/
│   │   ├── CoveredDigit.tsx            # 核心可视：被遮挡的数字
│   │   ├── GuessInput.tsx              # 1–5 输入面板（按钮 + 键盘）
│   │   ├── RoundView.tsx               # 单轮视图（覆盖 + 输入 + 反馈）
│   │   ├── ResultPanel.tsx             # 本轮反馈胶囊
│   │   ├── SessionSummary.tsx          # 测试结束报告
│   │   ├── HistoryList.tsx             # 历史 session 列表
│   │   ├── SpiritualityGauge.tsx       # 概率条
│   │   ├── SettingsPanel.tsx           # 设置 / 数据管理
│   │   └── ui/                         # 通用 UI 原子（Button, Card, Modal）
│   ├── lib/
│   │   ├── rng.ts                      # 随机目标数生成
│   │   ├── state-machine.ts            # 轮次 / session 状态机
│   │   ├── statistics.ts               # 贝叶斯计算（纯函数；默认采用 Savage-Dickey 密度比）
│   │   ├── storage.ts                  # localStorage 封装
│   │   ├── schema.ts                   # 类型定义 + 校验
│   │   └── betainc.ts                  # 正则化不完全 Beta 函数
│   ├── hooks/
│   │   ├── useSession.ts               # 当前 session 状态
│   │   ├── useHistory.ts               # 历史 + 聚合
│   │   ├── useSpiritualityProbability.ts
│   │   └── useKeyboard.ts              # 1–5 键盘监听
│   └── styles/
│       ├── tokens.css                  # CSS 变量（颜色 / 圆角 / 阴影）
│       ├── globals.css                 # reset + 字体
│       └── reduced-motion.css          # 媒体查询
├── tests/
│   ├── unit/                           # Vitest
│   └── e2e/                            # Playwright
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 2.3 模块依赖图

```
        ┌────────────────────────────────────────────┐
        │                App.tsx                     │
        │   组合: useSession + useHistory + 概率     │
        └────────┬──────────────────┬────────────────┘
                 │                  │
                 ▼                  ▼
        ┌──────────────┐    ┌──────────────────┐
        │ useSession   │    │ useHistory       │
        │              │    │                  │
        └──────┬───────┘    └─────────┬────────┘
               │                      │
               ▼                      ▼
        ┌──────────────┐    ┌──────────────────┐
        │ state-machine│    │    storage       │
        │              │◄───┤  (localStorage)  │
        └──────┬───────┘    └─────────┬────────┘
               │                      │
               ▼                      ▼
        ┌──────────────┐    ┌──────────────────┐
        │    rng.ts    │    │   statistics.ts  │
        │ (随机目标数) │    │   (纯函数，       │
        │              │    │    无 IO)        │
        └──────────────┘    └──────────────────┘
```

## 2.4 顶层数据流

1. 用户在 `App` 中点击"开始测试"。
2. `useSession` 调用 `state-machine.beginSession()`：
   - 创建 session id、初始化空 rounds 数组、状态置为 `IN_PROGRESS`。
   - 立即调用 `enterNewRound(session)` 生成第 0 轮的 target。
3. `App` 渲染 `RoundView`：`round.target` 通过 `CoveredDigit` 渲染（被遮挡）。
4. 用户输入 → 临时 `previewGuess` → 用户确认 → `submitGuess(roundId, guess)`。
5. `state-machine.submitGuess` 完成状态转移并返回新的 session。
6. `useSession` 在 effect 中把新 session 写入 `storage`。
7. 30 轮完成后，`useSession` 调用 `state-machine.completeSession()`，触发 `useHistory` 重新计算 (k, n) → `useSpiritualityProbability` 重算并渲染 `SpiritualityGauge`。

## 2.5 不变量与守门人

| 不变量 | 守门人 |
|---|---|
| 每一轮 target 在用户进入 `GUESSING` 前已存在 | 状态机守门 + 单点生成（详见 `03-core-mechanics.md` 3.1） |
| target 在 `TARGET_READY` 之后不可变 | TypeScript `readonly` + 状态机禁用 updateTarget |
| 统计函数不接触 IO | `lib/statistics.ts` 严禁 `import` 任何 IO 模块 |
| localStorage 写入异常不破坏内存 | `storage.writeSafe()` 自动 try/catch |
| 键盘事件 `1–5` 不被浏览器默认行为拦截 | `useKeyboard` 中 `event.preventDefault()` |

## 2.6 为什么不引入 Redux / 全局状态库

- 状态机逻辑全部集中在 `state-machine.ts`。
- 视图层只通过 hook 读取，不共享可变状态。
- 不需要时间旅行 / 调试中间件——单个 reducer + 严格测试即可。
- 减少依赖 = 更少意外行为 = 更接近"可审计"目标。
