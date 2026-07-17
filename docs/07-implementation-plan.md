# 07 实施计划

## 7.1 阶段划分

> 每个阶段结束都应能 demo、跑测试。

### 阶段 0：项目脚手架（半天）

- `npm create vite@latest spiritality-test -- --template react-ts`
- 安装：`vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `playwright`
- 配置：
  - `tsconfig.json` 开启 `strict`、`noImplicitAny`、`exactOptionalPropertyTypes`
  - `vitest.config.ts` 配 jsdom 环境
  - `eslint` + 自定义规则（禁止对 `round.target` 赋值）

**Deli**：空壳项目跑起来；`npm test` 与 `npm run dev` 都可工作。

### 阶段 1：核心机制（MUST，2 天）

按 `03-core-mechanics.md` 实现：

- `src/lib/rng.ts`
- `src/lib/schema.ts`
- `src/lib/state-machine.ts`
- `src/hooks/useSession.ts`
- 最小可视化组件：`CoveredDigit`、`GuessInput`（无样式只用 token）

**测试（必须）**：
- 状态机转移矩阵：`beginSession`、`enterNewRound`、`previewGuess`、`submitGuess`、`completeSession`、`cancelSession` 每条转移都测，并测非法转移。
- `enterNewRound` 调用 `generateTarget` 一次；`previewGuess` / `submitGuess` 完全不调用 `generateTarget`（用 spy）。
- 30 轮流程跑通，summary 字段正确。
- 设备：jsdom + vitest。

### 阶段 2：UI 与 macOS 风格（1.5 天）

- `src/styles/tokens.css`、`globals.css`
- 实现各组件（按 `04-ui-design.md`）
- `useKeyboard` 实现键盘 1-5
- 暗色模式与自动切换
- `prefers-reduced-motion` 适配

**测试**：
- @testing-library/react 渲染快照
- 键盘事件模拟 → preview / submit

### 阶段 3：数据持久化（1 天）

- `src/lib/storage.ts`，包括 `writeSafe`、`migrate`
- `src/hooks/useHistory.ts`
- 设置面板 + 导入 / 导出 / 清空
- 防抖写入

**测试**：
- 写入 / 读出往返
- 容量超出 → 错误提示
- 损坏 JSON → 恢复路径
- 迁移函数单元测试

### 阶段 4：统计（1 天）

- `src/lib/betainc.ts` 自实现
- `src/lib/statistics.ts`
- `src/hooks/useSpiritualityProbability.ts`
- `SpiritualityGauge`

**测试**：
- `betainc` 对比 scipy / R 已知值，至少 20 个 case（含极值 `x = 0, 1`、极参数 `a, b = 0.5` 等）
- `spiritualityProbPointNull` 边界 case（`k = 0`, `k = n`，以及用户反例 `n = 1e8, k = 0.21e8`）
- 用户反例必须能通过：`(21e6, 1e8)` 输入应输出 P ≈ 1.0（不依赖 BigInt，log 域即可）
- 后验均值 / 可信区间 sanity
- **核心回归**：保留原先候选 B 的输入 `(40, 150)`，确认新方案给出 ≈ 53%（与手算一致），与旧 ROPE 答案 60-70% 不同 — 这条测试防止文档/代码再次回退到 ROPE

### 阶段 5：完成度（1 天）

- `HistoryList` 分页
- `SettingsPanel` 完整
- 错误边界
- 帮助 / 关于页
- 文档校对

## 7.2 测试矩阵

| 维度 | 工具 | 覆盖目标 |
|---|---|---|
| 纯函数 | Vitest | `rng`、`state-machine`、`statistics`、`betainc`、`storage` |
| React 组件 | @testing-library/react | 每个组件至少 1 个行为 + 1 个 snapshot |
| 流程 | Playwright | 一个完整 30 轮流程；统计条最终态正确 |
| 视觉 | 暂不引入 | 视觉回归不在范围内 |

## 7.3 关键不变量测试（测试集中单独一组）

```
spec/core-mechanics.spec.ts：
  ✓ 任何状态转移都不在 TARGET_READY 之后调用 generateTarget
  ✓ 完整 30 轮中 generateTarget 调用次数 = 30
  ✓ round.target 字段不可被非 enterNewRound 路径修改
  ✓ 中途离开 session 后恢复，target 与离开时完全一致
  ✓ previewGuess 触发后立即重新进入 TARGET_READY 不应改变 target
```

## 7.4 风险清单

| 风险 | 影响 | 对策 |
|---|---|---|
| `betainc` 数值实现精度不够 | 概率误差可能误导 | 双精度实现 + 与 scipy 对比测试；UI 显示精度受限提示 |
| localStorage 容量超限 | 数据丢失 | 启动时估算容量；超过 4MB 提醒归档 |
| 误解"灵性起效"含义 | 用户被误导 | 在所有概率展示旁附公式 + "?" 浮层解释 |
| 用户手抖连按 1-5 | 不必要副作用 | previewGuess 高频不写盘；submitGuess 状态机校验防重 |
| 中途浏览器关闭 | session 丢失 | 每个 transition 后立即写盘（防抖 100ms） |
| 移动端键盘拦截 1-5 | 系统快捷键 | `preventDefault()` 显式处理；明显提示用按钮 |
| 时间相关数据用于审计 | 不可重现 | target 仅与 `roundId` 关联；不写 createdAt 到 target；RNG 默认非种子，可改为种子模式做调试 |

## 7.5 代码评审重点

- **任何 PR 触碰 `state-machine.ts` 或 `rng.ts`**：必须由第二个工程师评审，并跑完整 `core-mechanics.spec.ts`。
- **任何 PR 修改 `statistics.ts` 的默认参数**：必须附数值 sanity 测试。
- **任何 PR 增加新的 localStorage key**：必须更新 `02-architecture.md` 的 key 表与 `05.4` 迁移函数。

## 7.6 发布前清单

- [ ] `npm run build` 通过
- [ ] `npm test` 全绿
- [ ] Playwright E2E 全绿
- [ ] `docs/` 中所有"必须"清单（03.1.5）都有对应测试
- [ ] 暗色模式 + reduced motion 已测
- [ ] 导入 / 导出 / 清空三按钮已测
- [ ] README.md 含"如何运行 / 如何测试"段落
- [ ] 已知限制（如先验选择对结果的影响、Savage-Dickey 假设）写在用户可见位置
