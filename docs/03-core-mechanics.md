# 03 核心机制

> ⚠️ **本章是整个系统最关键的部分。** 改动 03.1（随机数时序）必须经过专门的设计评审。

## 3.1 随机数时序原则（强制）

### 3.1.1 原则陈述

> **每一轮的目标数（target）必须在用户进入"猜测"阶段（`GUESSING`）之前就已经生成完毕并冻结；目标数从生成那一刻起直到本轮 `REVEALED` 不可被任何代码路径重新生成。**

### 3.1.2 为什么必须这样

应用的设计前提是：用户在猜测一个"已经存在的数字"，而不是"猜什么就出什么"。从架构角度，三条理由：

1. **逻辑公平性**
   - 若 target 在用户选择后才生成，那么用户的"命中"将退化为纯粹的巧合率（30 轮期望 20% 命中）。所谓"灵性测试"将没有任何意义。
   - 让"target 先存在"，用户的猜测才是真正的独立变量。

2. **UX 真实感**
   - 用户在阅读测试说明时，会自然形成"我猜测的，是一个已经在那里的数字"的心智模型。
   - 代码必须与之严格一致，否则用户感知到的"灵性现象"完全是 UX 错觉。

3. **可审计**
   - 任意一轮的 (target, guess) 对都来自两个相互独立的时间点：target 在 `enterNewRound` 时生成，guess 在用户提交时输入。
   - 这让数据导出（target 字段）对得起"灵性测试"四个字。

### 3.1.3 通过架构强制该原则

我们用 **三层叠加** 的机制保证不变量被破坏时一定会暴露错误，而非悄悄出错：

#### (a) 状态机守门

合法状态机：

```
                ┌───────────────────────────────────────────────┐
                │                                               │
                ▼                                               │
            ┌──────┐    ┌──────────────────┐    ┌────────┐    ┌─▼────────┐
       ┌───►│ INIT │───►│  TARGET_READY   │───►│GUESSING│───►│REVEALED  │
       │    └──────┘    │ (target 已冻结) │    │        │    │          │
       │                 └──────────────────┘    └────────┘    └────┬────┘
       │                                   ▲                          │
       │                                   │                          ▼
       │                              (撤销/重置)               (next round)
       │                                                              │
       └──────────────────────────────────────────────────────────────┘
```

- **`INIT`**：组件挂载，进入状态机。第一件事是 **同步生成 target 并立刻进入 `TARGET_READY`**。
- **`TARGET_READY`**：target 已稳定存在。UI 渲染"被遮挡的数字"。user 输入在此期间被允许但不改变 target。
- **`GUESSING`**：用户已按下某个数字键 / 按钮作为临时 guess；target 仍然稳定。
- **`REVEALED`**：本轮结束，结果记录完成。target 在本状态被读取用于 `correct = guess === target` 的对比。

**唯一允许生成 target 的状态转移**：`(*, *) → TARGET_READY`（在 `INIT` 阶段创建 round 时）。

任何代码路径都不能在 `TARGET_READY`、`GUESSING`、`REVEALED` 状态下调用 `generateTarget()`。

#### (b) 单点生成

- 所有 target 生成均通过 `lib/rng.ts` 的 `generateTarget(roundId: string): 1|2|3|4|5`。
- `state-machine.ts` 暴露 `enterNewRound(currentSession, roundIndex)`，其 **唯二** 职责：
  1. 调用 `generateTarget(roundId)`；
  2. 把生成的 target 写入新 round，状态置 `TARGET_READY`。
- React 组件 **禁止** 直接调用 `generateTarget`；只能通过 `state-machine` 的方法（`beginSession`、`enterNewRound`）。

#### (c) 不变性 (immutability)

- `Round.target` 在 `TARGET_READY` 之后视为只读。
- TypeScript 类型：`target: Readonly<1|2|3|4|5>`（TS 不支持 readonly literal union，所以实际写：

```ts
type Digit = 1 | 2 | 3 | 4 | 5
interface Round {
  target: Digit
  ...
}
```

- 在 `state-machine.ts` 中，构造新 round 时通过 frozen object / `Object.freeze` 加重保护。
- ESLint 规则禁止对 `target` 字段赋值。

### 3.1.4 伪代码

**`lib/rng.ts`**

```ts
export type Digit = 1 | 2 | 3 | 4 | 5

export function generateTarget(roundId: string): Digit {
  // 唯一随机源；可在测试时换成种子化版本。
  const n = Math.floor(Math.random() * 5) + 1
  return n as Digit
}
```

**`lib/state-machine.ts`**（核心）

```ts
import { generateTarget, Digit } from './rng'

const ROUNDS_PER_SESSION = 30

export type RoundStatus = 'TARGET_READY' | 'GUESSING' | 'REVEALED' | 'ABANDONED'

export interface Round {
  readonly id: string
  readonly index: number
  readonly target: Digit      // 一经创建即冻结
  readonly createdAt: number
  guess: Digit | null
  status: RoundStatus
  correct: boolean | null
  revealedAt: number | null
}

export function enterNewRound(session, roundIndex): Session {
  const roundId = crypto.randomUUID()
  const target = generateTarget(roundId)   // ← ① 先于用户输入生成
  return appendRound(session, {
    id: roundId,
    index: roundIndex,
    target,                              // ← ② 已冻结
    createdAt: Date.now(),
    guess: null,
    status: 'TARGET_READY',
    correct: null,
    revealedAt: null,
  })
}

export function previewGuess(session, roundId, guess): Session {
  const round = mustFindRound(session, roundId)
  if (round.status !== 'TARGET_READY') {
    throw new Error(`Cannot preview in status ${round.status}`)
  }
  // 注意：不调用 generateTarget
  return updateRound(session, roundId, {
    guess,
    status: 'GUESSING',
  })
}

export function submitGuess(session, roundId, guess): Session {
  const round = mustFindRound(session, roundId)
  if (round.status !== 'TARGET_READY' && round.status !== 'GUESSING') {
    throw new Error(`Cannot submit in status ${round.status}`)
  }
  // 注意：不调用 generateTarget
  const correct = guess === round.target       // ← ③ 只读 round.target
  return updateRound(session, roundId, {
    guess,
    status: 'REVEALED',
    correct,
    revealedAt: Date.now(),
  })
}
```

**React 视图**

```tsx
function RoundView({ round }: { round: Round }) {
  return (
    <div className="round">
      <CoveredDigit digit={round.target} />
      <GuessInput
        disabled={round.status === 'REVEALED' || round.status === 'ABANDONED'}
        value={round.guess}
        onPreview={g => previewGuess(round.id, g)}
        onSubmit={g => submitGuess(round.id, g)}
      />
      {round.status === 'REVEALED' && (
        <ResultPanel
          correct={round.correct!}
          target={round.target}
          guess={round.guess!}
        />
      )}
    </div>
  )
}
```

### 3.1.5 测试覆盖要求

测试套件 **必须** 包含以下断言：

1. `enterNewRound` 调用一次 `generateTarget`。
2. `previewGuess` 不调用 `generateTarget`。
3. `submitGuess` 不调用 `generateTarget`。
4. 在 `TARGET_READY` 之后修改 session，target 字段不应被修改。
5. 完整 30 轮流程中，`generateTarget` 共被调用 30 次（每轮 1 次）。
6. 用户中途退出，再恢复时无法"补打"已生成但未完成的 round 的 target（target 仍然是当时生成的那个数）。

## 3.2 完整测试 session 流程

| 步骤 | 行为 | 状态机入口 |
|---|---|---|
| 1 | 用户点击"开始测试" | `beginSession()` |
| 2 | 渲染第 0 轮，target 已生成 | `enterNewRound(session, 0)` |
| 3 | 用户输入 4（实时预览） | `previewGuess(round.id, 4)` |
| 4 | 用户按 Enter 提交 | `submitGuess(round.id, 4)` |
| 5 | 揭示反馈 800ms 后自动 / 按钮触发 | `enterNewRound(session, i+1)` 或 `completeSession(session)` |
| 6 | 第 29 轮 submit 后 | `completeSession(session)`：计算 summary，写入 storage |

> **实施注记（修订记录）**：早期实现 `findActiveRound` 仅匹配 `TARGET_READY`/`GUESSING`，导致用户提交后 round 进入 `REVEALED` 时返回 `null`，App 视图条件 `session && activeRound` 落到 hero 屏，用户被"踢回首页"。修复：`findActiveRound` 还会在没有活跃轮次时回退到"最近一条 `REVEALED` 的 round"，让反馈面板在用户点"下一题"前保持可见。回归测试已加在 `state-machine.test.js`。

> **实施注记（第二次修订）**：另一个 bug——`useSession.endAndArchive` 无条件调用 `completeSession`，但 session 进入 SessionSummary 时已由 `onSubmit` 完成转 COMPLETED；第二次调用会抛 `session in status COMPLETED`，导致"再来一次"按钮无效。修复：仅当 session 仍是 `IN_PROGRESS`（即中途放弃场景）时才调用 `completeSession`；否则直接保存 `COMPLETED` 的 session。已加端到端测试 `restart.test.jsx` 钉住完整 30 轮流程。

### 3.2.1 揭示间隔

- 默认 `exposureTimeMs = 800`。该参数存于 `session.settings`，可被全局设置覆盖。
- 揭示后的 800ms 内允许：
  - 立即进入下一轮（"下一轮"按钮）；
  - 让计时自动到点进入下一轮。
- 在揭示阶段目标数已显示，但本轮已 `REVEALED`，不允许再修改 guess。

### 3.2.2 Session 边界

- `session.status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'`。
- 当 `rounds.length === ROUNDS_PER_SESSION` 且最后一轮 `status === 'REVEALED'` 时，可进入 `COMPLETED`。

## 3.3 取消 / 退出

- **用户主动取消**：当前未 `REVEALED` 的 round 标记为 `ABANDONED`，session 整体保留在历史中但 `status = 'ABANDONED'`。
- **页面刷新**：从 `storage` 恢复 session；所有已 `REVEALED` 的 round 保留；未揭示的 round 可以继续（target 已冻结）。
- **离开测试但不取消**：等同主动取消。

## 3.4 输入方式

### 3.4.1 按钮
- 1–5 五个等宽按钮横排。
- hover：背景色变 token accent。
- active：scale(0.97)。
- 选中态：已按下按钮描边 accent 色。

### 3.4.2 键盘
| 键 | 行为 |
|---|---|
| `1` `2` `3` `4` `5` | 设置当前 guess（previewGuess） |
| `Enter` | 提交当前 guess（submitGuess） |
| `Backspace` / `Esc` | 清空当前 guess（重置为 GUESSING 但 target 不变） |
| `→` / `Space` | 在揭示阶段跳到下一轮 |

- `useKeyboard` hook 全局监听 `window.keydown`；当焦点在 `<input>` 中时不监听，避免与文本输入冲突（本项目无文本输入，但保留）。

## 3.5 数据正确性约束

- 一旦 `status = 'REVEALED'`，该 round 的 `target`、`guess`、`correct`、`revealedAt` **均不可变**。
- 历史聚合 (k, n) 永远只统计 `status === 'REVEALED'` 的 round。
- `ABANDONED` round 不计入任何聚合。
