# 问题排查记录

## 2026-11-03 - 高级委托撤单可无限重复退款

### 现象
下一笔计划委托 → 撤单退钱 → 下一笔成交后委托重新出现在「当前委托」→ 再撤一次，余额再次增加。

### 根因
`advanced-orders.js` 的内存数组与 `records.js` 从 localStorage 读写的数组是两份数据；引擎每笔成交后无条件 `saveV10State()` 回写，覆盖了撤单结果，而冻结金已经退过一次。

### 解决方案
内存数组作为唯一真相源；撤单统一走 `cancelAdvancedOrder`；删除 `records.js` 的 localStorage 撤单路径与引擎重复渲染的行。

### 验证方式
CDP 冒烟：下计划委托 → 撤单 → 触发一笔实时成交 → 委托不再出现；第二次撤单返回 false 且余额不变；冻结金在第一次撤单后归零。

## 2026-11-03 - 第 21 个模块静默不初始化

### 现象
交易对标题停在 `BTC/USDT`（应为 `BTCUSDT永续合约`），页脚版本 v0.0.23，`window.GreedBitRuntime` 不存在，但启动无报错。

### 排查过程
- `bootstrap.js` 在脚本 `onload` 时同步检查 `window.GreedBitV21`；
- `ui/runtime.js` 的 `GreedBitV21` 在 `finalize()` 中才赋值，而 `finalize` 依赖 CSS `load` 或 1500ms 定时器；
- `app/runtime.js` 的 `waitRuntime` 每 60ms 轮询 `GreedBitRuntimeUI`，永远等不到。

### 根因
别名映射与模块就绪时机错位，且 `bootstrap` 只对 21 个模块中的 2 个做后置校验，失败不可见。

### 解决方案
`finalize()` 内发布 `GreedBitRuntimeUI`；`app/runtime` 兼容 `GreedBitV21` 并给等待加 200 次上限。

### 验证方式
CDP 冒烟断言标题为 `BTCUSDT永续合约`、页脚为 v0.0.26。

## 2026-11-03 - 暖缓存下 contracts.js 启动竞态

### 现象
第二次加载（脚本命中缓存）时启动失败：`模块初始化不完整: src/trading/contracts.js 未导出 GreedBitContracts`。

### 根因
`GreedBitContracts` 只在 `bootWhenReady()` 里赋值，而该函数要等 `external.js` 异步注册完股票清单；冷启动时网络给了足够时间，暖缓存下不成立。

### 解决方案
在 IIFE 末尾同步导出 `GreedBitContracts`，`bootWhenReady` 只负责后续 UI/定时器初始化。

### 验证方式
CDP 冒烟在暖缓存（二次导航）下也能 `ready`，且 12/12 通过。

## 2026-11-03 - 切换交易对时在途请求覆盖新品种

### 现象
（静态分析确认，未在浏览器复现）从 BTC 切到大宗/股票/外汇时，尚未返回的 Binance K 线响应可能把 BTC 的价格写进新品种。

### 根因
请求序号 `marketLoadSeq` 只在 Binance 分支自增；`extended.js` / `external.js` 的加载分支既不递增也不校验，而写入用的是全局 `symbol`。

### 解决方案
`setSymbol` 切换时统一递增 `marketLoadSeq`；三个加载分支都捕获 `token + symbol`，在每次 `await` 后校验；写入时使用捕获的 symbol。

### 验证方式
静态检查 + `node --check`；浏览器内的跨分支竞态尚未做自动化用例，列入 backlog。

## 2026-11-03 - 删除「死代码」导致应用无法启动

### 现象
把 `futures.js` / `spot.js` 里被覆盖的 `executeOpen / placeOrder / closePosition / settleFunding / spotFill / placeSpotOrder` 删除后，启动时报 `ReferenceError: placeSpotOrder is not defined`，下单按钮失效。

### 根因
这些函数是**全局绑定目标**：`market/model.js`、`trading/records.js`、`app/compatibility.js` 都在严格模式 IIFE 里用 `placeOrder=function(){…}` 覆盖它们。严格模式下给未声明的变量赋值会抛 `ReferenceError`，所以声明必须存在；它们不是「可以删掉的死代码」，而是「不应再写逻辑的占位符」。

### 解决方案
保留函数声明，但把实现换成显式抛错的 stub，并在文件头注明真实实现位置。这样加载顺序出错时会立刻报「实现位于…」，而不是静默执行过时的费率逻辑。

### 验证方式
CDP 冒烟：启动就绪、市价开仓、手动平仓、现货买入全部通过（6/6）。

