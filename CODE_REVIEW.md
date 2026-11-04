# GreedBit 代码审查报告

- 审查对象：`E:\时锐\GreedBit\GreedBit`（v0.0.26，对应 GitHub `ShrinkShi/GreedBit`）
- 审查日期：2026-11-03
- 审查方式：全量静态阅读（30 个 JS 文件、约 3,500 行、22 个 CSS 文件、335 个资源文件）+ 交叉追踪调用链。**未能运行项目**：本机 DSH 沙箱在 `E:\时锐\GreedBit\GreedBit` 上写入 Windows 文件权限失败，PowerShell 无法启动，因此没有执行 `node --check`、没有跑浏览器（见附录 A）。
- 结论口径：只列可定位到行、可推理出触发条件的问题；推测项会明确标注「需运行验证」。

---

## 一、项目画像

| 维度 | 现状 |
| --- | --- |
| 形态 | 纯前端单页，零构建工具、零依赖、无 npm、无框架、无测试 |
| 加载方式 | `index.html` 同步加载 6 个基础脚本，再由 `src/bootstrap.js` 串行动态加载 21 个功能模块 |
| 模块扩展方式 | 全局脚本 + 「后加载模块覆盖先加载模块同名函数」（monkey patch） |
| 数据源 | Binance Spot REST/WS、Binance Futures REST、Yahoo Finance（经公共 CORS 代理）、Huobi、CoinDesk/CNBC RSS、MyMemory 翻译、Frankfurter 汇率 |
| 状态 | 全部 `localStorage`，按用户名分 key 保存钱包/仓位/订单/流水 |
| CI | 仅 `node --check` + 若干 grep 架构门禁；无单测、无 lint、无类型检查 |

**一句话评价**：产品完成度和 UI 打磨明显高于一般个人项目，行情/模拟/资讯的分层叙事也做得诚实；但**运行时是一套靠加载顺序维持的「函数覆盖链」**，交易核心同时存在 2–3 份实现，风控只覆盖当前交易对，且没有任何自动化测试兜住资金计算。更要紧的是：**存在两条可以无限复制造钱的路径**（高级委托撤单重复退款、用当前品种价格结算别的品种仓位），以及一个「模块静默不初始化」的启动缺陷。当前状态**适合作为 Toy 演示，不适合继续叠加功能**——每加一个功能都在加深耦合。

---

## 二、问题分布

| 级别 | 数量 | 说明 |
| --- | --- | --- |
| P0 阻断级 | 7 | 可造钱、错价成交、仓位失控、账实不符、整块功能静默失效 |
| P1 严重 | 13 | 资金结算口径、行情冻结、请求风暴、崩溃恢复、认证面、架构性风险 |
| P2 中等 | 23 | 性能、可维护性、可访问性、文档一致性 |

---

## 二之二、修复进展（2026-11-03 本轮已落地）

| 条目 | 修复内容 | 文件 |
| --- | --- | --- |
| P0-6 | 高级委托撤单统一到内存单一真相源，删掉 `records.js` 的 localStorage 撤单路径与引擎的重复表格渲染 | `advanced-orders.js`、`records.js` |
| P0-7 | `closePosition` 按 `p.symbol` 取价（永续用合约价、其余用标记价）；减仓不再传全局 `price`；高级委托开仓改用合约价 | `contracts.js`、`events.js`、`advanced-orders.js` |
| P1-13 | `fireAdvanced` 返回值决定 `done`；预留改用 Taker 费率；`fromReserved` 按流动性选费率 | `advanced-orders.js`、`model.js` |
| P0-2 | `checkRisk` 遍历全部仓位，按各品种标记价判断止盈/止损/强平 | `futures.js` |
| P0-4 | `finalize()` 内发布 `GreedBitRuntimeUI`；`app/runtime` 兼容 `GreedBitV21` 并加等待上限 | `ui/runtime.js`、`app/runtime.js` |
| P1-5 | 统一 `safeParse`；`loadState` 失败时重置全部业务数组；`nextId` 校验 | `core.js` |
| P1-11 | Worker `onerror`/`onmessageerror`/握手超时降级 + `?gb=` 版本参数 | `performance/runtime.js`、`market-worker.js` |
| P1-4 | 行情加载失败清空 `candles/price`，不再残留上一品种 | `preload.js`、`extended.js`、`external.js` |
| P0-5 | `setSymbol` 递增 `marketLoadSeq`；三个加载分支加 `token + symbol` 校验 | `model.js`、`preload.js`、`external.js`、`extended.js` |
| P1-9 | 删除 `stock-manifest-preload.js`（全局 fetch 劫持），直接读取本地 manifest | `external.js`、`bootstrap.js`、`build-toy.ps1` |
| 额外 | `contracts.js` 同步导出 `GreedBitContracts`，修复暖缓存下冷启动竞态（本轮测试暴露） | `contracts.js` |
| P2-11/19/29 | 允许缩放、`&quot;` 补分号、100% 档位按可用余额反算手续费 | `index.html`、`ui/runtime.js`、`app/events.js` |
| P0-1 | 保留全局绑定（严格模式下覆盖赋值必须有声明），把被覆盖的旧实现换成「调用即抛错」的 stub，并注明真实实现位置 | `futures.js`、`spot.js` |
| P1-6 | 行情 tick 只重绘价格；资产/表格降到 450ms；选币器关闭时不重建列表；装饰器不再逐帧全量扫描 | `market.js`、`performance/runtime.js`、`external.js`、`contracts.js` |
| P1-12 | 外部行情失败负缓存 30s、IntersectionObserver 单例、响应体读取纳入超时 | `external.js`、`extended.js` |
| P0-3 | 平仓、资金费不再用 `Math.max(0,…)` 截断；亏损超过余额时余额可以为负 | `model.js`、`contracts.js` |
| P1-14 | 合约 `realized` 改为「毛盈亏 − 开仓费分摊 − 平仓费」的净值；`netRealized()` 不再二次扣手续费 | `model.js`、`account.js` |
| P1-10 | 新增 `src/domain/trading.js` 纯函数层（强平价/平仓结算/资金费/PnL），16 个 `node:test` 用例，CI 增加 `node --test` | `src/domain/trading.js`、`tests/domain.test.cjs`、`index.html`、`js-syntax.yml` |
| P1-16 | 全仓强平价改为按账户权益一次性求解（不再给每个仓位重复加可用余额）；杠杆上限 200X→100X；强平按触发时的标记价成交 | `domain/trading.js`、`market.js`、`futures.js`、`ui.js`、`index.html`、`grid.js` |
| P1-15 | 多标签页单一写入：每次保存递增修订号，落后标签页拒绝写入并重载；`storage` 事件同步；去掉空闲 tick 与 60s 无条件保存；资金费定时器加启动就绪判断 | `core.js`、`events.js`、`advanced-orders.js`、`compatibility.js` |
| P1-7 | 密码改为加盐 SHA-256 哈希（800 轮，旧明文记录登录时自动迁移）；删除硬编码 `admin/123456`；管理界面改为 `?admin=1` 开发开关；`isAdmin` 不再来自可伪造会话 | `domain/hash.js`、`core.js`、`ui.js`、`account.js`、`preferences.js`、`feeds.js`、`events.js` |
| P1-8 | `RUNTIME_AUDIT.md` 改为如实描述函数覆盖链（50 个被覆盖全局、28 条多点链），新增 `tools/runtime-ownership.mjs`，CI 强制「被覆盖的全局必须有声明」 | `RUNTIME_AUDIT.md`、`tools/runtime-ownership.mjs`、`js-syntax.yml` |

**P2 本轮完成**：17（自动翻译只恢复用户「原文」偏好，不再批量请求）、27（新闻投票 JSON 走 `safeParse`）、32（`configs` 查找加可选链）、33（资金费不再写全局费率）、23（非法股票代码直接丢弃）、24（WebSocket 补 `_gbSymbol`）、28（合成行情存档加 try/catch）、15（历史数组上限 500）、31（移除危险的历史种子迁移）、22（8 个模态框 dialog 语义、Esc 关闭、搜索框 aria-label）、14（补 `[0.0.26]` 变更日志）、13（版本号单源 `GB_VERSION` + `tools/check-version.mjs` + CI）、12（15 个动态注入 CSS 补构建键并改前缀选择器）、16（`every()` 定时器在隐藏标签页跳过 + 可见时刷新）、18（chevron 扫描收窄到 `#tradePage`）、21（21 个模块串行加载加 20 秒总超时）、25（回退行情 24H 涨跌改为按最近 24 小时基准）、26（合成盘口显示「GreedBit 参考深度」）。

**P2 剩余**：20（`ui/home.js` / `account.js` 旧新闻栈等死代码整理）、30（网格引擎亏损截断、静默跳过与费率口径）。

**验证**：`node --check` 全量通过；`node --test` 29/29；`node tools/runtime-ownership.mjs` 与 `node tools/check-version.mjs` 通过；本地静态服务 + Chrome CDP 九组冒烟——第一批 **12/12**，第二批 **6/6**，第三批 **6/6**，第四批 **3/3**，第五批 **5/5**，第六批 **7/7**，第七批 **9/9**，第八批 **4/4**（版本一致、模态框语义 + Esc、历史上限、旧迁移移除），第九批 **4/4**（20 个样式表全部带构建键、`every/cssHref/setBookMode` 可用、盘口标识切换）；`tools/build-toy.ps1 -NoZip` 通过（321 文件 / 7.16 MB）。

**剩余**：上列 2 项 P2。

---

## 三、P0：必须先处理

> 正文小节**已按下表优先级排列**（小节编号沿用发现顺序）；前两条是「能凭空造钱」的漏洞，建议今天就修。

| 优先级 | 条目 | 一句话 |
| ---: | --- | --- |
| 1 | P0-6 | 高级委托撤单可无限重复退款（造钱） |
| 2 | P0-7 | 用「当前交易对」的价格结算别的品种仓位（跨品种错价 + 基差套利） |
| 3 | P0-2 | 风控/撮合只覆盖当前交易对，切走后仓位失控 |
| 4 | P0-3 | 亏损被 `Math.max(0,…)` 吞掉，账实不符 |
| 5 | P0-4 | 第 21 个模块 `app/runtime.js` 永不初始化（静默） |
| 6 | P0-1 | 交易引擎有三份实现，`futures.js` 是死代码 |
| 7 | P0-5 | 切品种时在途响应覆盖新品种（错误价格成交） |

### P0-6 高级委托：撤单可无限重复退款——当前唯一能「凭空造钱」的漏洞

**证据链**

1. 引擎持有内存数组：[`src/trading/advanced-orders.js:26`](src/trading/advanced-orders.js#L26) `let advancedKind=null,advancedOrders=[];`，[:35](src/trading/advanced-orders.js#L35) `saveV10State()` 把它写进 localStorage。
2. 每来一笔逐笔成交都会跑一遍处理循环，并在**结尾无条件回写**：
   [`advanced-orders.js:339`](src/trading/advanced-orders.js#L339) `saveV10State();saveState();`
   [`advanced-orders.js:342`](src/trading/advanced-orders.js#L342) `applyRealtimeTrade=function(p,t,v){oldApplyRealtimeTrade(p,t,v);processAdvancedOrders()}`
3. 但「撤单」走的是另一套：它从 localStorage 读数组、退钱、再从 localStorage 里删掉，**完全没有动内存数组**：
   [`src/trading/records.js:70-77`](src/trading/records.js#L70-L77)
   ```js
   function advancedOrders(){ ... JSON.parse(localStorage.getItem(`greedbit_v010_advanced_${user.username}`)) ... }
   function cancelAdvanced(id){
     const arr=advancedOrders(), ...
     w.frozen=Math.max(0,w.frozen-reserved); w.usdt+=reserved; arr.splice(i,1);
     saveAdvancedOrders(arr); saveState(); ...
   }
   ```

**复现（不需要任何特殊条件）**

1. 下一笔「计划委托」，触发价设成永远不会到（`reserved=T` 从 `usdt` 移到 `frozen`）；
2. 在「当前委托 → 计划委托」点撤单 → 正确退回 `T`，`frozen` 归零；
3. ≤1 秒内下一笔 BTC 成交触发 `processAdvancedOrders()` → 把内存数组（含该单）写回 localStorage → **已撤的单复活**；
4. 再点一次撤单 → `frozen` 已经是 0，`Math.max(0,0-T)=0`，但 `w.usdt += T` → **净增 T**；
5. 第 3、4 步可无限循环。

同理，[`advanced-orders.js:337`](src/trading/advanced-orders.js#L337) 在「触发成交但开仓失败」时也会无条件再退一次 `o.reserved`（见 P1-13），叠加后可以一次拿回两份冻结金。

**影响**：这是本次审查中唯一可以让余额无限增长的路径。虽然只是模拟账户，但它会让「收益统计、排行榜、网格绩效」全部失去意义。

**建议**（一次改到位）
- 删除 `records.js` 里 `advancedOrders()/saveAdvancedOrders()/cancelAdvanced` 这整套「第二真相源」，撤单只调引擎的内存数组；
- 在引擎里导出唯一的 `cancelAdvanced(id)`，内部同步 `w.frozen` 并 `saveState()`；
- 加不变量断言：`w.frozen >= Σ(open orders.reserved) + Σ(open advanced.reserved)`，每次 `saveState` 前校验。

### P0-7 `closePosition` 的成交价取自「当前交易对」，跨品种结算会捏造盈亏

**证据**

- 点击事件把当前 `price` 直接当成交价传进去：
  [`src/app/events.js:22`](src/app/events.js#L22)
  ```js
  if(e.target.dataset.reduce)closePosition(+e.target.dataset.reduce,'减仓',price,.5);
  ```
- 包装层只补「调用方没传价」的情况：
  [`src/trading/contracts.js:106`](src/trading/contracts.js#L106)
  ```js
  closePosition=function(id,reason='手动平仓',fill,fraction=1){
    const p=positions.find(x=>x.id===id);
    if(fill==null&&p&&supportsPerpBasis(p.symbol))fill=contractPriceFor(p.symbol)||...
  ```
  传了 `price` 就**绕过**补价，最终落到 [`src/market/model.js:189`](src/market/model.js#L189) 的 `fill=price` 默认值。
- 而持仓表是全品种的（[`contracts.js:112`](src/trading/contracts.js#L112)、[`records.js:151`](src/trading/records.js#L151) 都没有按 symbol 过滤）。

**后果**

1. **跨品种错价**：在 BTC 页面（`price≈90000`）对一条 ETH 持仓（`entry≈2000`）点「减仓 50%」→ `realized=(90000-2000)*qty`，凭空多出几十万 USDT。
2. **商品/外汇全平**：`supportsPerpBasis` 为 false 时不补价，仍用当前品种的 `price`。
3. **同品种基差套利**：高级委托用**现货价**开仓（[`advanced-orders.js:320`](src/trading/advanced-orders.js#L320)），「全平」用**合约价**（现货 × (1+基差)，基差可达 ±0.42%）。基差为正时「计划委托开多 → 立刻全平」可反复赚取基差，扣除双边手续费后仍为正收益。这也解释了「表里浮盈和钱包对不上」。

**建议**：把价格契约收进 `closePosition` 内部——按 `p.symbol` 取 `contractPriceFor(p.symbol)`（永续）或 `markFor(p.symbol)`（其余），**不接受调用方传入的全局 `price`**；`events.js:22` 与 `advanced-orders.js:320` 一并改掉。这条改动同时消灭三个印钞口。

### P0-1 交易引擎有三份实现，`futures.js` 已是「活着的死代码」

**证据**

- [`src/futures.js:3`](src/futures.js#L3) 定义 `executeOpen`，[:9](src/futures.js#L9) 定义 `placeOrder`，[:18](src/futures.js#L18) 定义 `closePosition`，[:26](src/futures.js#L26) 定义 `settleFunding`。
- [`src/market/model.js:178`](src/market/model.js#L178) 重新赋值 `executeOpen`，[:183](src/market/model.js#L183) `placeOrder`，[:189](src/market/model.js#L189) `closePosition`；[`src/trading/contracts.js:121`](src/trading/contracts.js#L121) 又覆盖 `settleFunding`；[`src/trading/records.js:190`](src/trading/records.js#L190) 再包一层 `placeOrder`。
- `bootstrap.js` 在 `index.html` 的 6 个脚本之后运行，所以**实际生效的是 model.js/contracts.js/records.js 的版本**，`futures.js` 里那四个函数永远不会被直接调用（只能通过晚绑定的 `matchOrders`/`checkRisk` 间接调到）。
- 两份实现的手续费口径已经分叉：`futures.js:11` 用 `margin*leverage*FEE`（0.02% Taker）；`model.js:186` 用 `margin+notional*MAKER_RATE` 预留，实际扣费用 `consumeFee()` 区分 maker/taker。

**影响**：任何人（包括未来的你）在 `futures.js` 修 bug 都不会生效，且阅读时会以为那才是下单逻辑。这是最典型的「重构到一半」状态。

**建议**：二选一，不要并存。
1. 把 `futures.js` 的旧实现**删掉**，只留 `model.js`/`contracts.js` 的版本，并在原位置留一行注释指向新位置；
2. 或反过来，把 model.js 里的交易函数**搬回** `futures.js`，删掉 model.js 中的越界定义。

同时给「唯一实现」加 CI 门禁：`grep -c "placeOrder=" src/**/*.js` 必须为 1。

### P0-2 风控只盯「当前交易对」，切走后仓位完全失控

**证据**

- [`src/futures.js:17`](src/futures.js#L17) `matchOrders()`：`if(o.symbol!==symbol)continue;`
- [`src/futures.js:25`](src/futures.js#L25) `checkRisk()`：`if(p.symbol!==symbol)continue;`
- [`src/spot.js:42`](src/spot.js#L42) `matchSpotOrders()`：同样的 `if(o.symbol!==symbol)continue;`
- 而 [`src/futures.js:26`](src/futures.js#L26) 的 `settleFunding()` 却是**全仓位**结算（没有 symbol 过滤）。
- `setSymbol`（[`src/market/model.js:215`](src/market/model.js#L215)）切换交易对时既不提示也不平仓。

**触发条件**：在 BTC/USDT 开 100X 多单 → 切到 ETH/USDT → BTC 下跌 20%。此时：
- 止盈/止损不会触发（`checkRisk` 跳过非当前 symbol）；
- 强平不会触发；
- 挂在 BTC 的限价单永远不会成交（`matchOrders` 同样跳过）；
- 但资金费照扣。

**影响**：这是交易模拟器的核心正确性缺陷——用户可以靠「切到别的币」冻结风险。也是所有多仓位策略（网格、对冲）无法可信运行的根本原因。

**建议**：风控循环改为遍历全部 `positions`/`orders`，用 `markFor(p.symbol)` / `contractPriceFor(p.symbol)` 取价；只在「报价/渲染」层做 symbol 过滤。成本很低，`settleFunding` 已经是这么写的，照抄即可。

### P0-3 亏损被 `Math.max(0, …)` 截断，余额与统计对不上

**证据**

- [`src/market/model.js:190`](src/market/model.js#L190)：`w.usdt=Math.max(0,w.usdt+margin+realized-usdtFee)`
- [`src/futures.js:20`](src/futures.js#L20) 同款写法；[:26](src/futures.js#L26) 资金费 `Math.max(0,...)`；[`src/trading/contracts.js:121`](src/trading/contracts.js#L121) 同款。
- 但统计照实记录全额：`accountStats.realizedLoss+=Math.abs(realized)`（同两行）。

**影响**：
- 穿仓（亏损 > 保证金 + 可用余额）时，钱包被抹到 0，但「已实现亏损」记录的是真实亏损 → 账户统计页与余额永远无法对账；
- 资金费为负且余额不足时同样被截断，仓位不会因此被强平，等于给了一个隐形的「亏损豁免」；
- 配合 P0-2，容易出现「权益显示 0，但仍有仓位占着 margin」的僵尸状态。

**建议**：允许负余额（模拟器反而更真实），或在截断时同步写一笔「穿仓豁免」流水并冲减 `realizedLoss`。无论选哪种，**同一笔亏损只能有一个记账口径**。

---

### P0-4 `src/app/runtime.js`（第 21 个模块）永不初始化，且零报错

**证据链**

1. [`src/bootstrap.js:46-49`](src/bootstrap.js#L46-L49) 在 `script.onload` 里同步执行别名映射：
   ```js
   if(path==='src/ui/runtime.js'){
     if(window.GreedBitV21)window.GreedBitRuntimeUI=window.GreedBitV21;
   ```
2. 但 `window.GreedBitV21` 只在 [`src/ui/runtime.js:169`](src/ui/runtime.js#L169) 的 `finalize()` 里赋值，而 `finalize` 的触发方式是
   [`src/ui/runtime.js:171`](src/ui/runtime.js#L171)：`installStyle(finalize)`（等 `<link>` 的 `load` 事件，异步）或 `setTimeout(finalize,1500)`。
3. 也就是说：**别名执行时 `GreedBitV21` 一定还不存在**，`GreedBitRuntimeUI` 全项目再无第二个赋值点（已 grep 确认），永远为 `undefined`。
4. [`src/app/runtime.js:3`](src/app/runtime.js#L3) 的首行守卫因此永久进入轮询：
   ```js
   if(!window.GreedBitRuntimeUI||!window.GreedBitContracts||!document.getElementById('pairName')){setTimeout(waitRuntime,60);return}
   ```
5. 而 `bootstrap` 只看脚本是否 onload、只对 21 个模块中的 2 个做后置校验（[`src/bootstrap.js:51-54`](src/bootstrap.js#L51-L54)），于是把它记为「已加载」、`ready=true`。

**影响（全部是可见的功能失效，但没有任何报错）**

| 失效项 | 现象 |
| --- | --- |
| 永续交易对标题 | `desiredPairLabel()` 从未执行，标题停在其后不到位的 [`src/ui.js:12`](src/ui.js#L12) / [`src/app/compatibility.js:31`](src/app/compatibility.js#L31) 写的 `BTC/USDT`，而不是 README 承诺的 `BTCUSDT永续合约` |
| 页脚版本 | 4 个 `updateVersion()` 竞争（`preferences.js` / `shell.js` / `ui/runtime.js` / `app/runtime.js`），最后一个能执行的是 `ui/runtime.js:167` 的 `0.0.23` → 页脚显示 **v0.0.23**，与 `VERSION` 文件的 0.0.26 不符 |
| 新闻翻译偏好 | `installNewsOwnership()` 未执行（见 P2-17，这反而让自动翻译没有真的发请求） |
| 运行时可观测性 | `window.GreedBitRuntime` 不存在，`runtimeAudit()` 无法调用 |
| 事件包装 | `setSymbol` / `showPage` / `renderTradingMode` 的配对标题同步包装全部未安装 |

**建议**：在 `finalize()` 里直接 `window.GreedBitRuntimeUI=window.GreedBitV21;`（一行修复），或把别名映射改成监听 `greedbit:ready` 统一执行。同时给 bootstrap 增加 `provides` 声明与后置断言：模块加载后必须存在其导出的全局对象，否则按启动失败处理——否则这类「模块返回了但什么都没装」的故障永远不可见。

---

### P0-5 切到股票/大宗/外汇时，上一品种的在途响应会把价格写进新品种

**证据**

- [`src/market/preload.js:106-115`](src/market/preload.js#L106-L115)（Binance 路径）用请求序号防竞态：
  ```js
  const seq=++marketLoadSeq, info=tfInfo();
  ...
  const raw=await fetchBinance(...); if(seq!==marketLoadSeq)return;
  candles=bars; price=...; marketSnapshots[symbol].last=price;
  ```
  注意最后一行用的是**全局 `symbol`**，不是请求发起时捕获的品种。
- 但 [`src/market/extended.js:83`](src/market/extended.js#L83)（大宗商品）与 [`src/market/external.js:109`](src/market/external.js#L109)（股票/外汇）的 `loadHistoricalMarket` **既不 `++marketLoadSeq`，也不校验 seq**，直接 `closeMarketSocket()` 走 Yahoo。

**触发条件**：BTC 的 K 线请求还在飞（慢网、代理超时、首屏加载中）→ 用户点开 XAU 或 TSLA → 股票分支正常加载；随后 BTC 请求返回 → `seq!==marketLoadSeq` **仍然成立**（没人改过这个变量）→ 通过校验 → 把 BTC 的 `candles`/`price` 写进 XAU。

**影响**：图表变成 BTC 的 K 线、`price` 被改成 BTC 价格 → `stats()`、下单成交价（`price*(1±cfg.vol*.025)`）、`checkRisk` 全部按错误价格执行。这是本次审查里**唯一能直接造成「以错误价格成交」**的缺陷，且不需要极端条件。

**建议**：把「请求令牌」收口到唯一入口（`setSymbol` 或一个 `beginMarketLoad()`），所有分支（Binance / HTX / Yahoo / 合成）都必须 `++token` 并在每次 `await` 后同时校验 `token === currentToken && sym === symbol`；写 `marketSnapshots[s]` 时用捕获的 `s`，不要用全局 `symbol`。

---

## 四、P1：严重问题

### P1-4 首屏与切换失败后展示上一交易对的数据

- [`src/market/preload.js:110-115`](src/market/preload.js#L110-L115) `loadHistoricalMarket` 的 `catch` 只改状态文案，**没有清空 `candles`/`current`**；
- `market.js:83`、`extended.js` 的 catch 同样只 notРify。
- 结果：切到新交易对 → 请求失败 → 标题已是新币，K 线还是旧币的，`price` 还是旧价格，`marketReady=false` 但界面照常显示。
- 对比 [`src/market/external.js:109`](src/market/external.js#L109) 的 catch 里有 `candles=[];current=null`——同一个项目里两种处理方式。

**建议**：所有 `loadHistoricalMarket` 实现统一在 catch 里清空序列并渲染空状态，标题/价格回退到 `--`，不要让旧数据冒充新交易对。

### P1-5 `localStorage` 顶层解析无保护，一条脏数据即白屏

- [`src/core.js:41`](src/core.js#L41)：`let chartSettings={...chartDefaults,...JSON.parse(localStorage.getItem('greedbit_chart_settings')||'{}')};`——这是 `core.js` 的**顶层语句**。该 key 若被写坏（手工、旧版本 schema、其他脚本），`core.js` 直接抛异常，后面 5 个基础脚本与整个 bootstrap 都不执行，页面白屏且无任何提示。
- [`src/core.js:128`](src/core.js#L128) `JSON.parse(localStorage.getItem('greedbit_users')||'{}')` 同样在登录路径上无 try/catch → 用户永远登录不了。
- [`src/core.js:92-113`](src/core.js#L92-L113) `loadState` 有 catch，但 catch 里只重置 `wallets`，`positions/orders/trades` 保留内存中的上一个用户数据 → 换账号登录时可能看到别人的仓位。

**建议**：抽一个 `safeParse(key, fallback)`，全项目统一使用；`loadState` 的 catch 要重置**所有**业务数组。

### P1-6 每次行情刷新都在重建整页 UI，隐藏的选币弹窗也在重建

- [`src/performance/runtime.js:113`](src/performance/runtime.js#L113)：`flushMarketUi` 每约 80ms 执行 `stats(); updateFooterTickers(); draw(); renderTable();`
- [`src/market.js:174-180`](src/market.js#L174-L180) `stats()` 里依次调用 `updateAssets(); updatePreview(); updateFundingUI(); updateSpotPanel(); renderCoinList();`
- `renderCoinList`（[`src/market/model.js:213`](src/market/model.js#L213)）只判断 `$('coinList')` 是否存在——弹窗关闭时元素仍在 DOM，于是 **每秒约 12 次重建 30 行选币列表**；
- `renderTable()` 再走 4 层覆盖链到 [`src/performance/runtime.js:92`](src/performance/runtime.js#L92)，重建表头/表体并 `annotateTerms()` 重新挂 Tooltip。

**影响**：交易页常年 30%+ CPU；笔记本风扇起转；低端移动端会明显掉帧。这是「Worker 解析 + rAF 节流」优化被 UI 侧抵消掉的典型。

**建议**：`stats()` 拆成 `paintPricePanel()`（仅价格/涨跌/24H 字段）与 `paintAggregates()`；`renderCoinList` 增加 `if($('coinPicker').classList.contains('hidden'))return;`；`renderTable` 在 `performance/runtime.js` 的 flush 里按 500ms 或「数据变化」触发，而不是每帧。

### P1-7 认证只是装饰：明文密码 + 硬编码管理员 + 可伪造会话

- [`src/core.js:131`](src/core.js#L131)：`users[name]={username:name,password:pass,...}` —— **明文密码**写进 `localStorage`；
- [`src/core.js:133`](src/core.js#L133)：`if(name==='admin'&&pass==='123456')` —— 硬编码管理员密码；
- [`src/core.js:116`](src/core.js#L116)：会话就是 `{username}`（或 `{username,isAdmin:true}`），用户改一下 localStorage 即可获得管理页；
- 管理页可向本机所有账号群发通知（[`src/ui/shell.js:47`](src/ui/shell.js#L47)、[`src/account.js:47-61`](src/account.js#L47-L61)）。

**说明**：纯前端、无真实资产，这**不是可被远程利用的漏洞**；风险在于「用户会输入真实密码」（登录框文案已经提醒，但只是小字）以及「管理界面给人一种有权限体系的错觉」。

**建议**：至少不要把原密码落库——注册时存一个 hash（`crypto.subtle.digest` 即可），登录时比对 hash；管理员入口改为开发开关（`?admin=1` 或构建期常量），不要硬编码 `123456`；登录框默认值提示「请勿使用真实密码」提升到输入框上方。

### P1-8 `RUNTIME_AUDIT.md` 的核心声明与代码不符

文档称：

> 旧运行时曾通过 `events.js -> v009 -> …逐层加载和覆盖函数`，v0.0.26 已取消该结构。

实际只是把「按版本命名」改成了「按职责命名」，**覆盖机制原封不动**：

| 函数 | 定义/覆盖处 |
| --- | --- |
| `showPage` | `ui.js` → `advanced-orders.js:369` → `ui/home.js:60` → `ui/shell.js:70` → `performance/runtime.js:72` → `contracts.js:100` → `app/runtime.js:40` |
| `renderBook` | `market.js:154` → `preload.js:104` → `model.js:139` → `extended.js:89` → `external.js:117` → `contracts.js:109` |
| `updateMarketSnapshots` | `market.js:30` → `model.js:97` → `extended.js:80` → `external.js:106` → `ui/home.js:57` → `preload.js:79` |
| `renderTable` | `account.js:25` → `advanced-orders.js:345` → `performance/runtime.js:92` → `records.js:166` |

**更隐蔽的一点**：同一条链上，有的模块是「包装」（`const prev=X; X=function(){…prev()…}`），有的模块是「整体替换」（`X=function(){…}` 且不调用 `prev`）。例如 `updateMarketSnapshots`：`preload`(#1) 和 `ui/home`(#6) 都做了包装，但 `model.js`(#8) 直接整体替换，`extended`(#13)/`external`(#15) 又各自包装新的 → **preload 与 home 的包装器永远不会被调用**，它们想加的吞错与首页刷新逻辑全是死代码。一个「优化」是否生效，只能靠人肉追踪加载顺序判断。

**影响**：这是最危险的一类技术债——文档告诉后来者「已经没有覆盖链了」，于是他随手改基础实现，然后发现「改了没效果」，或者更糟：在错误的层修好了、在另一条路径上又坏了。

**建议**：要么把文档改成诚实描述（附上下表），要么真正落地「一个状态一个所有者」：用 `window.GreedBit.<module>` 命名空间 + 显式注册替代函数赋值。短期最低成本是：**在 RUNTIME_AUDIT.md 里加上这张覆盖链表**，让规则可被验证。

### P1-9 全局劫持 `window.fetch` 来「伪装」本地清单

[`src/market/stock-manifest-preload.js:7`](src/market/stock-manifest-preload.js#L7) 整体替换 `window.fetch`，仅当 URL 恰好等于 `https://api.github.com/repos/ShrinkShi/GreedBit/contents/assets/stocksicon?ref=main` 时返回本地 `assets/stocksicon/manifest.json` 的结果，否则透传。

**问题**：
- 只要 URL 不完全相等（加参数、改域名、仓库改名），劫持就一直存在，`window.fetch !== nativeFetch`，任何依赖 fetch 身份或包装的库都会受影响；
- README 写着「页面优先使用本地清单，不依赖 GitHub API 才能生成股票列表」，其实是「仍然请求 GitHub，只是被 fetch 劫持换成了本地文件」——这是**文档层面的不诚实**，也最容易在重构时踩雷。

**建议**：把 [`src/market/external.js:8`](src/market/external.js#L8) 的 `STOCK_MANIFEST_URL` 直接改成 `assets/stocksicon/manifest.json`，删除整个 preload 文件。

### P1-10 零测试 + CI 只查语法，资金计算无任何护栏

[` .github/workflows/js-syntax.yml:16-21`](.github/workflows/js-syntax.yml#L16-L21) 只做 `node --check`，外加几条 grep。对一个包含保证金、强平、资金费、手续费、赚币复利的项目来说，这意味着**任何一次重构都只能靠人肉点击验证**。

**建议**（性价比最高的三件事）：
1. 把纯函数（`liqPrice`、`pnlOf`、`settleFunding` 的计算部分、`feeQuote`、`spotFill` 的账务部分）抽到一个不做 DOM 访问的 `src/domain/*.js`；
2. 用 Node 内置 `node:test` 写 20 个左右的用例（无依赖、零成本），CI 加一步 `node --test`；
3. 至少覆盖：开仓→价格变动→平仓后的余额守恒、逐仓/全仓强平价、资金费正负号、GREED 抵扣不足时回退。

### P1-11 Worker 加载失败时行情静默冻结，状态仍是「真实行情已连接」

[`src/performance/runtime.js:99-102`](src/performance/runtime.js#L99-L102)：

```js
try{marketWorker=new Worker('src/performance/market-worker.js');marketWorker.onmessage=e=>handleWorkerBatch(e.data)}
catch(e){console.warn(...);marketWorker=null}
```
[:129](src/performance/runtime.js#L129)：`const w=ensureMarketWorker(); if(w)w.postMessage(...); else directRawFallback(...)`

**问题**：`new Worker()` 对 404 / CSP 拦截 / 文件损坏**不会同步抛异常**，而是在 Worker 对象上异步触发 `error` 事件。代码既没有 `onerror`/`onmessageerror`，也没有握手，于是 `w` 非空 → `postMessage` 成功 → 永远收不到回包 → `directRawFallback` 永不执行。此时：

- `price`/K 线/撮合/风控全部停止更新（`applyTradeCore` 不再被调用）；
- 但 `onopen` 已把状态设成「真实行情已连接 · Worker批处理」（[:128](src/performance/runtime.js#L128)），状态点是绿的；
- 用户看着不动的价格继续下单，`matchOrders`/`checkRisk` 也不会再触发。

另外 Worker 的 URL 没有带 `?gb=` 构建参数（[:101](src/performance/runtime.js#L101)），发版后浏览器可能长期复用旧 worker，「新主线程 + 旧解析逻辑」的组合无法通过刷新解决。

**建议**：`onerror` → `terminate()`、置空、走主线程回退；增加 `{type:'ready'}` 握手 + 超时；URL 带 `?gb=BUILD`；再加一个「最近 N 秒没有任何行情事件」的看门狗，把状态点改为 error——**状态必须由数据活性驱动，而不是由连接建立驱动**。

### P1-12 外部行情失败没有负缓存，会打满公共 CORS 代理并拖垮商品/外汇

**证据**

- [`src/market/external.js:103`](src/market/external.js#L103) `ensureSnapshot` 的 catch 只改 `_source` 文案后 `throw`，**不写 `lastSnapshotAt`** → 下一次渲染会重试同一标的，无 TTL、无退避。
- [`src/market/external.js:77-81`](src/market/external.js#L77-L81) `attachLazyQuotes()` 每次渲染都 `disconnect()` 旧 observer、`new IntersectionObserver`，并对进入视口的行调用 `ensureSnapshot`。
- 叠加 P1-6 的 12.5Hz 全量重建 → **每秒新建 12.5 个 IntersectionObserver，并对失败标的反复发起 Yahoo 请求**。
- [`src/market/external.js:56`](src/market/external.js#L56) 与 `stock-manifest-preload.js`：本地 manifest 里约 200 个图标文件名会被全部注册成「股票代币」（`buildStock` 对不合规 ticker 也照单全收），其中大量并不是真实代码，**必然失败**。
- [`src/market/extended.js:71`](src/market/extended.js#L71)：`clearTimeout(t)` 写在 `await fetch()` 之后、`await r.json()` 之前 → 超时不覆盖响应体，代理若「回了头再卡住」，Promise 永久 pending，12s 的商品轮询会不断叠加悬挂请求。

**影响**：allorigins / proxy.cors.dev 类服务按 IP 限流，被股票页打满后，**大宗商品与外汇会一起不可用**——这正是「外部行情时好时坏」最可能的真实成因。

**建议**：失败也写 `lastSnapshotAt`（负缓存 30s→5min 退避）；observer 只建一次、行内只做 `src` 懒加载；把「取头 + 取体」整体套进一个 `Promise.race` 超时；限制并发（4–6）；manifest 与已知代码表取交集，别把图标名当股票。

### P1-13 高级委托触发后不看开仓结果，还按 Taker 收费却按 Maker 预留

[`src/trading/advanced-orders.js:330-337`](src/trading/advanced-orders.js#L330-L337)：

```js
if(o.kind==='plan'){ const hit=...; if(hit){fireAdvanced(o,o.margin);done=true} }
...
if(done){ ... w.frozen=Math.max(0,w.frozen-o.reserved); w.usdt+=o.reserved; advancedOrders.splice(i,1); notify('高级委托完成',...) }
```

- 计划/跟踪委托**忽略 `fireAdvanced` 的返回值**（只有 TWAP 在 :335 检查了），开仓失败也照样删单、照样退款、照样弹「完成」；
- 预留按 `fee=margin*leverage*FEE`（0.0002，[:307](src/trading/advanced-orders.js#L307)），但 `executeOpen` 用 `source` 判定流动性：`'计划开仓'/'跟踪开仓'/'分时开仓'` 都不匹配 `/限价|maker/` → 按 **Taker 0.0006** 扣费（[`model.js:179`](src/market/model.js#L179)）。每笔都会比预留多扣 `0.0004×名义`；账户打满时必然 `return null` → 委托消失；
- `w.frozen` 是**所有**限价单与高级委托共用的一个池子（[`model.js:180`](src/market/model.js#L180) 只校验总额），没有任何 `orderId → reserved` 的映射 → 一张单可以花掉另一张单的冻结金。

**建议**：`done` 只在 `fireAdvanced` 返回成功时置位；预留与实际收费用同一个费率函数（把 `source` 映射成 maker/taker 后再算）；每单记 `reserved` 并按 `id` 扣减，`w.frozen` 只作为汇总冗余。

### P1-14 手续费被重复计（现货）或漏计（合约），ROE 与净收益虚高

| 位置 | 做了什么 |
| --- | --- |
| [`src/app/compatibility.js:48`](src/app/compatibility.js#L48) | 现货买入：`w.cost[c] += notional + q.usdt`（手续费进了成本） |
| [`src/app/compatibility.js:50`](src/app/compatibility.js#L50) | 现货卖出：`realized=(fill-avg)*qty - q.usdt`（手续费又扣了一次） |
| [`src/app/compatibility.js:52`](src/app/compatibility.js#L52) | 又记 `accountStats.fees += q.usdt` |
| [`src/account.js:36`](src/account.js#L36) | `netRealized() = realizedProfit - realizedLoss - accountStats.fees + ...`（把 fees 再减一次） |
| [`src/market/model.js:190`](src/market/model.js#L190) | 合约平仓 `realized=(fill-entry)*qty*dir`，**不含**平仓手续费 |
| [`src/trading/records.js:140`](src/trading/records.js#L140) | `roe = realized / margin * 100`，用的是毛值 |
| [`src/strategy/grid.js:38-39`](src/strategy/grid.js#L38-L39) | 网格 `r.realized += pnl`（已是净值）后又 `accountStats.fees += fee` |

**影响**：现货手续费在「成本 / realized / fees」三处重复扣，合约已实现盈亏反而漏掉手续费 → 「账户统计」页的净收益、历史仓位的「平仓收益率」永远偏高，且和钱包对不上。

**建议**：定一条规则——`realized` 一律为**扣除手续费后的净值**，`accountStats.fees` 只做聚合展示、不参与二次扣减；`netRealized()` 改为 `realizedProfit - realizedLoss + funding...`（fees 已在 realized 里）。

### P1-15 多标签页没有互斥，会双花并互相回滚状态

- [`src/core.js:87-91`](src/core.js#L87-L91) 每次都把**整个** `greedbit_state_<user>` 覆盖写；
- 全项目没有任何 `addEventListener('storage', …)`、`BroadcastChannel` 或 `navigator.locks`（已 grep 确认）。

两个标签页各持一份内存钱包：A 开仓后 `saveState`，B 的页面里余额还是旧的，B 再开一笔并保存 → A 的仓位被覆盖消失；A 下一笔操作又把 B 的覆盖回来，两边交替「闪回」。净效果是同一笔保证金被用了两次，成交/账本随机丢数据。

**建议**：最低成本是 `storage` 事件监听 + 收到后整页只读提示；更实际的是用 `navigator.locks.request('greedbit-state')` 做单写者，或 `BroadcastChannel` 选主标签页。

### P1-16 全仓强平价把同一份可用余额重复抵押，且 200X 下强平价等于开仓价

[`src/market.js:171`](src/market.js#L171)：

```js
function liqPrice(side,entry,mode,margin,notional){
  let cushion=margin; if(mode==='cross')cushion+=Math.max(0,futuresWallet().usdt);
  const ratio=Math.min(.95,cushion/Math.max(1,notional));
  return side==='long'?Math.max(.0000001,entry*(1-ratio+MMR)):entry*(1+ratio-MMR);
}
```

- **重复抵押**：N 个全仓仓位，每个都把**全部** `w.usdt` 当成自己的缓冲（还不算 `w.frozen`，也不算其他仓位的浮盈浮亏）→ 组合强平点被系统性推远，各仓位独立强平，真实权益早已为负；
- **边界**：200X 时 `ratio = 1/200 = 0.005 = MMR` → 多单强平价 = 开仓价，下一次 tick 就会以 0 盈亏「强平」该仓（[`ui.js`](src/ui.js) 的上限正好是 200）；
- **成交价**：强平按理论价 `p.liq` 成交（[`futures.js:25`](src/futures.js#L25)），跳空时不产生穿仓亏损，配合 P0-3 的截断进一步隐藏风险；
- `Math.max(1,notional)` 让名义 <1 USDT 的仓位按 1 USDT 计算缓冲，比例失真。

**建议**：全仓的缓冲应基于「账户权益 − 所有仓位维持保证金」一次性计算；杠杆上限应低于 `1/MMR`（例如 100X 封顶或把 MMR 提到 1%）；强平成交价用触发时的 `price`，不要用理论 `liq`。

---

## 五、P2：中等

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| P2-11 | [`index.html:5`](index.html#L5) | `maximum-scale=1` 禁止用户缩放 | 去掉，或至少允许到 2 |
| P2-12 | 15 个模块运行期注入 CSS（`v009`–`v024`），且**不带 `?build=` 缓存键**（如 [`external.js:37`](src/market/external.js#L37)、[`extended.js:40`](src/market/extended.js#L40)） | 更新后旧 CSS 可能被缓存；首屏 FOUC | 统一在 `index.html` 里静态引入，或注入时带 `?build=` |
| P2-13 | 版本号有 4 处：`index.html` 的 `?build=0026d`、`bootstrap.js:6` 的 `BUILD`、`VERSION` 文件、README/CHANGELOG | 需要手工同步，CI 只校验「存在 `?build=`」不校验「一致」 | CI 增加一致性检查；或由构建脚本统一注入 |
| P2-14 | [`CHANGELOG.md:3`](CHANGELOG.md#L3) | 最新版本条目是 `[0.0.16]`，之后 0.0.17–0.0.26 全在 Unreleased | 发布前补齐，或至少写一条 `[0.0.26]` 汇总 |
| P2-15 | [`src/core.js:88-91`](src/core.js#L88-L91) `saveState` 无 try/catch；`orderHistory/trades/closedPositions` 无上限 | localStorage 配额耗尽时 `setItem` 抛错，仓位已加入内存但未落盘 → 刷新后「幽灵成交消失」 | `saveState` 包 try/catch，超限时裁剪历史并提示；给三个数组加上限（如 500/1000） |
| P2-16 | 约 10 个全局定时器：`events.js:45-48`、`shell.js:91`、`home.js:62`、`contracts.js:133`、`grid.js:212`、`model.js:143/218`、`external.js:114/126`、`compatibility.js:60` | 没有 `visibilitychange` 处理，后台标签页仍轮询 + 保持 WebSocket；`home.js` 与 `shell.js` 各有 1.5s 定时器重复渲染首页 | 统一一个调度器，`document.hidden` 时暂停；删掉重复的首页渲染 |
| P2-17 | [`src/app/runtime.js:58-69`](src/app/runtime.js#L58-L69) + [`src/ui/shell.js:82`](src/ui/shell.js#L82) | 自动翻译策略写好了但**当前根本没执行**（因为 P0-4：`app/runtime.js` 未初始化）；一旦修好 P0-4，每次 `renderNews` 会串行自动点击最多 20 张卡片、向 MyMemory 发约 40 个请求，失败还弹 20 个 Toast——是个埋在正确性修复后面的雷 | 与 P0-4 同批处理：改成用户点击才翻译；失败只提示一次；加节流 |
| P2-18 | [`src/trading/contracts.js:61`](src/trading/contracts.js#L61) | `installChevrons()` 在每次 `decoratePicker` 时遍历**全文档** `button,span`，对含 `⌄` 的元素重写 `textContent` | 只针对已知的几个容器，或用 CSS 伪元素 |
| P2-19 | [`src/ui/runtime.js:16`](src/ui/runtime.js#L16) | `esc()` 把 `"` 映射成 `&quot`（**缺分号**），属性里遇到 `&quot` 后跟字母数字时不会被解码 | 补分号；更根本的是消除这份第 5 个 `escapeHtml` 副本 |
| P2-20 | 重复/死代码 | `account.js` 里有一整套被 `news/feeds.js` 覆盖的新闻实现（`loadRealNews`/`renderNews`/`parseRss`，约 80 行）；`ui/home.js` 的首页被 `ui/shell.js` 的 `installHome()` 整个替换；`futures.js` 见 P0-1 | 删除死代码，或保留但在文件头注明「已被 X 取代」 |
| P2-21 | [`src/bootstrap.js:7`](src/bootstrap.js#L7) | 每个模块 8s 超时、21 个模块串行 → 最坏 168s 才会报错；任一模块失败即整体中止 | 关键模块与增强模块分组；非关键模块失败只降级不阻断 |
| P2-22 | 可访问性 | 模态框无 `role="dialog"`/`aria-modal`/焦点陷阱；涨跌依赖颜色；`<table>` 无 `caption`；搜索框无 label | 逐步补齐，优先模态框焦点管理 |
| P2-23 | [`src/market/external.js:50-52`](src/market/external.js#L50-L52)、[:81](src/market/external.js#L81)、[:123](src/market/external.js#L123) | `buildStock` 在 ticker 正则不通过时**仍把原始文件名当 ticker 返回**，随后拼进 `innerHTML`（`${a.ticker}`/`${a.name}`）；若 manifest 或 GitHub 响应被写入形如 `x"><img onerror=…>.png` 的文件名即为存储型 XSS。当前只靠「仓库可信」兜底 | 正则不通过直接丢弃该标的；所有外部字符串走统一 `esc()` |
| P2-24 | [`src/market/preload.js:95`](src/market/preload.js#L95) + [:108](src/market/preload.js#L108) + [`src/performance/runtime.js:123-131`](src/performance/runtime.js#L123-L131) | `marketSocket._gbSymbol` 只在**已被覆盖掉的那版** `connectMarketSocket` 里赋值，最终生效的实现从不写 → `loadHistoricalMarket` 每次都判定「socket 不属于当前品种」而 `close+connect`，切周期/切品种都会重订阅一次 | 在最终实现里补 `marketSocket._gbSymbol=symbol` |
| P2-25 | [`src/market/model.js:121`](src/market/model.js#L121) | 回退/合成行情的「24H 涨跌」以整段序列首根 K 线为基准（1M 周期≈500 个月），而「24H 高/低」只取最后 120 根——同一行三个数口径不一致 | 统一按最近 24h 窗口计算，或改标签为「区间涨跌」 |
| P2-26 | [`src/market/model.js:130-139`](src/market/model.js#L130-L139) + [`index.html:79`](index.html#L79) | 回退到合成 K 线时调用 `setMarketStatus('live')` → `marketReady=true`，而盘口标题恒为「盘口　实时成交」，合成深度没有任何标记 | 合成模式加显式标记，并让 `marketReady` 反映数据来源而非连接状态 |
| P2-27 | [`src/news/feeds.js:35`](src/news/feeds.js#L35)、[`src/ui/shell.js:74`](src/ui/shell.js#L74) | `voteInfo()` 里 `JSON.parse(greedbit_news_votes)` 无 try/catch，一个脏键会让整条 RSS 解析抛错 → 资讯页显示「新闻源不可用」，而 RSS 其实正常 | 与 P1-5 一起换成 `safeParse` |
| P2-28 | [`src/market/external.js:96-98`](src/market/external.js#L96-L98)、[:114](src/market/external.js#L114) | 合成行情每 4.5s 把全部模拟状态序列化写 localStorage（`saveSim` 无 try），多标签互相覆盖；写失败则价格静默停更且 `.catch(()=>{})` 吞掉 | 合并写入、包 try、失败提示一次并停止重试 |
| P2-29 | [`src/app/events.js:17`](src/app/events.js#L17)、[:21](src/app/events.js#L21) | 100% 档位把 `marginInput` 填成全部可用余额，而下单要校验 `margin+fee > usdt`（[`model.js:184`](src/market/model.js#L184)）→ **100% 永远报「余额不足」**；现货同理 | 按 `usdt/(1+feeRate)` 反算，或下单时允许手续费从余额另扣 |
| P2-30 | [`src/strategy/grid.js:65-66`](src/strategy/grid.js#L65-L66)、[:72-73](src/strategy/grid.js#L72-L73)、[:91-92](src/strategy/grid.js#L91-L92) | 网格收益用 `Math.max(0,…)` 截断亏损；资金不足时静默跳过该网格却仍推进 `gridIndex`（网格永久丢失）；用固定 0.001 费率，与实际 `feeQuote` 不一致 | 与主引擎共用保证金/费率函数；跳过时不推进索引 |
| P2-31 | [`src/strategy/grid.js:47-58`](src/strategy/grid.js#L47-L58) | `migrateUntouchedLegacySeed` 用「从未入金 + 从未成交 + 总资产≈100000」的启发式**清空所有钱包**并永久标记已迁移；靠划转/利息凑到 10 万的账号会被误伤且不可恢复 | 直接删除这段历史包袱（`freshWallets()` 已返回 0） |
| P2-32 | [`src/market/external.js:106`](src/market/external.js#L106) × [`src/futures.js:16`](src/futures.js#L16) | 行情刷新期间 `configs` 里的股票/外汇条目被 `delete` 几十~几百毫秒，而撤单提示里 `configs[o.symbol].dec` 没有 `?.` → 可能抛 TypeError，造成「钱退了单还在」（需实机复现窗口） | 用 `configs[o.symbol]?.dec ?? 2`，并保证 `configs` 只增不删 |
| P2-33 | [`src/trading/contracts.js:123`](src/trading/contracts.js#L123) | `updateFundingUI()`（每秒调用）里把全局 `fundingRate` 改成「当前交易对的基差费率」；商品/外汇走 `settleFunding` 的 else 分支时就会用**别的品种**的费率结算资金费 | 费率按 symbol 取，不在渲染函数里改全局交易状态 |

---

## 六、做得好的地方（不要改坏）

1. **坦诚的数据叙事**：模拟行情、未上市股票估值、本地盘口都明确标注，不冒充真实数据；这条产品原则在代码里基本落实了（`_source` 字段、`synthetic` 标记、`GreedBit 模拟事件` 徽章）。
2. **无后端、无密钥**：`localStorage` 单机存档，没有把 key 写进前端的坏习惯。
3. **启动器的错误处理**：[`src/bootstrap.js:98-108`](src/bootstrap.js#L98-L108) 的启动失败面板会打印模块名与堆栈，比自己 console 里猜强得多。
4. **CI 架构门禁**：禁止 `vNNN.js` 回归、禁止已退休轮询器，思路是对的（虽然没能阻止「换名字的覆盖链」）。
5. **构建脚本的检查**：[`tools/build-toy.ps1:28-52`](tools/build-toy.ps1#L28-L52) 校验 index 体积、根绝对路径、必需文件，属于很少见的工程自觉。
6. **性能优化的方向**：Worker 解析、rAF 节流、虚拟滚动、Skeleton 都是正确的选择——问题只在最后一公里的 UI 更新策略。
7. **文档量**：README / RUNTIME_AUDIT / TOY_COMPATIBILITY / CHANGELOG 四件套，比多数个人项目完整（准确性问题见 P1-8、P2-14）。

---

## 七、建议的修复顺序

**第 0 批（当天，资金漏洞，改动都不大）**
1. **P0-6**：高级委托只保留内存数组一个真相源，删掉 `records.js` 的 localStorage 撤单路径；加冻结额不变量断言。
2. **P0-7**：`closePosition` 自己按 `p.symbol` 取价，拒绝调用方传入的全局 `price`；同步改 `events.js:22` 与 `advanced-orders.js:320`。
3. **P1-13**：`fireAdvanced` 返回值决定 `done`；预留与实收费率统一；冻结按 orderId 归属。

**第 1 批（1–2 天，止血）**
4. **P0-4**：在 `ui/runtime.js` 的 `finalize()` 里补 `window.GreedBitRuntimeUI=window.GreedBitV21`——一行，立刻恢复交易对标题、页脚版本、新闻偏好与所有事件包装，并消灭那个 60ms 永久自旋。
5. **P0-2**：`matchOrders` / `checkRisk` / `matchSpotOrders` 去掉 `o.symbol!==symbol` 过滤，改用各自品种的 `markFor/contractPriceFor`。
6. **P0-3**：穿仓不再 `Math.max(0,…)`，或在截断时写「穿仓豁免」流水冲减统计。
7. **P0-5**：把请求序号收口到唯一入口，四个分支统一校验 `token + symbol`——防止以错误价格成交。
8. **P1-5**：`safeParse` + `loadState` 失败时重置全部业务数组 + 数值字段校验（防 NaN 毒化）。
9. **P1-11**：Worker `onerror` + 握手 + 活性看门狗。
10. **P1-4**：历史行情失败时清空序列并渲染空状态。
11. **P2-11 / P2-19**：移除 `maximum-scale=1`、补 `&quot;`。
12. **P1-9**：删掉 `stock-manifest-preload.js`，`STOCK_MANIFEST_URL` 指向本地 manifest。

**第 2 批（3–5 天，去重）**
13. **P0-1**：交易函数只保留一份实现（建议保留 `model.js` 的版本并搬回 `futures.js`），删掉另一份；CI 加「同名函数只能有一个赋值点」的检查。
14. **P1-14**：统一手续费与已实现盈亏口径（净额规则），重算 `netRealized()` 与 ROE。
15. **P1-6**：拆分 `stats()` 的绘制职责，`renderCoinList` 在弹窗关闭时直接 return，`renderTable` 降到 500ms 或数据变化触发。
16. **P1-12**：外部行情负缓存 + observer 单例 + 整体超时 + 并发上限。
17. **P1-7**：密码改 hash、管理入口改开发开关、去掉 `isAdmin` 会话字段。
18. **P1-15 / P1-16**：多标签单写者；全仓缓冲按账户权益一次性计算、杠杆上限低于 `1/MMR`。
19. 清理 P2-20 的死代码（`ui/home.js` 的旧首页、`account.js` 的旧新闻栈、`futures.js` 的死函数）。

**第 3 批（1–2 周，立规矩）**
20. **P1-10**：抽 `src/domain/` 纯函数 + `node --test` 资金用例（余额守恒、强平价、资金费符号、手续费回退、撤单幂等）。
21. **P1-8**：覆盖链要么拆掉、要么写进 `RUNTIME_AUDIT.md` 并加 CI 断言（`__gbOwner` + 启动自检）。
22. **P2-12/13/16**：CSS 静态引入并带构建键、版本号单源、定时器统一调度并响应 `visibilitychange`。

---

## 附录 A：验证方式

首轮审查时沙箱无法创建工作区写权限（`SetNamedSecurityInfoW failed (Win32 5)`），只能做静态阅读。开启完全访问后补做了运行时验证：

1. `node --check` 递归检查全部 `src/**/*.js`，全部通过；
2. `python -m http.server 8123` + Chrome headless（CDP `Runtime.evaluate`）跑了一组回归用例：启动就绪、脏 `localStorage` 恢复、跨品种减仓定价、非当前品种止损、高级委托撤单幂等、100% 档位——**12/12 通过**；
3. `pwsh tools/build-toy.ps1 -NoZip` 打包预检通过（321 个文件 / 7.15 MB）；
4. 提示：构建脚本依赖 PowerShell 7（文件内含中文资源名，Windows PowerShell 5.1 会按 ANSI 读取并误报「缺少 assets\voice\…wav」）。

## 附录 B：本次未覆盖

- 未逐行审查 `styles/*.css`（仅确认了加载方式与命名）；CSS 层叠冲突、重复定义未量化。
- 未审查 `assets/stocksicon/manifest.json` 的 200+ 条目与图片是否一一对应。
- 未验证真实网络环境下 Binance / Yahoo / CORS 代理的可用性与地区限制。
- 未做真机移动端与 Bilibili Toy 预览环境验证。
