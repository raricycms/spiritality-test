# 04 UI 设计

## 4.1 设计风格基调

参考 **macOS Sonoma**：
- 圆润（卡片圆角 16px、按钮圆角 10px）
- 轻拟物阴影（柔和扩散阴影，避免硬边）
- 半透明背景 + 毛玻璃（`backdrop-filter: blur(20px)`）
- 系统字体（`-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue"`）
- 中性冷灰调，强调色只用一种（系统蓝 `#007aff`）
- 结果反馈用对比强烈的成功绿 `#34c759`、失败红 `#ff3b30`，但克制使用

**不做什么**：
- 不做渐变 hero section；
- 不做霓虹强调色；
- 不引入 emoji 图标（必要时用 SF Symbols Unicode）；
- 不放非必要的插画。

## 4.2 设计 Token

`src/styles/tokens.css`：

```css
:root {
  --color-bg:            #f5f5f7;
  --color-card:          rgba(255, 255, 255, 0.72);
  --color-card-border:   rgba(0, 0, 0, 0.06);
  --color-text:          #1d1d1f;
  --color-text-secondary:#6e6e73;
  --color-text-muted:    #a1a1a6;
  --color-accent:        #007aff;
  --color-success:       #34c759;
  --color-danger:        #ff3b30;
  --color-warning:       #ff9500;

  --radius-card:    16px;
  --radius-button:  10px;
  --radius-pill:    999px;

  --shadow-card:   0 8px 32px rgba(0, 0, 0, 0.08);
  --shadow-button: 0 1px 2px rgba(0, 0, 0, 0.08);
  --shadow-pop:    0 12px 48px rgba(0, 0, 0, 0.18);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   400ms;
  --ease-out:        cubic-bezier(0.16, 1, 0.3, 1);

  --font-sans: -apple-system, BlinkMacSystemFont,
               "SF Pro Display", "Helvetica Neue",
               "Helvetica", "Arial",
               "PingFang SC", "Hiragino Sans GB",
               "Microsoft YaHei", system-ui, sans-serif;
}

[data-theme="dark"] {
  --color-bg:            #1e1e1e;
  --color-card:          rgba(40, 40, 40, 0.72);
  --color-card-border:   rgba(255, 255, 255, 0.08);
  --color-text:          #f5f5f7;
  --color-text-secondary:#a1a1a6;
  --color-text-muted:    #6e6e73;
}
```

主题切换：检测 `prefers-color-scheme: dark`，并提供手动切换入口（`SettingsPanel` 中的开关）。

## 4.3 主视图布局

```
┌──────────────────────────────────────────────────────────┐
│   ●  ●  ●      灵性测试                  [☾] [⚙] [?]  │  ← 标题栏（占位 macOS 控件）
├──────────────────────────────────────────────────────────┤
│                                                          │
│                  第 7 / 30 轮                            │
│                                                          │
│              ┌──────────────────────┐                   │
│              │                      │                   │
│              │                      │                   │
│              │         ?            │  ← CoveredDigit   │
│              │      (被遮挡)        │     240×240       │
│              │                      │     圆角 16px     │
│              │                      │                   │
│              └──────────────────────┘                   │
│                                                          │
│            ┌──┐  ┌──┐  ┌──┐  ┌──┐  ┌──┐                  │
│            │ 1│  │ 2│  │ 3│  │ 4│  │ 5│  ← GuessInput   │
│            └──┘  └──┘  └──┘  └──┘  └──┘                  │
│                                                          │
│              当前选择：4          [提交]                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

揭示态：`CoveredDigit` 翻开除动画（200ms），显示目标数字：

```
正确：                         错误：
┌──────────────────────┐     ┌──────────────────────┐
│                      │     │                      │
│         4           │     │         2           │
│    (绿色描边)        │     │    (红色描边)        │
│                      │     │                      │
└──────────────────────┘     └──────────────────────┘
        ✔ 正确                     ✕ 错（答案是 2）
```

## 4.4 组件规格

### 4.4.1 `CoveredDigit`

| 属性 | 类型 | 说明 |
|---|---|---|
| `digit` | `Digit` | 来自 round.target |
| `revealed` | `boolean` | 是否揭示 |

尺寸：
- 容器：width 240px, height 240px, border-radius 16px
- 数字字体：size 96px, weight 600, `font-variant-numeric: tabular-nums`
- 背景：token `--color-card` + backdrop-filter blur
- 阴影：`--shadow-card`

状态：
- **未揭示**：模糊背景上覆盖 `?` 字符 + 标题 "请猜测这个数字"。
- **揭示**：cover flip-out 动画（`rotateY 180deg`），目标数字居中显示；外边框颜色由 result 决定。

### 4.4.2 `GuessInput`

- 5 个按钮水平排列，间距 12px。
- 每个按钮 56×56px，圆角 10px；按下时 scale(0.97)。
- 键盘监听由 `useKeyboard` 提供；按钮需保持焦点可见（`:focus-visible` 用 accent 描边）。
- 提交按钮：仅在有 guess 时启用。

### 4.4.3 `ResultPanel`

- 圆角胶囊，垂直方向贴近 `CoveredDigit`。
- 正确：背景 token `--color-success`，文字 "✔ 正确"。
- 错误：背景 token `--color-danger`，文字 `✕ 错（答案是 3）`。

### 4.4.4 `SessionSummary`

```
─────────────────────────────────────────
                测试结束
─────────────────────────────────────────
  本次：第 1 场      2026-07-17 16:38
  正确：21 / 30（70.0%）

  题号分布：
  [✓][✓][✕][✓][✕][✓][✓][✕][✓][✓]    ← 第 1–10 题
  [✕][✓][✓][✓][✕][✓][✓][✕][✓][✓]    ← 第 11–20 题
  [✓][✕][✓][✓][✓][✓][✓][✕][✓][✕]    ← 第 21–30 题

  全局统计：
  累计答题 N=150，命中 K=40
  P(p ≠ 0.20 | data) = 68.3%   （默认视图：Savage-Dickey 密度比）
  ─────────────────────────── 100%

  [再来一次]   [查看历史]
```

- 题号 grid：3 × 10，每格 24px，颜色基于 `correct`。
- 进度条：参见 `SpiritualityGauge`。

### 4.4.5 `SpiritualityGauge`

- 横向进度条，长度自适应容器（最小 240px，最大 100%）。
- 内部文字：百分比显示，1 位小数。
- 颜色映射：
  - `< 30%`：灰色
  - `30% – 70%`：accent 蓝
  - `> 70%`：success 绿
- 标签行：标题 "灵性起效的概率"，副标题为公式（默认 `P(p ≠ 0.20 | 你 N 次答题)`；用户可在设置中切换为 `P(p > 0.20 | ...)` 或显示 95% 可信区间）。
- 当 `n < 30`：进度条显示为虚线，并标注"样本量不足（n < 30）"。

### 4.4.6 `HistoryList`

- 倒序列出所有 session（最新在前）。
- 每行：日期、正确率（K/N）、灵性起效概率。
- 点击展开查看该场题号 grid。
- 支持"导出 JSON"、"导入 JSON"、"清空全部数据"。

## 4.5 动效

| 场景 | 动效 |
|---|---|
| 揭示数字 | flip-out `rotateY 180deg`, 200ms `--ease-out` |
| 反馈胶囊出现 | translate-y 8px → 0 + opacity 0 → 1, 150ms |
| 按钮按下 | scale 1 → 0.97, 120ms |
| 进度条变化 | width transition, 400ms |
| 主题切换 | 不做整页动画；仅 transition color/background 200ms |

`@media (prefers-reduced-motion: reduce)` 下禁用所有 transition / transform。

## 4.6 可访问性

- 颜色对比度：所有正文 ≥ AA（4.5:1）。
- 键盘可达：所有交互元素均可在仅键盘下完成。
- ARIA：
  - `CoveredDigit` 在揭示态使用 `role="img"`，`aria-label` 为 "目标数字 N"。
  - 进度条使用 `role="progressbar"`，`aria-valuenow` 等。
  - 焦点可见：`:focus-visible { outline: 2px solid var(--color-accent) }`。
- 屏幕阅读器：不依赖纯色图标；按钮带文字或 `aria-label`。

## 4.7 响应式

- 断点：
  - `≥ 768px`：上面的横向布局。
  - `< 768px`：单列居中，按钮缩小到 48×48，整体 padding 24px。
- 不做复杂适配；测试是简单的单屏应用。
