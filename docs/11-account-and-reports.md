# raricy 登录、账号保存与 PDF 报告

接入协议：[raricy OAuth 文档](https://github.com/raricycms/raricy.com/blob/main/docs/oauth.md)。服务端 authorization_code / client_secret_basic，只申请 profile；账号以稳定 sub 为键，不以用户名为键。

## 配置

站长在 raricy `/admin/oauth` 登记主页 `https://ling.raricy.com`，回调必须精确填写 **`https://ling.raricy.com/oauth/callback`**。将 `.env.example` 复制到 `.env` 并填写 RARICY_CLIENT_ID / RARICY_CLIENT_SECRET。密钥仅后端加载，不加 VITE_ 前缀，不提交到 Git。生产运行 `npm run build`、`npm start`，HTTPS 反向代理整个站点至 Node 3001，包含 `/api/*` 和 `/oauth/callback`。本地测试另登记 `http://localhost:5173/oauth/callback` 并对应修改 RARICY_REDIRECT_URI，Vite 已代理此路径。

未配置密钥仍可使用游客测验，入口显示“登录尚未配置”。OAuth token 只留后端内存；浏览器使用 HttpOnly / SameSite=Lax Cookie，HTTPS 配置下带 Secure。登录最多一天，重启后重新登录；每次账号请求重新查询 userinfo，授权撤销／封禁立即拒绝账号访问。退出清除 Cookie 并尝试 revoke。随机 state 绑定 Cookie，十分钟有效，单次使用；账号写操作校验配置站点的 Origin。

## 数据边界

- 游客活动实验、token、房间只在内存，不落盘。单人结束响应生成后释放状态。双人仅为另一位参与者暂留终态结果，双方读取后立即释放；未领取结果最多五分钟，清扫间隔一分钟。无操作房间六小时到期。重启不恢复临时实验。
- 登录用户开始／加入时由 Cookie 绑定身份，忽略 body 中身份声明。终态按角色安全快照归档至 `.data/accounts.json`，包含已揭晓结果；双人可分别为两位登录参与者归档。游客无账号记录，登录搭档自己的配对结果可包含匿名搭档的选择结果。
- 游客 DSES 在本机保存；登录模式不读取游客草稿，服务端验证 16 项答案、生成 ID／时间，分数从答案计算。账号问卷可删除、清空、导出 JSON。导入本机文件不会自动上传；实验账号历史仅来自服务端实验，不能提交伪造快照。
- 账号与本机历史分别展示，退出清除账号视图，不自动迁移游客记录。账号磁盘文件不含 OAuth token、实验凭证或未揭晓目标。写入串行、临时文件后原子替换，损坏文件阻止启动，不静默覆盖。
- 旧 `.data/experiments.json` 不再加载或写入，既有文件交由维护者保管，应用不擅自删除。当前架构为单 Node 进程；多实例需要共享临时状态、登录会话和数据库事务，不能并发写同一 JSON。

## API

| 路径 | 作用 |
| --- | --- |
| GET `/api/auth/login` | 授权跳转 |
| GET `/oauth/callback` | 校验 state、兑换 code、查询资料、设置 Cookie |
| GET `/api/auth/session` | 当前账号与配置状态 |
| POST `/api/auth/logout` | 退出与 revoke |
| GET `/api/account/history` | 本人 experiments / dses |
| POST `/api/account/dses` | 提交 answers |
| DELETE `/api/account/dses/:id` | 删除本人问卷 |
| DELETE `/api/account/dses` | 清空本人问卷 |
| DELETE `/api/account/experiments` | 清空本人实验历史 |
| GET `/api/account/report.pdf?lang=zh` | 中文 PDF；en 为英文 |

账号／报告接口要求有效登录，响应 no-store，无法通过参数选择他人账号。创建／加入实验支持游客。

## 报告

矢量雷达图、本人配对关系网、按真实时间间隔的趋势折线、分组数据与阅读说明。中文字体来自 [Noto 官方常规字体](https://github.com/notofonts/noto-cjk/tree/main/Sans/SubsetOTF/SC)，PDF 嵌入字体子集，许可证在 public/fonts/OFL.txt。按用户当前界面语言导出。

新版包含个人封面、探索画像、综合评价、逐维表现分类、近期变化、搭档评价和下一步建议。采用青色／深蓝／金色配色，文本块测量高度后自动分页，图表与文字分区，长姓名截断展示但不丢弃记录。

正文以完整的个人解读为主，数字保留在图表与末尾依据中；不同类型、表现层次、上升／平稳／回落以及搭档并列都有独立文案，综合解读还区分多项上升、不同步变化和整体平稳。文案由 Claude Code 协助起草后审校，不使用不存在的常模比较、不虚构个人经历或变化原因。相关限制集中于报告末尾的一段阅读说明，正文不重复提醒。

报告叙述改为 Neko 的轻松口吻。使用 [humanize-ai-writing](https://github.com/haidrrrry/humanize-ai-writing) 先润色英文，再译为中文；中文每段以 40–60 字为目标，硬范围 30–70 字，按非空白 Unicode 字符计数，包含标点。标题、数据行与姓名栏单独展示；姓名保留完整元数据，正文中的称呼限制长度。多段叙述在网页与 PDF 中均保留段间距。

主页与 PDF 封面共用 `public/images/neko.png`，已去除绿色背景并保留透明通道，Neko 与小猫完整显示。图文分栏和移动端纵排由页面处理，图片不遮挡选择按钮或报告文字。

探索类型依次判定：多维探索型（三个实验当前组各至少 20 回合＋完整 DSES）、初步探索型（总回合 <20 且完整 DSES <3）、双人协作型（双人 ≥20 且占总回合至少 50%）、体验记录型（完整 DSES ≥3 且总回合 <60）、单项深耕型（某任务 ≥20 且占至少 70%）、渐进探索型。这些是产品的描述性规则，不是灵性能力等级或常模。

趋势至少 3 份同组记录，比最早与最近各 min(3, floor(记录数/2)) 份；实验每窗至少 10 回合并按回合加权，DSES 使用完整问卷。变化超过 5 个展示百分点才描述上升／回落。评语明确写出观察指标，比如“近期日常灵性体验更频繁”。搭档排名只比较当前双人协议＋符号组下至少 10 回合的登录搭档，支持并列和各自分母；匿名游客不排名。

- 实验轴是已揭晓有效回合的命中率／一致率（0–100）。每轴选择最近有数据的协议＋符号组，汇总该组，其他组分别展示趋势和明细。
- DSES 雷达使用最近完整 16 项问卷，按 `(mean - 1) / 5 * 100` 展示；部分作答保留但不入图。中文网页翻译未经量表效度验证。
- 不计算总分、等级、百分位或超自然能力概率。缺失显示暂无数据、不补零；缺失时不绘制闭合雷达面积。
- 单人均匀五选一机会基线 20%；自由选择的双人记录只描述一致率，不使用固定机会基线。
- 网络仅有本人参与的边；重复登录搭档按账号汇总，匿名游客每场独立。线宽表示回合数，标注一致率和 n，不推断搭档之间的连接。
- 趋势按协议／符号组分开；每点一场实验／完整问卷，真实时间间隔，同日可能重叠。大量配对／趋势自动分页，不丢弃记录。

## 必要验证

`npm run test:server` 包含模拟 OAuth、账号隔离、CSRF、游客不落盘、结束清理、匿名搭档、重启读取、DSES、撤销／退出和 PDF 下载。原协议持久化测试显式使用测试工厂 retainAllSessions，生产启动不提供该配置。

前端 account-ui / report-model 及相邻流程回归，PDF 中文／英文／空数据／大量搭档渲染检查。示例报告使用合成数据。真实登录仍需站长登记并配置凭证后验证，模拟授权不代表真实服务验收。
