# 灵性测试（Spirituality Test）

每一轮，一个 1–5 的数字出现在屏幕上，但被一个不透明的卡片盖住。你要猜测这个数字。
每场 30 轮。基于你的全部历史数据，用贝叶斯方法计算"灵性起效"的概率。

## 运行

```bash
npm install
npm run dev          # 启动 Vite dev server (http://localhost:5173)
npm test             # 跑 vitest 单元测试
npm run build        # 生产构建到 dist/
```

## 核心机制

**目标数时序**：每一轮的目标数字在用户进入猜测阶段**之前**就已经生成并冻结。具体架构级保证见 `docs/03-core-mechanics.md`。

**统计指标**：采用 **Savage-Dickey 密度比**作为默认概率指标。

$$
P(\text{灵性起效}) = P(p \neq 0.20 \mid \text{data}) = \frac{1}{1 + \text{BF}_{01}}
$$

$$
\text{BF}_{01} = \frac{f(0.20 \mid \text{data})}{f(0.20)} \quad \text{（先验 Beta(1, 1) ⇒ f(0.20) = 1）}
$$

UI 同时支持切换到 `P(p > 0.20)`（单边）和 95% 可信区间两种视图。

详细推导与边界情况见 `docs/06-statistics.md`。

## 文件结构

```
src/
├── lib/                纯函数模块（rng, betainc, statistics, state-machine, storage, schema）
├── hooks/              自定义 React hooks
├── components/         UI 组件（macOS 风格 + CSS Modules）
├── styles/             CSS 变量 token + globals
├── App.jsx             顶层装配
└── main.jsx            入口
docs/                   设计文档（7 份）
```

## 测试

51 个测试，全部通过：

- `src/lib/__tests__/state-machine.test.js` — 状态机转移矩阵、target 不可变性
- `src/lib/__tests__/statistics.test.js` — betainc、贝叶斯指标、用户反例
- `src/lib/__tests__/rng.test.js` — 数字生成
- `src/components/__tests__/components.test.jsx` — 组件渲染

## 数据持久化

所有数据存储于浏览器 `localStorage`：

- `spirituality:v1:sessions` — Session 列表
- `spirituality:v1:settings` — 应用设置
- `spirituality:v1:schemaVersion` — schema 版本（用于未来迁移）

UI 中支持 **导出 JSON / 导入 JSON / 清空全部**。
