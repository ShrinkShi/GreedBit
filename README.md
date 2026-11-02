# GreedBit

GreedBit 是一个**纯前端**的虚拟货币交易模拟器，目标部署平台为 **Bilibili Toy**。BTC/USDT 与 ETH/USDT 使用公开市场行情；账户、资金、订单、杠杆、强平、资产划转、通知、头像和用户设置均为浏览器端模拟数据。

当前版本：**v0.0.11**

## 项目定位

GreedBit 长期保持纯前端架构：

- 不建设自有 Node.js / Java / Python 后端。
- 不建设 SQLite / MySQL / PostgreSQL 等自有数据库。
- 不保存真实资金、真实交易账户或真实交易所 API Key。
- 公开行情只调用无需密钥的公共接口。
- 用户数据默认保存在浏览器 `localStorage`。
- 如后续需要跨设备存档，只考虑 Bilibili Toy 官方云存储等平台原生能力，不引入自建后端。

这意味着 GreedBit 的“用户账号”是模拟器内部的本地账号，不是安全认证系统；清除浏览器站点数据或更换浏览器/设备可能导致本地存档丢失。

## Bilibili Toy

GreedBit 当前按 Toy 静态页面要求设计：

- 单入口 `index.html`。
- CSS、JavaScript、图片均使用相对路径，不依赖站点根路径。
- 不使用 history 路由；页面切换全部在同一个 `index.html` 内完成。
- `index.html` 体积远低于 Toy 1 MB 硬上限。
- 提供 `tools/build-toy.ps1`，只打包运行时必需的 `index.html`、`src/`、`styles/`、`assets/`，避免把 `.git`、README 等无关文件上传。

详细验收记录见 `TOY_COMPATIBILITY.md`。

Toy 真实预览仍必须验证外部网络请求是否可用，重点包括 Binance REST / WebSocket、Binance Futures、汇率接口以及 CoinDesk RSS / 跨域代理。

## 真实 BTC / ETH 市场行情

当前仅保留：

- BTC/USDT
- ETH/USDT

行情来源：

- Binance Spot REST API：历史 K 线、24H 统计、盘口深度。
- Binance Spot WebSocket：实时成交、ticker、深度流。
- Binance USDⓈ-M Futures 公共接口：合约数据与实时成交。

历史 K 线直接读取真实 OHLCV；当前 K 线由实时成交继续更新。10 分钟周期由真实 5 分钟 K 线聚合。

如果 Binance 在当前网络、地区或 Toy 容器中不可访问，GreedBit 会显示行情连接失败，并停止依赖价格的下单，不会回退到随机假行情。

## 交易功能

### 现货

- 市价 / 限价买入和卖出。
- 不支持做空。
- 独立现货账户。
- 现货限价委托显示在 K 线图。
- 成交音效与 K 线 B / S 标记。

### 合约

- 开多 / 开空。
- 全仓 / 逐仓。
- 1X–200X 杠杆。
- 限价委托。
- 止盈 / 止损。
- 强制平仓。
- 模拟资金费率。
- 历史仓位与财务流水。
- 计划、跟踪、TWAP 等高级委托模拟。

> 合约只是游戏规则模拟。市场价格虽然来自真实公开行情，但强平、手续费、资金费率和风险参数不代表任何真实交易所。

## 图表

- 分时、1m、3m、5m、10m、15m、30m、1h、2h、4h、8h、1d、3d、1w、1M。
- 鼠标拖动历史、横轴/纵轴缩放、双击复位。
- MA5 / MA10 / MA30 / MA60。
- 成交量独立窗格或叠加主图。
- 成交量窗格高度可拖动。
- 高低点、倒计时、成交标记、十字光标、图表设置。
- 实时价格自适应心跳动画：价格变化越剧烈，字体缩放和光晕越强。

## 本地账号与存档

- 注册、登录、模拟资金、订单、持仓、交易记录均保存在 `localStorage`。
- 默认头像：`assets/default avatar.png`。
- 用户可上传 PNG / JPEG / WebP 头像；浏览器端裁剪、压缩后保存在本地。
- 站内通知也是同一浏览器内的本地通知，不具备跨设备消息能力。
- 内置 `admin / 123456` 仅用于演示本地管理界面，密码公开可见，不构成任何安全边界。

由于项目确定为纯前端，**不会把本地管理员、通知或账号迁移到自建后端**。公开 Toy 版本中这些能力应始终被理解为模拟功能。

## 资讯

行情页尝试读取 CoinDesk RSS，并通过浏览器跨域代理回退方案加载真实资讯。

- 标题、摘要、时间和来源来自真实 RSS。
- 可打开原始新闻页面。
- 本地分类 BTC / ETH / 监管 / 机构 / 市场 / 技术等。
- 利好 / 利空“社区倾向”仅是本地模拟，不冒充真实多人投票。

需要私钥、签名密钥或服务端代理的资讯 API（例如需要 AccessKeyId / Secret 的接口）**不纳入纯前端版本计划**，不会把密钥写入公开源码。

## 本地运行

推荐使用本地 HTTP Server：

```bash
python -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

页面需要联网访问公开行情、WebSocket、汇率和资讯接口。

## Toy 打包

Windows PowerShell：

```powershell
.\tools\build-toy.ps1
```

脚本会生成：

```text
dist-toy/
GreedBit-toy.zip
```

上传 Toy 时优先使用 `GreedBit-toy.zip`，不要直接把整个 Git 仓库打包上传。

## 项目结构

```text
GreedBit/
├─ index.html
├─ assets/
│  ├─ greedbit-logo.png
│  └─ default avatar.png
├─ styles/
│  ├─ base.css
│  ├─ market.css
│  ├─ trading.css
│  ├─ assets.css
│  ├─ overlays.css
│  ├─ v009.css
│  ├─ v010.css
│  └─ v011.css
├─ src/
│  ├─ core.js
│  ├─ market.js
│  ├─ futures.js
│  ├─ spot.js
│  ├─ account.js
│  ├─ ui.js
│  ├─ events.js
│  ├─ v009.js
│  ├─ v010.js
│  ├─ v011-preload.js
│  └─ v011.js
├─ tools/
│  └─ build-toy.ps1
├─ TOY_COMPATIBILITY.md
├─ README.md
├─ CHANGELOG.md
└─ VERSION
```

## 当前数据边界

真实公开数据：

- BTC / ETH 历史 OHLCV。
- BTC / ETH 实时成交价。
- 24H 高低、涨跌幅、成交额。
- 当前盘口深度。
- Binance Futures 公共统计数据。
- 可成功加载时的 CoinDesk 资讯与公开汇率。

本地模拟数据：

- 用户账号与管理员。
- 用户头像。
- 资金与资产。
- 订单与成交结果。
- 杠杆、强平、资金费率规则。
- 新闻利好 / 利空倾向。
- 通知、账户统计与界面设置。

## 下一阶段

- 完成 Bilibili Toy 真实预览验收。
- 验证桌面浏览器与 Bilibili App 内的 Binance REST / WebSocket 可用性。
- 修复 Toy 环境下发现的跨域、CSP、触控和布局问题。
- 完善移动端交互与小屏布局。
- 增加本地存档导入 / 导出，降低 `localStorage` 被清理后的损失。
- 评估是否使用 Toy 官方云存储保存少量低频关键存档；不建设自有后端。
- 继续完善交易模拟、图表、策略与视觉体验。

## 免责声明

GreedBit 仅用于游戏、教学与编程实验，不提供真实交易、不使用真实资金，也不构成投资建议。
