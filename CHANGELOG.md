# Changelog

## Unreleased

- 将 GreedBit 项目路线正式定性为纯前端，不再规划自建后端、数据库或服务端鉴权。
- 完成首轮 Bilibili Toy 静态兼容性审查：入口体积、相对资源路径、单页路由、本地存储架构均可进入 Toy 预览阶段。
- 新增 `TOY_COMPATIBILITY.md`，记录 Toy 验收结论、风险与真实预览检查清单。
- 新增 `tools/build-toy.ps1`，生成仅包含运行时文件的 `dist-toy/` 与 `GreedBit-toy.zip`，并检查入口 1MB 上限与根绝对资源路径。
- Toy 正式发布前仍需在真实 preview 中验证 Binance REST/WebSocket、Futures、汇率及新闻 RSS 跨域链路。

## [0.0.12] - 2026-11-02

- 重构主页为现代化交易平台 Landing Page：大标题、实时行情卡片、模拟账户摘要与更专业的深色视觉层级。
- 主页右侧支持 `assets/mammon-home.mp4` 动态恶魔立绘，自动播放、静音、循环；资源缺失时自动回退到 GreedBit 品牌图。
- 行情页保持纯新闻流定位，不增加 BTC/ETH 行情总览。
- CoinDesk 官方 RSS 继续作为主要加密资讯源。
- 新增 CNBC Investing 与 CNBC Top News 财经 RSS 备用源。
- 新闻读取采用多通道策略：源站直连、cors.dev、AllOrigins、rss2json，优先并发尝试可用路径。
- 新闻成功加载后缓存最近 80 条到 localStorage；外部源临时失败时优先显示最近一次成功缓存，不再出现空白行情页。
- 新闻自动刷新节流到 5 分钟，手动刷新不受限制。

## [0.0.11] - 2026-11-02

- Added GreedBit logo favicon and navigation brand icon.
- Added tick-direction green/red flash animation and breathing live-status dot.
- Reduced market startup latency with WebSocket-first connection, raced Binance public REST endpoints, cached fastest endpoints, 500-bar initial history and 100ms depth WebSocket.
- Added language / quote-currency menu and converted-price display.
- Added persistent local notification inbox, unread badge, admin notification composer and profile/avatar dropdown.
- Added configurable MA5/10/30/60 indicators and configurable volume pane/overlay.
- Added draggable divider between K-line and separate volume pane.

## [0.0.10] - 2026-11-02

- 新增合约概况页与 BTC/ETH 项目资料。
- 新增真实 Binance Futures 数据面板：持仓量、资金流向、多空比、资金费率、溢价指数等。
- 新增盘口 / 实时成交切换和 Futures aggTrade 实时成交流。
- 新增策略交易入口：现货网格、合约网格、合约马丁格尔配置。
- 新增计划、跟踪、分时（TWAP）高级委托，并接入本地委托状态和撤单。
- 继续保持真实行情 / 模拟交易边界：所有订单只发生在 GreedBit 本地模拟账户。

## [0.0.9] - 2026-11-02

### Added

- 内置本地管理员账号 `admin / 123456`，管理员登录后显示“管理”页面。
- 图表成交记录 B / S 标记。
- 图表右键菜单：重置、复制价格、锁定十字线、显示/隐藏成交标记、进入设置。
- 图标式“图表设置”按钮和四类设置页：商品代码、状态行、比例和线条、版面。
- CoinDesk 官方 RSS 真实币圈资讯加载与原文链接。
- 图表设置持久化到 localStorage。

### Changed

- 价格轴滚轮只缩放纵轴。
- 时间轴滚轮只缩放横轴。
- 主图区滚轮同时缩放横纵轴。
- 行情页删除本地随机新闻生成器，改为真实 RSS 资讯。
- 新闻利好 / 利空投票保留；无多人后端前，“社区倾向”明确标记为本地模拟。

### Notes

- AiCoin 官方快讯 API 需要 AccessKeyId 和签名密钥，因此纯前端版本暂不硬编码接入。
- `admin / 123456` 仅用于本地开发测试，不具备真实安全性。
- 旧版本成交记录没有时间戳时不会在历史 K 线上补画 B / S 标记；v0.0.9 之后的新成交会记录时间戳。

## [0.0.8] - 2026-11-02

### Added

- 接入 Binance Spot REST API 读取 BTC / ETH 真实历史 K 线。
- 接入 Binance Spot WebSocket 实时成交与 24H ticker。
- 盘口改为真实公开深度数据。
- 横坐标加入日期，并在深度放大时显示秒。
- 向左拖动接近历史边界时自动加载更早的真实 K 线。
- 行情连接状态显示在底部状态栏。

### Changed

- 币种仅保留 BTC/USDT 与 ETH/USDT。
- 删除本地随机市场价格生成器。
- 10 分钟 K 线改由真实 5 分钟 K 线聚合。
- 横纵轴缩放取消原先固定 UI 上下限，改为连续指数缩放。
- 图表纵轴最低值固定为 0，不再显示负价格。
- 新闻系统不再改变市场价格，避免污染真实行情。
- 首页和行情状态文字改为“真实市场数据 + 模拟交易”。
- 真实行情未连接时禁止依赖价格的现货 / 合约下单。

### Notes

- 用户账户、资产、订单、杠杆、强平和资金费率仍然是本地模拟。
- “其他用户”的新闻利好 / 利空评价仍然是本地随机数据。
- Binance 若因网络或地区限制不可访问，本版本不会回退到随机假行情。
