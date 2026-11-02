# GreedBit

GreedBit 是一个本地运行的虚拟货币交易模拟器。交易账户、订单、杠杆、资产划转和盈亏结算仍然是模拟系统，但 **BTC/USDT 与 ETH/USDT 的市场行情已接入真实公开数据*.。

当前版本：

## 动功

- GLS/HTTP i��模拟金行情缓存与 WebSocket 代理
- 行情连接為街限价、现货和合约的模拟下单。

- 本地资金费率 / 新闻利好 / 利空“社区倾向”基线
- 账户统计
- 新增合约遉更化资料初登能够的一个竹一参数缦工作
- 新增行情之间的参数估值与图表体验。

> 为保证数据真实性，本软件中的新闻事件不再会直接改变 SPT/ETH 的真实市场价格。

## 交易加工成

- 一键进入电子货币交易模拟：不下载客户开户账户、不开户账户、不杠杆交易。
- 资金费数据已保持为模拟数据。
- 没有强制开户、杠杆或第三方交易所写入。

## 本地运行

推荐使用本地 HTTP Server：

```bash
python -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

页面需要联网访问 Binance 行情接口、WebSocket、CoinDesk RSS 以及 RSS 跨域代理。

## 项目结构

```text
GreedBit/
├─ index.html
├─ styles/
│  ├─ base.css
│  ├─ market.css
│  ├─ trading.css
│  ├─ assets.css
│  ├─ overlays.css
│  └─ v009.css
├─ src/
│  ├─ core.js
│  ├─ market.js
│  ├─ futures.js
│  ├─ spot.js
│  ├─ account.js
│  ├─ ui.js
│  ├─ events.js
│  ├─ v009.js
├─ README.md
├─ CHANGELOG.md
└─ VERSION
```

## 当前数据边界

真实：

- BTC / ETH 历史 OHLCV
- BTC / ETH 实时成交价
- 24H 高低、涨跌幅、成交额
- 当前盘口深度
- CoinDesk 加密货币新闻内容

模拟：

- 用户账户和管理员认证
- 资金
- 订单撮合结果
- 杠杆与强平规则
- 资金费率
- 新闻利好 / 利空“社区倾向”基线
- 账户统计

## 下一阶段

- 本地 Node.js Server Alpha
- 服务端账户 / 管理员鉴权
- 服务端行情缓存与 WebSocket 代理
- AiCoin 等带签名资讯 API 安全接入
- SQLite / PostgreSQL 持久化
- 多玩家真实新闻投票
- Bilibili Toy 前端接入

## 免责声明

GreedBit 仅用于游戏、教学与编程实验，不提供真实交易、不使用真实资金，也不构成投资建议。


## v0.0.10 新增

- 合约「概况」页：BTC/ETH 项目资料、估算市值、供应量、资源链接。
- 合约「数据」页：接入 Binance USDⓈ-M Futures 公共数据，展示持仓量、主动买卖量、大户账户/持仓多空比、全市场多空比、资金费率与溢价指数。
- 盘口 / 实时成交切换：实时成交流使用 Binance Futures `aggTrade`。
- 策略交易入口：现货网格、合约网格、合约马丁格尔的本地模拟配置。
- 高级委托：计划、跟踪、分时（TWAP）本地模拟委托，可在当前委托中撤销。
- 高级委托与策略仍属于模拟交易逻辑，不会向真实交易所发送订单。
