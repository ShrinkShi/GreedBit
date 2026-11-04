# 变更记录

## 2026-11-03 - 第一批 P0/P1 修复

### 变更范围
资金安全、启动可靠性、脏数据容错、行情竞态。

### 具体改动
- `src/trading/advanced-orders.js`：新增 `cancelAdvancedOrder()` 与 `window.GreedBitAdvancedOrders`；`fireAdvanced` 尊重开仓返回值、按 Taker 费率预留、永续用合约价开仓；删除重复的委托行渲染。
- `src/trading/records.js`：`advancedOrders()` 改读引擎；`cancelAdvanced()` 委托给引擎。
- `src/trading/contracts.js`：`closePosition` 按持仓 symbol 取价；同步导出 `GreedBitContracts`。
- `src/market/model.js`：`executeOpen` 的预留费率按流动性选择；`setSymbol` 递增 `marketLoadSeq`。
- `src/futures.js`：`checkRisk` 遍历全部仓位，按各品种标记价判断止盈/止损/强平。
- `src/app/events.js`：减仓不再传当前价；100% 档位按手续费反算可用额度。
- `src/app/runtime.js`、`src/ui/runtime.js`：修复模块别名时序，补等待上限。
- `src/core.js`：新增 `safeParse`；登录/图表设置/用户表全部改用它；`loadState` 失败重置全部业务数组。
- `src/performance/runtime.js`、`market-worker.js`：Worker 错误与握手超时降级、版本参数。
- `src/market/preload.js`、`extended.js`、`external.js`：加载失败清空序列；token + symbol 双重校验；删除 GitHub 清单依赖。
- `src/market/stock-manifest-preload.js`：删除（全局 fetch 劫持）。
- `index.html`：允许缩放。
- `tools/build-toy.ps1`：移除已删除模块的必需文件项。

### 验证情况
- `node --check` 全量通过。
- Chrome CDP 冒烟 12/12：启动、脏数据恢复、跨品种减仓、非当前品种止损、撤单幂等、100% 档位。
- `tools/build-toy.ps1 -NoZip` 通过（321 文件 / 7.15 MB）。

### 风险
- 高级委托的 API 由全局对象暴露，若引擎未加载会回退到旧的 localStorage 路径。
- `checkRisk` 现在每次行情 tick 遍历全部仓位，成本随持仓数线性增长；当前持仓规模下可接受。
- 行情加载失败时 `price` 置 0，会临时阻止下单，这是有意的。

## 2026-11-03 - 第二批：性能、网络与绑定清理

### 变更范围
行情渲染频率、外部行情失败处理、交易函数绑定。

### 具体改动
- `src/market.js`：`stats(full)` 拆分价格重绘与账户/列表重绘。
- `src/performance/runtime.js`：`flushMarketUi` 中资产/表格降到 450ms 一次。
- `src/market/external.js`：选币器关闭时跳过列表重建；observers 单例；失败负缓存 30s；响应体纳入超时。
- `src/market/extended.js`：`fetchYahoo` 的 `clearTimeout` 移到 `finally`，覆盖取体阶段。
- `src/trading/contracts.js`：`decoratePicker` 在选币器关闭时短路；`scheduleDecorate` 不再每帧调用全文档 `installChevrons()`。
- `src/futures.js` / `src/spot.js`：被覆盖的实现改为抛错 stub，保留全局绑定并注明真实实现位置。

### 验证情况
- `node --check` 全量通过。
- CDP 冒烟 6/6：启动、市价开仓、手动平仓、现货买入、隐藏选币器守卫、价格重绘。

### 风险
- `stats(false)` 不再更新账户/选币列表，依赖 450ms 慢路径与显式调用；若某处只依赖 `stats()` 的副作用，需要改用默认参数。
- 外部行情失败期间会静默 30s，不再每次渲染重试；这是有意的限流。

## 2026-11-03 - 第三批：账务口径统一

### 变更范围
合约平仓结算、资金费结算、统计页净收益。

### 具体改动
- `src/market/model.js`：`closePosition` 计算 `gross` 与 `openFeeShare`，`realized = gross - closeFee - openFeeShare`；去掉 `Math.max(0,…)`；`closedPositions` 记录 `gross` 与开仓费分摊。
- `src/trading/contracts.js`：`settleFunding` 去掉余额截断。
- `src/account.js`：`netRealized()` 去掉 `- accountStats.fees`（手续费已在 realized 内）。

### 验证情况
- CDP 冒烟 6/6：穿仓负余额、记录/统计/账本同值、合约平盘双边手续费守恒、现货买卖守恒。

### 风险
- 历史存档中的 `realizedProfit/Loss` 是旧的毛额口径，升级后净收益会略偏高（差额为历史手续费），未做数据迁移。
- 负余额会直接显示在资产页；这是有意的「穿仓可见」，但需要产品确认展示方式。

## 2026-11-03 - 第四批：纯函数层与单元测试

### 变更范围
资金计算的抽离、测试与 CI。

### 具体改动
- 新增 `src/domain/trading.js`：`liqPrice / settleClose / fundingPayment / positionPnl / notionalOf / clamp / MMR`，UMD 包装，浏览器挂 `window.GreedBitDomain`，Node 走 `module.exports`。
- 新增 `tests/domain.test.cjs`：16 个用例覆盖强平边界、盈亏符号、费用守恒、资金费符号、非法输入。
- `src/market.js`：`liqPrice` 优先委托 domain，保留旧公式兜底。
- `src/market/model.js`：`closePosition` 用 `settleClose` 计算 `gross/realized/cashDelta`。
- `src/trading/contracts.js`：`settleFunding` 用 `fundingPayment` 计算单仓资金费。
- `index.html` 在 `core.js` 之前加载 domain；CI 增加 `node --test`；构建脚本加入必需文件。

### 验证情况
- `node --test` 16/16。
- CDP 冒烟 3/3：启动加载 domain、`liqPrice` 与实际一致、`closePosition` 与 `settleClose` 一致。

### 风险
- domain 与页面实现存在两套公式（domain 优先、旧公式兜底）；后续应删除兜底分支，只保留一份。
- 新增 `tests/` 目录不参与 Toy 打包，不影响产物体积。

## 2026-11-03 - 第五批：全仓强平与杠杆上限

### 变更范围
强平价模型、杠杆上限、强平成交价。

### 具体改动
- `src/domain/trading.js`：新增 `crossLiqPrice` 与 `MAX_LEVERAGE=100`；新增 6 个单测（共 22 个）。
- `src/market.js`：`liqPrice` 增加 `selfId/sym` 参数，全仓走权益求解，逐仓保持原公式。
- `src/futures.js`：`checkRisk` 传入仓位 id/symbol，强平按触发时的标记价成交。
- `src/market/model.js`：部分平仓后重算强平价时传入 id/symbol。
- `src/ui.js`、`index.html`、`src/strategy/grid.js`：杠杆上限 200X → 100X（滑杆、刻度、网格输入）。
- `README.md`：同步 1X–100X。

### 验证情况
- `node --test` 22/22。
- CDP 冒烟 5/5：逐仓 10X 强平价仍为 90.5、全仓按权益求解、杠杆显示 100X、强平成交价 50004.8（而非理论 81450）。

### 风险
- 全仓强平价明显更近，老用户会感觉「更容易爆仓」；这是修正重复抵押后的正确结果。
- `liqPrice` 现在每次调用会取一次合约标记价（`touchBasis` 有 1.2s 节流），高频路径开销可接受。

## 2026-11-03 - 第六批：多标签页单一写入

### 变更范围
状态持久化、并发冲突、空闲写入。

### 具体改动
- `src/core.js`：新增 `stateRev` / `readStoredRev` / `ensureStateFresh` / `flagStateConflict`；`saveState` 拒绝覆盖更新的修订号并处理配额异常；`loadState` 读取修订号；监听 `storage` 事件自动跟随。
- `src/market/model.js`：`placeOrder` / `placeSpotOrder` 入口加新鲜度检查。
- `src/futures.js`、`src/spot.js`：撤单入口加检查。
- `src/trading/advanced-orders.js`：下单选与撤单加检查；`processAdvancedOrders` 只在真正变化时保存。
- `src/account.js`：入金/出金/划转入口加检查。
- `src/app/events.js`：委托表点击统一先做新鲜度检查；资金费定时器加 `bootstrap.ready` 判断，避免模块未就绪时调用 stub。
- `src/app/compatibility.js`：移除 60 秒无条件自动保存。

### 验证情况
- CDP 冒烟 7/7：修订号落后检测、陈旧下单被拒、重载后可继续交易、`saveState` 拒绝覆盖、`storage` 事件跟随。
- `node --test` 22/22、`node --check`、CI 门禁、Toy 构建全部通过。

### 风险
- 同一账户在多个标签页同时操作时，落后的一方会被拒绝一次，需要重试。
- 修订号与快照是两次 `setItem`，极端情况下（写完快照、未写修订号即崩溃）会短暂不一致。

## 2026-11-04 - 第七批：密码哈希与管理入口

### 变更范围
注册/登录、账号存档格式、管理界面权限。

### 具体改动
- 新增 `src/domain/hash.js`：同步 SHA-256 + `hashPassword(password,salt,iter)`，默认 800 轮；`tests/hash.test.cjs` 7 个用例（含 Node crypto 对照）。
- `src/core.js`：注册写 `{salt,hash,iter}`；登录校验哈希并自动迁移旧明文记录；新增 `isAdminMode()`（`?admin=1`）；`syncAuth` 不再信任会话里的 `isAdmin`。
- `src/ui.js`、`src/account.js`、`src/ui/preferences.js`、`src/news/feeds.js`：管理入口/页脚/群发统一改用 `isAdminMode()`。
- `src/app/events.js`、`index.html`：管理页文案与登录提示更新；`index.html` 增加 hash.js。
- `README.md`、`tools/build-toy.ps1`：同步说明与必需文件。

### 验证情况
- `node --test` 29/29。
- CDP 冒烟 9/9：旧明文登录迁移、错误密码拒绝、注册只存哈希、`admin/123456` 失效、无参数时管理入口隐藏、`?admin=1` 生效。

### 风险
- 旧账号必须成功登录一次才会迁移；此前导出的明文记录仍留在本地存档中。
- 管理界面现在依赖 URL 参数，普通用户不会看到入口。

## 2026-11-04 - 第八批：覆盖链文档化与 CI 校验

### 变更范围
运行时文档、CI 门禁。

### 具体改动
- `RUNTIME_AUDIT.md`：改写「当前结论」，承认函数级覆盖仍存在；新增「已知函数覆盖链」表（Top 10）与修改规则；CI 门禁与硬规则补充覆盖链条款。
- 新增 `tools/runtime-ownership.mjs`：解析 `bootstrap.js` 得到真实加载顺序，输出 50 个被覆盖全局 / 28 条多点链，并对「赋值了但从未声明」的全局报错。
- `.github/workflows/js-syntax.yml`：增加 `node tools/runtime-ownership.mjs`。

### 验证情况
- 注入一个 `someUndeclaredGlobal=function(){}` 探针，脚本按预期以 exit 1 失败并指出文件行号；删除探针后恢复通过。
- `node --test` 29/29、`node --check`、Toy 构建全部通过。

### 风险
- 静态检查只能发现「没有声明」这一类问题，无法判断某个覆盖是否真的生效；覆盖链仍是长期技术债。

## 2026-11-04 - 第九批：P2 清理（第一批）

### 变更范围
新闻翻译、数据健壮性、历史存储、版本号、可访问性、遗留迁移。

### 具体改动
- `src/app/runtime.js`：`applyNewsTranslationPolicy` 只恢复用户手动固定的「原文」，不再自动翻译整页（原来每次渲染最多 40 个第三方请求）。
- `src/news/feeds.js`、`src/ui/shell.js`：新闻投票 JSON 改用 `safeParse`。
- `src/account.js`、`src/futures.js`：`configs[...]` 查找加可选链，行情刷新期间不再抛 TypeError。
- `src/trading/contracts.js`：`updateFundingUI` 不再写全局 `fundingRate`。
- `src/market/external.js`：非法股票代码直接丢弃（不再拼进 innerHTML）；`saveSim` 包 try/catch。
- `src/performance/runtime.js`：WebSocket 补 `_gbSymbol`。
- `src/core.js`：`saveState` 给 5 个历史数组加 500 条上限；新增 `window.GB_VERSION` 单源。
- `src/strategy/grid.js`：删除「总资产≈10 万就清空钱包」的历史迁移。
- `index.html`、`src/app/events.js`、`src/ui/shell.js`、`src/trading/advanced-orders.js`：8 个模态框补 `role="dialog" aria-modal`；Esc 关闭；搜索框 aria-label。
- `CHANGELOG.md` 补 `[0.0.26]`；新增 `tools/check-version.mjs` 并接入 CI。

### 验证情况
- `node --test` 29/29、`node --check`、所有权审计、版本一致性、Toy 构建全部通过。
- CDP 冒烟 4/4：版本页脚、模态框语义 + Esc、历史上限 500、旧迁移已移除。

### 风险
- 自动翻译改为纯手动后，英文新闻需要用户自己点「翻译」。
- 历史数组截断为 500 条，超出部分不再保留在本地。

## 2026-11-04 - 第十批：P2 清理（第二批）

### 变更范围
样式缓存、定时器可见性、启动超时、回退行情基准、盘口标识。

### 具体改动
- `src/core.js`：新增 `cssHref()`（样式表统一带构建键）与 `every()`（隐藏标签页跳过周期任务，支持两种参数顺序）。
- 15 个动态注入样式表的模块：`href` 一律经 `cssHref()`，存在性判断改为 `link[href^="styles/…"]`。
- 8 个模块的 13 个 `setInterval` 改为 `every`；`performance/runtime.js` 增加 `visibilitychange` 可见时刷新。
- `src/bootstrap.js`：21 个模块串行加载增加 20 秒总超时，超时直接显示启动错误。
- `src/market/model.js`：回退/合成行情的 24H 涨跌改为按最近 24 小时基准，而非整段首根 K 线。
- `src/market.js`、`preload.js`、`model.js`、`extended.js`、`external.js`：新增 `setBookMode()`，合成深度显示「GreedBit 参考深度」，真实盘口显示「实时成交」。
- `src/trading/contracts.js`：`installChevrons` 扫描范围从全文档收窄到 `#tradePage`。

### 验证情况
- `node --test` 29/29、`node --check`、所有权审计、版本一致性、Toy 构建全部通过。
- CDP 冒烟 4/4：20 个样式表全部带 `?build=`、`every/cssHref/setBookMode` 可用、盘口标识切换正确、启动无异常。

### 风险
- 隐藏标签页的行情/策略定时器会暂停，回到前台时依赖一次刷新与下一次 tick；持仓风险检查在隐藏期间不推进。
- 20 秒启动总超时对极慢网络会提前报错，但不会再无限等待。








