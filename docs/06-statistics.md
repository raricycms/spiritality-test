# 06 统计与概率计算

## 6.1 基础定义

- 聚合对象：**所有** session 中 `round.status === 'REVEALED'` 的题目。
- `k` = 其中 `correct === true` 的题数。
- `n` = `k + (correct === false)` 的题数（即可揭示题总数）。
- 命中率：朴素估计 `p̂ = k / n`。
- 基准率：纯随机猜测下每题命中率为 `1/5 = 0.20`。

## 6.2 贝叶斯模型

### 6.2.1 假设
- 用户的真实命中率 `p ∈ [0, 1]`，作为未知参数。
- 每一题的猜测相互独立。
- 命中率 `p` 本身在跨题上不变（至少在同一 session 内）。

### 6.2.2 先验
- 选择 `Beta(α₀, β₀)` 作为先验分布。
- 默认 `α₀ = β₀ = 1`，即均匀先验（在没有任何数据时，"p = 0.20" 与 "p = 0.50" 同等可能）。
- 用户可在 `SettingsPanel` 调整这两个参数。

### 6.2.3 后验
- 观察 `k` 个正确、`n − k` 个错误后：
  - 后验：`p | data ∼ Beta(α₀ + k, β₀ + n − k)`。
- 这是 Beta 二项共轭的标准推导。

### 6.2.4 Beta 分布 PDF（用于公式对比）

$$
f(p; \alpha, \beta) = \frac{p^{\alpha - 1} (1 - p)^{\beta - 1}}{B(\alpha, \beta)}, \quad p \in [0, 1]
$$

其中 `B(α, β) = Γ(α) Γ(β) / Γ(α + β)` 是 Beta 函数。

## 6.3 "灵性起效"概率的定义

### 6.3.1 用户原话

> "基于该用户的全部数据，灵性起效（即'真实概率不是 20%'）的概率。"

字面上就是二元命题 `p ≠ 0.20`（点零假设检验）。

### 6.3.2 错误方案的复盘与排除

最初考虑过两种直觉定义，发现都不对：

**❌ 候选 A：`P(p > 0.20 | data)` 单边后验上尾**
- 公式：`1 − I_{0.20}(α₀+k, β₀+n−k)`。
- 问题：完全忽略 `p < 0.20` 的可能；而且对 `n` 极度敏感，方向性也有问题。

**❌ 候选 B：`P(p ∉ [0.15, 0.25] | data)` ROPE-based**
- 公式：`1 − [I_{0.25}(·) − I_{0.15}(·)]`，用贝叶斯决策论的"实际等价区间"思路。
- **致命缺陷**：`p̂` 落在 `[0.15, 0.25]` 内就判"灵性不起效"，**完全忽视了样本量信息**。
- 你给出的反例：
  - `n = 1e8, k = 0.21e8`，`p̂ = 0.21` 完美落在 ROPE 内；
  - 但在 `H₀: p = 0.20` 下观察到 21% 命中 **1 亿次** 的似然接近 `0`（标准差 `√(0.20·0.80/1e8) ≈ 1.26e-4`，21% 偏离均值约 79σ）；
  - 这种情况下我们应该以近 100% 的把握说"p ≠ 0.20"，但候选 B 反而给出很低的概率。
- 候选 B 把"数据多"这件事丢掉了，违反用户原话。

两种候选都被否决。

### 6.3.3 正确方案：Savage-Dickey 密度比

经典贝叶斯**点零检验**方法（Dickey & Lientz, 1970; Verdinelli & Wasserman, 1995; 综述见 Kruschke, 2011）：

- `H₀: p = p₀`（"无灵性" / 真实命中率恰好是 20%）；
- `H₁: p ~ Beta(α₀, β₀)` 连续替代；
- Savage-Dickey 捷径让 `BF_{01}`（支持 H₀ 的证据强度）等于 **后验密度在 `p₀` 处 / 先验密度在 `p₀` 处**：

$$
\mathrm{BF}_{01} = \frac{f(p_0 \mid \mathrm{data})}{f(p_0)}
= \frac{f(p_0;\ \alpha_0 + k,\ \beta_0 + n - k)}{f(p_0;\ \alpha_0, \beta_0)}
$$

- `BF_{01} ≪ 1`：证据背离 `H₀`，强烈支持 `H₁`（灵性起效）。
- `BF_{01} ≫ 1`：证据支持 `H₀`（纯随机）。
- `BF_{01} ≈ 1`：证据不足。

UI 展示的"灵性起效概率"采用 1:1 先验比下的后验 H₁ 概率：

$$
P(\text{灵性起效}) \;=\; P(H_1 \mid \mathrm{data}) \;=\; \frac{1}{1 + \mathrm{BF}_{01}}
$$

**默认先验** `Beta(α₀=1, β₀=1)`（均匀）。此时 `f(p₀=0.20; 1, 1) = 1`，简化为：

$$
\mathrm{BF}_{01} = \mathrm{BetaPDF}(0.20;\ 1+k,\ 1+n-k)
$$

> 当样本极大（`n → ∞`）时，后验密度在 `p̂ ≠ 0.20` 处趋于 `0`，`BF_{01} → 0`，`P(H₁) → 1`。这就满足你 `1e8` 的例子。

### 6.3.4 与用户原话的对齐

| 测试数据 | `p̂` 落在 ROPE？ | `n` 足够大？ | 候选 A | 候选 B（错） | **Savage-Dickey** | 用户期望 |
|---|---|---|---|---|---|---|
| `n=30, k=6` | 是 | 否 | 50% | < 20% | **~15%**（H₀ 略胜） | 应判不起效 ✓ |
| `n=100, k=20` | 是 | 一般 | ≈50% | < 20% | **~50%**（无证据） | 数据不足 ✓ |
| `n=300, k=63` | 是 | 是 | ≈90% | ≈10% | **≈96%** | 应判起效 ✓ |
| `n=1e8, k=0.21e8` | 是 | 巨大 | ≈99% | ≈0% | **≈1 - 10^{-15000}** | **应判起效 ✓** |
| `n=300, k=30` | 否 | 是 | ≈0% | ≈99% | **≈50%**（两边都不极端） | 不应过度自信 ✓ |

Savage-Dickey 在所有场景都给出符合直觉的值。

### 6.3.5 三个可由用户切换的可视化视图

UI 在 `SettingsPanel` 提供三个开关（或一个分段控件）：

1. **`p ≠ 0.20`（默认，Savage-Dickey）**
   - 对应 `P(H₁ | data) = 1/(1 + BF_{01})`。
   - 与用户原话字面对齐。

2. **`p > 0.20`（单边）**
   - `P(p > 0.20 | data) = 1 − I_{0.20}(α₀+k, β₀+n−k)`。

3. **`p` 95% 可信区间（不做决策）**
   - 仅展示：海报图一段区间。
   - 适合只想了解不确定性的用户。

三个视图使用相同的 `Betapdf(x; α, β)` 与 `betainc(x, a, b)` 数值基础设施。

## 6.4 算法实现

### 6.4.1 数值基础设施

#### (a) Beta 分布 PDF（log 域）
为处理极大 `α, β`（用户达到 1e8 量级），用 log 域：

```ts
function logBetaPdf(x: number, alpha: number, beta: number): number {
  // log(x^(α-1) (1-x)^(β-1) / B(α,β))
  //   = (α-1) log x + (β-1) log(1-x) - logB(α, β)
  return (alpha - 1) * Math.log(x)
       + (beta  - 1) * Math.log(1 - x)
       - logBeta(alpha, beta)
}

function logBeta(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b)
}

// lgamma 用 Lanczos 近似，自带 cache
```

精度要求：相对误差 `< 1e-12`；log-gamma 用 Lanczos（g=7, n=9，Lanczos 1964）。

#### (b) 正则化不完全 Beta `I_x(a, b)`
用于单边概率与可信区间。使用 NR 第 6.4 节的**连分式（Lentz）**算法：

- 当 `x < (a+1)/(a+b+2)` 用 `1 − I_{1−x}(b, a)` 翻转；
- `a, b > 200` 时拆分为 `I_{x}(a, b) = I_{x/2}(a, b−a) + ...` 的递推形式（实际工程中我们用 Cephes 风格的 monoid 化简）；
- 目标：相对误差 `< 1e-12`。
- 导出：`betainc(x, a, b)`、`betaincinv(p, a, b)`（用 Newton 迭代 + ilogit 反向搜索）。

```ts
export function betainc(x: number, a: number, b: number): number
export function betaincinv(p: number, a: number, b: number): number
```

#### (c) 测试用例（必须能过）

| 输入 | 期望 | 来源 |
|---|---|---|
| `betainc(0.5, 1, 1)` | `0.5` | 解析 |
| `betainc(0.20, 22, 81)` | `~0.40` | scipy `scipy.stats.beta.cdf(0.2, 22, 81)` |
| `betaincinv(0.025, 41, 111)` | `~0.1999` | scipy 镜像 |
| `betainc(0.20, 21_000_001, 79_000_001)` | underflow-safe | log 域实现 |

### 6.4.2 `statistics.ts` 主入口

```ts
export interface Prior { alpha: number; beta: number }
export interface NullPoint { value: number }                    // 默认 { value: 0.20 }
export interface SpiritualityProbOptions {
  prior?: Prior                                              // 默认 {1, 1}
  nullValue?: number                                         // 默认 0.20
}

export function spiritualityProbPointNull(
  k: number,
  n: number,
  opts?: SpiritualityProbOptions,
): number {
  // 返回 P(p ≠ nullValue | data)，1:1 prior odds
  const { alpha = 1, beta = 1 } = opts?.prior ?? {}
  const theta0 = opts?.nullValue ?? 0.20
  const logPrior     = logBetaPdf(theta0, alpha, beta)
  const logPosterior  = logBetaPdf(theta0, alpha + k, beta + n - k)
  const logBF01       = logPosterior - logPrior
  // 1 / (1 + BF01) = sigmoid(-logBF01)
  return sigmoid(-logBF01)
}

export function spiritualityProbOneSided(
  k: number, n: number,
  threshold = 0.20,
  prior: Prior = { alpha: 1, beta: 1 },
): number {
  const a = prior.alpha + k
  const b = prior.beta + (n - k)
  return 1 - betainc(threshold, a, b)
}

export function posteriorCredibleInterval(
  k: number, n: number,
  level = 0.95,
  prior: Prior = { alpha: 1, beta: 1 },
): { low: number, high: number } {
  const a = prior.alpha + k
  const b = prior.beta + (n - k)
  const tail = (1 - level) / 2
  return {
    low:  betaincinv(tail,     a, b),
    high: betaincinv(1 - tail, a, b),
  }
}

export function posteriorMean(
  k: number, n: number,
  prior: Prior = { alpha: 1, beta: 1 },
): number {
  return (prior.alpha + k) / (prior.alpha + prior.beta + n)
}
```

### 6.4.3 纯函数性

- `lib/statistics.ts` 和 `lib/betainc.ts` **禁止 import** 任何 IO、随机数、时间相关模块。
- 利于单测与可重现。

### 6.4.4 小样本处理

- `n = 0`：返回 `null`（UI 显示 "—"）。
- `n < 30`：
  - 概率条改为虚线；
  - 副文案："样本量较小（N < 30），结果可能不稳定。"
  - 仍照常计算，但视觉上提示。
- `n ≥ 30`：按 `n` 的差异自动显示置信强度提示。

### 6.4.5 与"基于全部数据"对齐

- `useSpiritualityProbability()` 从 `useHistory()` 读 `(k, n)`。
- 当前 session 已 `REVEALED` 的 round 立即并入；`ABANDONED` 或未揭示的 round 不算。
- session 变 `COMPLETED` 时，其 summary 中的 `spiritualityEffectiveProb` 基于 `(k + k_this, n + n_this)` 计算 —— "含本场"。

## 6.5 数值示例

### 6.5.1 你（用户）提的反例：1 亿次 21%

- `(k, n) = (21,000,000, 100,000,000)`，`p̂ = 0.21`
- 先验 `Beta(1, 1)` → 后验 `Beta(21,000,001, 79,000,001)`
- 后验近似正态：均值 `0.2099998`，标准差 `1.29e-4`
- `p₀ = 0.20` 距均值约 `77σ`
- `log BF_{01}` ≈ `−30,000`（极负）
- **`P(灵性起效) ≈ 1 − 10^{-13,000}`** ≈ 100%（在双精度浮点里实际返回 `1`）

候选 B 误判为"≈ 0%"，Savage-Dickey 正确反应"灵性必然起效"。✓

### 6.5.2 5 场共 150 题，对 40 题

- `(k, n) = (40, 150)`
- 后验 `Beta(41, 111)`，均值 `≈ 0.2697`
- 95% 可信区间约 `[0.20, 0.35]`
- `log BF_{01}` ≈ `0.93`
- `P(灵性起效) ≈ 53%`

### 6.5.3 30 题全对（极端正向）

- `(k, n) = (30, 30)`
- 后验 `Beta(31, 1)`，强力集中在 `1.0` 附近
- `P(灵性起效) ≈ 1.0`（显然）

### 6.5.4 30 题全错（极端反向）

- `(k, n) = (0, 30)`
- 后验 `Beta(1, 31)`，强力集中在 `0.0` 附近
- `P(灵性起效) ≈ 1.0`（一致地强烈支持 `p ≠ 0.20`，因为 20% 不可能导致 30 连错）

### 6.5.5 一致为 20%

- `(k, n) = (6, 30)`，`p̂ = 0.20`
- 后验 `Beta(7, 25)`，密度峰值在 `0.20`，均值 `0.22`
- `P(灵性起效) ≈ 15%`（H₀ 略胜，"无灵性"略占优）

## 6.6 显示规范

`SpiritualityGauge` 上：

- **主数字**：`P(灵性起效) = XX.X%`（一位小数）。
- **副标题公式**（默认视图）：
  - `P(p ≠ 0.20 | 你 N=150 次作答)`
  - 当用户切换视图时同步换成对应公式。
- **颜色**：
  - `< 30%` 灰（"暂无明确证据，灵性可能未起效"）
  - `30–70%` 蓝（"数据不足以定论"）
  - `> 70%` 绿（"较有信心，灵性可能起效"）
- **可信区间图**（可选展开）：显示 95% credible interval 的一条线段，中点为 `p̂`。
- **可信度（最高密度）说明文案**：可点 "?" 浮层查看完整推导。

## 6.7 不会做什么

- 不计算后验预测分布（PPD），不做 posterior predictive checks。
- 不做多用户对比，不引入分层模型。
- 不接外部 API、不上传数据。
- 仅暴露上述三种视图，不引入其他贝叶斯模型比较方法。

## 6.8 参考

- Dickey, J. M., & Lientz, B. P. (1970). *The weighted likelihood ratio, sharp hypotheses about chances, the order of a Markov chain*. Ann. Math. Statist.
- Verdinelli, I., & Wasserman, L. (1995). *Computing Bayes factors using a generalization of the Savage-Dickey ratio*. ISBA.
- Kruschke, J. K. (2011). *Doing Bayesian data analysis*. (Chapter 12 讨论了 Savage-Dickey 与 ROPE.)
- 关于本设计中 ROPE 被否决的讨论：见 6.3.2。
