# GreedBit Runtime Ownership Audit

版本基线：v0.0.26  
审查日期：2026-11-03

## 当前结论

v0.0.26 已移除历史 `v009.js ~ v025.js` 版本补丁**文件**，运行时由唯一的 `src/bootstrap.js` 按顺序加载 21 个职责模块；版本历史只由 Git 保存。

但必须明确：**函数级覆盖机制仍然存在**。基础模块先声明全局函数，后续模块在严格模式 IIFE 中用赋值重新实现（`renderBook=function(){…}`），最终生效者由加载顺序决定。`tools/runtime-ownership.mjs` 当前统计到 **50 个被覆盖的全局函数、28 条多点覆盖链**。

这与「旧版本代码同时运行」不是同一个问题，但维护成本很高：

- 阅读时必须按加载顺序追踪，源码位置不等于执行位置；
- 删除被覆盖函数的声明，会让后续严格模式赋值直接抛 `ReferenceError`（本轮修复中真实发生过）；
- 同一函数的多份实现容易分叉（手续费、取价、风控口径都踩过）。

CI 现在执行该脚本：输出覆盖链，并在「赋值了但从未声明」时报错。


## v0.1.1 仓位系统所有权（2026-11-04）

- `src/domain/position-book.js`：纯函数仓位模型（合并、旧存档规范化、全仓杠杆一致性、部分平仓数量、价格到纵坐标变换）。可独立进行 Node 单测。
- `src/market/model.js`：唯一持仓/余额实际变更入口（`executeOpen`、`closePosition`），合并不是只在表格层进行；部分平仓原始费用份额会递减。
- `src/futures.js`：只减仓限价平仓委托的触发、杠杆冲突的待成交开仓单撤销；按仓位实际符号执行。
- `src/trading/positions-ui.js`：持仓表格和市价/限价平仓交互的唯一控制者，不直接计算结算损益或修改持仓对象。
- `src/trading/records.js`：当前/历史委托、成交记录持有统一状态视图；持仓表格委托给 positions-ui。
- `src/chart/renderer.js`：唯一 Canvas 绘制者，仓位线和网格刻度使用相同价格到像素映射；`src/ui/trading-experience.js` 不再额外包裹 draw 绘制仓位线。
- `src/core.js`：本地 `closeOrders` 状态存储和旧仓位数据规范化。
- `src/app/events.js`：单一点击事件入口，负责转发持仓相关操作到 positions-ui。

**旧数据策略**：只合并相同合约、同方向的全仓仓位；逐仓和相反方向保持独立。旧仓位数量异常时保留原始记录，避免一个坏数据导致账户重置。历史多空全仓杠杆冲突时拒绝新全仓订单，不会悄悄重写已有仓位的风险参数。

**已知限制**：`localStorage` 依然不提供跨设备或真正原子事务；行情依赖浏览器和公开接口，关页时不执行离线委托。UI 的实际网络/尺寸验收需要在 GitHub Pages 浏览器中完成。

## v0.1.2 图表仓位可见性与刷新契约（2026-11-04）

- 主图仓位线仍由 `src/chart/renderer.js` 的同一 Canvas 绘制 pass 完成。仓位筛选属于 `src/domain/position-book.js` 中可测试的纯函数 `visibleChartPositions`，不通过 DOM 表格反推状态。
- `src/core.js` 的账户状态恢复会发出 `greedbit:positions-changed` 事件，开平仓及退出登录也发出该事件；图表模块在 `greedbit:ready` 之后执行一次合并重绘。启动器未 ready 时不提前重画。
- 同一帧重复触发的重画请求由 `requestAnimationFrame` 合并，**不增加轮询，也不创建第二个画布**。
- 图表仓位显示由 `tradingMode === 'futures'` 决定，并支持共用交易页的 `trade/futures` 路由；未登录不显示前一个账户的仓位线。
- 持仓行交易对跳转由 `src/trading/positions-ui.js` 通过既有 `showPage` 和 `setSymbol` 完成，不绕过全局切换与行情请求令牌。
- 新增 `tests/position-overlay.test.cjs`：真实主渲染器在隔离 Canvas 模拟环境中执行，检查仓位恢复后的事件重绘与价格到像素的映射。

## 当前运行时结构

- `src/app/`：启动事件、兼容桥、共享 UI 最终所有权。
- `src/chart/`：K 线主绘制。
- `src/market/`：市场模型、加密资产、大宗商品、外汇、股票代币、预加载。
- `src/news/`：公开 RSS 与新闻加载。
- `src/performance/`：Worker、节流、虚拟表格、表单与性能辅助。
- `src/strategy/`：网格策略与策略统计。
- `src/trading/`：高级委托、永续合约、资金费率、订单/历史记录。
- `src/ui/`：首页、偏好、终端视觉、交易体验、概况/数据页。
- `src/bootstrap.js`：唯一功能模块装载入口。

仍保留的基础文件 `core.js / market.js / futures.js / spot.js / account.js / ui.js` 是早期正式基础模块，不属于版本补丁文件；后续可继续按职责拆分，但它们不会形成版本叠加链。

## 已物理移除的高风险模式

### 版本脚本加载链

旧运行时曾通过 `events.js -> v009 -> v010 -> ... -> v025` 逐层加载和覆盖函数。v0.0.26 已取消该结构；`index.html` 只加载基础模块与 `bootstrap.js`。

### 共享 UI 后台轮询

以下旧控制器已从功能模块源码中删除：

- `syncPairLabel`
- `syncExternalLabel`
- `syncPairHeader`

交易对标题和行情来源副标题由 `src/app/runtime.js` 事件驱动更新，不允许使用轮询器抢写 UI。

### Legacy Runtime Gate

旧 `v013-fixes.js` 曾通过全局 `setInterval` / `MutationObserver` 拦截器压制历史控制器。v0.0.26 不再使用这种全局 Gate；兼容逻辑集中于 `src/app/compatibility.js`，且只处理数据结构和旧基础模块接口。

### Canvas 双价格坐标系

旧 v021 曾在主图完成后使用另一套数据和 padding 再画价格轴，造成永续 K 线与右侧坐标拖动速度不同。该二次价格轴已删除。当前图表主绘制由 `src/chart/renderer.js` 完成，K 线、最高/最低价、当前价和价格轴共享同一价格映射；永续合约模块只能在进入主绘制前准备合约价格上下文。

## 唯一控制者原则

| 状态 / UI | 当前控制者 | 更新方式 |
| --- | --- | --- |
| 应用模块加载顺序 | `src/bootstrap.js` | 单次串行启动 |
| 交易对标题 / 行情副标题 | `src/app/runtime.js` | 事件驱动 |
| 新闻自动翻译 / 原文偏好 | `src/app/runtime.js` + `src/news/feeds.js` | 渲染、语言变化、用户操作 |
| K 线 Canvas 主绘制 | `src/chart/renderer.js` | 单次完整绘制 |
| 永续独立价格 / 基差 / 资金费率 | `src/trading/contracts.js` | 数据更新，不轮询写共享 UI |
| 扩展加密 / 大宗商品 | `src/market/extended.js` | 市场数据事件 |
| 股票代币 / 外汇 | `src/market/external.js` | 市场数据事件 |
| 委托与历史表格 | `src/trading/records.js` | 交易/页面事件 |
| 网格策略 | `src/strategy/grid.js` | 策略与行情事件 |

## 已知函数覆盖链

`node tools/runtime-ownership.mjs` 会输出完整清单（按加载顺序）。下表只列最长的链，**最后一项为当前生效实现**：

| 函数 | 覆盖点 | 加载顺序 |
| --- | ---: | --- |
| `setSymbol` | 8 | advanced-orders → model → compatibility → performance → extended → external → contracts → ui/runtime |
| `connectMarketSocket` | 5 | preload → model → performance → extended → external |
| `renderBook` | 5 | preload → model → extended → external → contracts |
| `showPage` | 5 | advanced-orders → home → shell → performance → contracts |
| `syncAuth` | 5 | preload → advanced-orders → preferences → home → grid |
| `updateMarketSnapshots` | 5 | preload → home → model → extended → external |
| `loadHistoricalMarket` | 4 | preload → model → extended → external |
| `placeOrder` | 4 | model → contracts → records → ui/runtime |
| `renderAssetPage` | 4 | shell → contracts → records → grid |
| `closePosition` | 3 | model → contracts → records |

**修改规则**：

1. 先跑脚本确认目标函数的最后一个赋值点，改那里才有运行时效果。
2. 新增覆盖必须先有全局声明；禁止只写 `foo=function(){}`。
3. 被取代的旧实现不要直接删除，改为抛错 stub 并注明真实实现位置（`futures.js` / `spot.js` 已是此模式）。
4. 最终目标是逐步消除覆盖链，把状态机收敛到单一模块。

## 允许的周期任务

周期任务只能维护数据或业务状态，例如：

- WebSocket 重连和市场行情刷新。
- 大宗商品、股票、外汇参考行情轮询。
- GREED 模拟行情。
- 永续基差、资金费率和结算倒计时。
- 网格策略检查。
- 赚币结息。
- 本地状态持久化。

周期任务不得直接维护交易对标题、Tab 选中态、新闻“原文/翻译”选择或第二套 Canvas 坐标轴。

## CI 架构门禁

`.github/workflows/js-syntax.yml` 现在递归执行 `node --check` 检查全部 `src/**/*.js`，并额外拒绝：

1. 根 `src/` 下重新出现 `vNNN*.js`。
2. 运行时代码重新引用 `src/vNNN*.js`。
3. `syncPairLabel / syncExternalLabel / syncPairHeader` 等已退休共享 UI 轮询器回归。
4. `node tools/runtime-ownership.mjs`：每个被覆盖的全局函数都必须存在声明，并输出覆盖链清单。

Toy 构建脚本也会拒绝根 `src/v*.js` 回归。

## 仍存在但不会形成多控制者的迁移债

- 部分 CSS 文件仍沿用 `styles/v0xx.css` 历史名称。它们是静态样式资产，不执行 JavaScript、不拥有业务状态；后续应按 `chart.css / contracts.css / terminal-theme.css` 等职责名称继续整理。
- 为避免一次重构同时重写超大模块导致功能回归，bootstrap 目前集中提供少量版本式 API 兼容别名给尚未改名的内部消费者。它们只是同一对象的别名，不加载旧代码、不启动定时器。后续应逐个替换后移除。
- `core.js / market.js / futures.js / spot.js / account.js / ui.js` 仍是根级基础模块，可在后续模块化中继续拆分。

这些属于命名/目录迁移债，和旧版本代码同时执行不是同一个问题。

## 后续硬规则

1. 不创建新的 `v026.js`、`v027-fix.js` 等版本脚本。
2. 新功能必须修改其所属功能模块。
3. 同一可见 UI / 状态只能有一个最终所有者。
4. 不允许通过更高频率定时器“压住”旧逻辑。
5. 不允许在主 Canvas 绘制结束后使用另一套价格数据或几何参数补画同一坐标轴。
6. 历史版本只通过 Git commit / tag 保留。
7. 不得删除仍被其他模块赋值的函数声明；需要退休时改为抛错 stub。
8. 新增全局函数必须先声明（`function foo(){}`）再被赋值。
9. 修改共享函数前先跑 `node tools/runtime-ownership.mjs` 确认最终生效点。
