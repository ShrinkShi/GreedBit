# GreedBit Runtime Ownership Audit

版本基线：v0.0.25  
审查日期：2026-11-03

## 目标

GreedBit 历史上采用 v014、v015、v016……逐层覆盖的方式快速迭代。该方式允许后加载脚本覆盖前一版本函数，但如果旧层保留轮询器、MutationObserver 或 DOM 属性拦截器，就会出现多个运行时控制者同时修改同一个界面的情况。

本轮审查的核心规则：**同一块可见 UI 必须只有一个最终控制者。周期任务可以维护市场数据和后台状态，但不得周期性重写标签、选中态、翻译状态等交互 UI。**

## 已确认并清理的冲突

### 1. 交易对标题闪烁

历史上同时存在：

- v016：约 1200ms 一次的 `syncPairLabel()` UI 轮询。
- v017：约 1600ms 一次的 `syncExternalLabel()` UI 轮询。
- v018：约 900ms 一次的 `syncPairHeader()` UI 轮询。
- v019-hotfix：通过重定义 `#pairName.textContent` 强制拦截写入。

这些实现会在 `BTC/USDT`、`BTCUSDT永续合约`、外部市场名称之间互相覆盖，是交易对名称闪烁的直接原因。

v0.0.25 处理：

- `v019-hotfix.js` 从加载链移除并从仓库删除。
- 在历史功能层加载前安装 Legacy Runtime Gate，禁止上述三个 UI 维护 interval 启动。
- v025 成为交易对标题和行情来源副标题的最终所有者。
- v025 只在 `setSymbol`、`showPage`、`renderTradingMode`、`stats` 等真实事件发生后同步 UI，不运行独立轮询器。

### 2. 新闻点击“原文”后立即恢复翻译

历史行为：

- v013-ui 的翻译按钮本身支持“翻译 / 原文”双向切换。
- v021 在 `#newsList` 上额外挂了 MutationObserver。
- Observer 发现按钮状态不是 `translated` 时，会自动调用 `.click()` 再翻译。
- 用户点击“原文”会修改新闻 DOM，恰好触发 Observer，于是刚恢复的原文马上又被自动翻译。

v0.0.25 处理：

- Legacy Runtime Gate 禁止该新闻列表自动翻译 Observer 安装。
- 自动翻译仍保留，但只由“新闻重新渲染”或“语言改变”触发。
- v025 记录用户对每条新闻、每种界面的“保持原文”选择。
- 用户明确选择原文后，自动翻译策略不得覆盖用户选择。

## 允许继续存在的周期任务

以下任务属于数据/业务层，不应因为本轮 UI 清理而删除：

- Binance / Yahoo / 模拟市场行情轮询和 WebSocket 重连。
- 大宗商品、股票代币、外汇的参考行情更新。
- GREED 模拟行情驱动。
- 永续合约资金费率和结算倒计时。
- 网格策略撮合/检查。
- 赚币小时结息。
- 本地状态定期持久化。

原则：这些任务可以更新数据模型；如果要反映到 UI，应调用当前最终渲染函数，不得自行维护第二套标签或选中态。

## 禁止模式

后续代码审查中，以下模式应视为高风险：

1. `setInterval(... element.textContent = ...)`
2. `setInterval(... classList.toggle('active', ...))`
3. MutationObserver 监听某个 UI，再主动修改同一个 UI
4. 通过 `Object.defineProperty(element, 'textContent', ...)` 抢占 DOM 属性
5. 新版本为了修旧版本，再增加一个更高频率轮询器
6. 两个版本文件分别维护同一个 active/tab/pair label 状态

## 唯一控制者表

| UI / 状态 | 最终控制者 | 更新方式 |
| --- | --- | --- |
| 交易对标题 | v025 | 事件驱动 |
| 行情来源副标题 | v025 | 行情/页面事件驱动 |
| 新闻翻译/原文偏好 | v025 + v013 翻译执行器 | 渲染、语言变化、用户点击 |
| 新闻卡片内容 | `renderNews()` 最终包装链 | 渲染事件 |
| 交易对弹窗数据 | v017/v018 最终市场层 | 用户操作 / 市场更新 |
| 顶部/底部/资产 Tab 选中态 | 对应最终页面事件处理 | 用户点击 |
| 滑杆视觉 | v020 + 最终 CSS | input/change 事件 |
| 策略交易 | v024 | 行情/策略事件 |

## Legacy Runtime Gate

`src/v013-fixes.js` 中的 Gate 不是新的视觉覆盖层，它的职责只有一个：在历史功能文件执行前阻止已知的旧 UI 后台控制器启动。

它目前只抑制：

- 包含 `syncPairLabel` 的 interval
- 包含 `syncExternalLabel` 的 interval
- 包含 `syncPairHeader` 的 interval
- 回调包含 `scheduleAutoTranslate` 的新闻列表 MutationObserver

它不会抑制市场行情、策略、结息、持久化等其他 interval/observer。

运行时可在浏览器控制台查看：

```js
GreedBitRuntime.runtimeAudit()
GreedBitLegacyGate.audit
```

正常情况下：

- `pairGuardPresent` 应为 `false`
- `pairOwnTextDescriptor` 应为 `false`
- `sourceOwnTextDescriptor` 应为 `false`
- `suppressedIntervals` 应能看到历史 pair-label poller 被阻止
- `suppressedObservers` 应至少包含被阻止的旧新闻自动翻译 Observer（在新闻增强层正常初始化后）

## 后续重构建议

本轮解决的是运行时冲突，而不是把所有历史功能文件一次性合并成单文件。v014-v024 中仍有大量实际功能依赖，贸然删除会引入更大的回归风险。

下一阶段应按模块逐步收敛：

1. 市场注册与交易对选择器
2. 合约价格 / 资金费率
3. 资产与交易表格
4. 图表扩展
5. 新闻与国际化
6. 策略交易

每收敛一个模块，就删除相应旧版本中的覆盖实现，而不是继续新增新的 `v026-hotfix`。
