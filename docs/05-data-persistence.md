# 05 数据持久化

## 5.1 存储位置与版本

- 所有数据使用 **浏览器 localStorage**，单源。
- key 前缀：`spirituality:`。
- schema 版本：`v1`，嵌入在 key 中以便未来无破坏性迁移。

## 5.2 Schema

### 5.2.1 类型定义（src/lib/schema.ts）

```ts
export type Digit = 1 | 2 | 3 | 4 | 5

export type RoundStatus = 'TARGET_READY' | 'GUESSING' | 'REVEALED' | 'ABANDONED'

export interface Round {
  readonly id: string                 // uuid v4
  readonly index: number              // 0..29
  readonly target: Digit              // 已生成并冻结
  readonly createdAt: number          // epoch ms
  guess: Digit | null
  status: RoundStatus
  correct: boolean | null
  revealedAt: number | null
}

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED'

export interface SessionSettings {
  roundsPerSession: number            // 默认 30
  exposureTimeMs: number              // 揭示后停留
}

export interface SessionSummary {
  total: number                       // REVEALED 数
  correct: number                     // 其中正确数
  accuracy: number                    // correct/total
  computedAt: number
  // = P(p ≠ 0.20 | data) via Savage-Dickey 密度比，默认 1:1 prior odds
  spiritualityEffectiveProb: number
}

export interface Session {
  id: string
  createdAt: number
  completedAt: number | null
  status: SessionStatus
  rounds: Round[]                     // length ≤ settings.roundsPerSession
  settings: SessionSettings
  summary?: SessionSummary
}

export interface AppSettings {
  theme: 'auto' | 'light' | 'dark'
  roundsPerSession: number
  exposureTimeMs: number
  // 默认 Beta 先验 (α₀ = β₀ = 1)，均匀先验
  priorAlpha: number                  // 默认 1
  priorBeta: number                   // 默认 1
  // 视图选择（默认 'pointNull'）
  view: 'pointNull' | 'oneSided' | 'credibleInterval'
  // 单边模式的阈值；默认 0.20
  oneSidedThreshold: number
  // 可信区间模式的覆盖率；默认 0.95
  credibleLevel: number
}
```

### 5.2.2 localStorage keys

| key | 值类型 | 说明 |
|---|---|---|
| `spirituality:v1:sessions` | `Session[]` | 所有 session 列表 |
| `spirituality:v1:settings` | `AppSettings` | 全局设置 |
| `spirituality:v1:schemaVersion` | `number` | 当前 schema 版本 |

## 5.3 读写策略

### 5.3.1 写入

```ts
function writeSafe(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      toast.error('本地存储已满，请导出或清理历史。')
    }
    return false
  }
}
```

- 状态机每次完成状态转移后调用 `saveSessions(sessions)`。
- 同一个 session 内的高频操作（如 1↔2↔3 数字切换的 previewGuess）**不写盘**，只在 submitGuess 或 enterNewRound 触发后写一次（防抖 100ms）。
- `AppSettings` 在用户每次切换时立即写盘（低频）。

### 5.3.2 读取

- `App.tsx` 启动时一次性加载：`loadSessions()`、`loadSettings()`，构建内存快照。
- 渲染期不直接读 `localStorage`（避免 SSR / 渲染闪烁）。
- 提供 `useHistory()`、`useSession()` 内部封装；对外暴露稳定引用。

### 5.3.3 错误处理

- **JSON 解析失败** → 退回空数组并提示"历史数据损坏，已重置"。
- **schema-version 不匹配** → 走迁移流程（`05.4`）。
- **字段缺失** → 用默认值补齐，并打 console.warn。

## 5.4 迁移

```ts
const CURRENT_VERSION = 1

function migrate(raw: unknown): { version: number, data: unknown } {
  let version = raw?.schemaVersion ?? 0
  let data = raw?.data

  // 0 → 1：所有旧字段补齐
  if (version < 1) {
    data = migrateV0ToV1(data)
    version = 1
  }

  return { version, data }
}
```

- 每个迁移函数纯函数、单测覆盖。
- 任何迁移失败：原始数据原样备份到 `spirituality:v1:backup-${ts}`。

## 5.5 导出 / 导入 / 清空

UI 入口：`SettingsPanel` 中三个按钮。

### 5.5.1 导出

```ts
function exportAll(): Blob {
  const payload = {
    schemaVersion: 1,
    exportedAt: Date.now(),
    sessions: loadSessions(),
    settings: loadSettings(),
  }
  return new Blob([JSON.stringify(payload, null, 2)],
                  { type: 'application/json' })
}
```
- 触发下载：`spirituality-export-${ts}.json`。

### 5.5.2 导入

- 用户上传 `.json` → 校验 schema 版本 → 二次确认"将覆盖当前所有数据"或"合并到现有数据"。
- 合并时按 `session.id` 去重，保留较新的 `completedAt`。
- 导入后强制 reload state。

### 5.5.3 清空

- 二次确认（输入"确认清空"或点击二次模态按钮）。
- 清空后写一个空数组，并通过事件触发 UI 重置。

## 5.6 容量监控

- 启动时读 `JSON.stringify(loadSessions()).length` 估算占用。
- 当 `> 4MB`（5MB 上限的 80%）时在 `SettingsPanel` 顶部提示"建议归档历史"。

## 5.7 不写入盘的内容

- `useSession` 的临时 `previewGuess` 不写盘。
- 揭示动画过程中的中间渲染不写盘。
- 调试信息、错误堆栈不写盘。

## 5.8 测试要求

- `storage.spec.ts` 用 `jsdom` + mock `localStorage`：
  - 写入成功路径。
  - 容量超限模拟（monkey-patch）。
  - 损坏 JSON 输入的恢复。
- 不依赖真实浏览器 localStorage。
