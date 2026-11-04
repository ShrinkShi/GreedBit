# 开发时间线

## 2026-11-03 22:40 - 全量代码审查

### 用户目标
- 检查本地 GreedBit v0.0.26 项目并做代码审查。

### 本轮处理
- 全量静态阅读 30 个 JS 文件（约 3,500 行）、22 个 CSS、335 个资源。
- 追踪 bootstrap 加载顺序与实际生效的函数覆盖链。
- 输出 `CODE_REVIEW.md`：7 项 P0、13 项 P1、23 项 P2。

### 关键结论
- 运行时是「后加载覆盖同名全局」的补丁链，`futures.js` / `spot.js` 的核心交易函数已被 `market/model.js`、`app/compatibility.js` 覆盖。
- 存在两条可无限复制造钱的路径（高级委托撤单重复退款、跨品种平仓错价）。
- 第 21 个模块 `app/runtime.js` 因别名时序问题永不初始化。

### 影响文件
- 无直接文件修改（新增 `CODE_REVIEW.md`）。

## 2026-11-03 23:00 - 第一批 P0/P1 修复

### 用户目标
- 开启完全访问后，按审查报告着手修复。

### 本轮处理
- 修复 6 个 P0 中的 5 个（P0-1、P0-3 除外）与 7 个 P1。
- 用 `node --check`、Chrome CDP 冒烟（12/12）、Toy 打包预检验证。

### 关键结论
- 暖缓存下 `contracts.js` 的后置校验存在冷启动竞态，改为同步导出 `GreedBitContracts`。
- 高级委托的「内存数组 + localStorage 双写」是造钱根因，收敛为内存单一真相源。

### 影响文件
- `src/trading/advanced-orders.js`、`src/trading/records.js`、`src/trading/contracts.js`、`src/market/model.js`、`src/futures.js`、`src/core.js`、`src/app/*`、`src/ui/runtime.js`、`src/market/{preload,external,extended}.js`、`src/performance/*`、`index.html`、`tools/build-toy.ps1`，删除 `src/market/stock-manifest-preload.js`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-03 23:20 - 第二批 P1 修复（性能与网络）

### 用户目标
- 继续修复。

### 本轮处理
- P1-6：行情 tick 只重绘价格；资产/表格降到 450ms；选币器关闭时不重建；装饰器不再逐帧扫描。
- P1-12：外部行情失败负缓存、observer 单例、响应体读取纳入超时。
- P0-1：把被覆盖的旧交易实现改为显式 stub，保留全局绑定。

### 关键结论
- 那些「死代码」其实是严格模式覆盖赋值所需的全局绑定，直接删除会导致 `ReferenceError` 和应用启动失败。

### 影响文件
- `src/futures.js`、`src/spot.js`、`src/market.js`、`src/market/external.js`、`src/market/extended.js`、`src/performance/runtime.js`、`src/trading/contracts.js`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-03 23:40 - 第三批：账务口径统一

### 用户目标
- 继续修复。

### 本轮处理
- P0-3：平仓与资金费去掉 `Math.max(0,…)`，亏损超过余额时余额为负。
- P1-14：合约已实现盈亏改为净额（扣开仓费分摊 + 平仓费）；`netRealized()` 不再二次扣手续费。

### 关键结论
- 现货的 `realized` 本来就是净额、`fees` 只是聚合，旧公式 `- fees` 属于重复扣减；合约则相反（毛额 + 费用另计），两边必须统一成净额。
- 负余额后，转账/下单/出金的余额校验天然会拦住操作，不需要额外分支。

### 影响文件
- `src/market/model.js`、`src/trading/contracts.js`、`src/account.js`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-03 23:55 - 第四批：纯函数层与单元测试

### 用户目标
- 继续修复。

### 本轮处理
- 新增 `src/domain/trading.js`：强平价、平仓结算、资金费、PnL，全部无 DOM / 无随机。
- 新增 `tests/domain.test.cjs` 16 个用例；CI 增加 `node --test`。
- `market.js` 的 `liqPrice`、`model.js` 的 `closePosition`、`contracts.js` 的 `settleFunding` 改为优先调用 domain 层，保留旧公式兜底。

### 关键结论
- 抽离后才发现旧强平价公式在 `notional<1` 时用 1 USDT 作分母、200X 时强平价等于开仓价等边界，全部固化成了测试用例。

### 影响文件
- `src/domain/trading.js`、`tests/domain.test.cjs`、`src/market.js`、`src/market/model.js`、`src/trading/contracts.js`、`index.html`、`.github/workflows/js-syntax.yml`、`tools/build-toy.ps1`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-04 00:10 - 第五批：全仓强平与杠杆上限

### 用户目标
- 继续修复。

### 本轮处理
- 全仓强平价改为按账户权益一次性求解（`crossLiqPrice`），不再给每个仓位重复加可用余额。
- 杠杆上限 200X → 100X（UI、网格、README 同步）。
- 强平成交价改为触发时的标记价，而非理论强平价。
- 单价测试从 16 增至 22。

### 关键结论
- 旧公式在 200X 时强平价 = 开仓价，属于设计缺陷；上限必须低于 `1/MMR`。

### 影响文件
- `src/domain/trading.js`、`tests/domain.test.cjs`、`src/market.js`、`src/futures.js`、`src/market/model.js`、`src/ui.js`、`index.html`、`src/strategy/grid.js`、`README.md`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-04 00:35 - 第六批：多标签页单一写入

### 用户目标
- 继续修复。

### 本轮处理
- `saveState` 增加修订号冲突检测；落后标签页拒绝写入并重载。
- 下单/撤单/划转/出入金入口统一做新鲜度检查。
- `storage` 事件同步其他标签页的状态。
- 去掉空闲 tick 与 60 秒定时器的无条件保存；资金费定时器等启动就绪后再跑。

### 关键结论
- 「没改也保存」会让多标签冲突检测失效，必须先让保存只发生在真正变化之后。

### 影响文件
- `src/core.js`、`src/market/model.js`、`src/futures.js`、`src/spot.js`、`src/trading/advanced-orders.js`、`src/account.js`、`src/app/events.js`、`src/app/compatibility.js`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-04 12:30 - 第七批：密码哈希与管理入口

### 用户目标
- 继续修复。

### 本轮处理
- 新增同步 SHA-256 的 `src/domain/hash.js`，注册/登录改为加盐哈希，旧明文记录自动迁移。
- 删除 `admin/123456` 与 `isAdmin` 会话字段，管理界面改为 `?admin=1` 开发开关。
- 单测从 22 增至 29。

### 关键结论
- 纯前端也不该存明文口令；权限字段不能来自用户可编辑的存档。

### 影响文件
- `src/domain/hash.js`、`tests/hash.test.cjs`、`src/core.js`、`src/ui.js`、`src/account.js`、`src/ui/preferences.js`、`src/news/feeds.js`、`src/app/events.js`、`index.html`、`README.md`、`tools/build-toy.ps1`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-04 12:45 - 第八批：覆盖链文档化与 CI 校验

### 用户目标
- 继续修复。

### 本轮处理
- `RUNTIME_AUDIT.md` 如实记录函数覆盖机制与 Top 10 覆盖链。
- 新增 `tools/runtime-ownership.mjs`，按真实加载顺序输出覆盖链，并在「赋值未声明」时失败。
- CI 增加该脚本。

### 关键结论
- 覆盖链不能靠文档自律，必须有可执行校验；静态检查至少能守住「删声明导致启动崩溃」这类事故。

### 影响文件
- `RUNTIME_AUDIT.md`、`tools/runtime-ownership.mjs`、`.github/workflows/js-syntax.yml`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-04 12:40 - 第九批：P2 清理（第一批）

### 用户目标
- 继续清 P2。

### 本轮处理
- 停掉新闻页自动批量翻译（改为只恢复用户固定偏好）。
- 收口 JSON 解析、`configs` 可选链、合成行情写盘异常、WebSocket 符号标记。
- 历史数组加 500 上限；删除危险的历史种子迁移。
- 8 个模态框补 dialog 语义 + Esc 关闭 + 搜索框 aria-label。
- 版本号单源化（`GB_VERSION`）并新增 `tools/check-version.mjs`；补 `[0.0.26]` CHANGELOG。

### 关键结论
- 「自动翻译」本质是把渲染事件变成第三方请求放大器；默认行为应只读、不写外部。
- 版本号分散在 6 个常量里，靠人同步必然漂移，必须脚本化。

### 影响文件
- `src/app/runtime.js`、`src/news/feeds.js`、`src/ui/shell.js`、`src/account.js`、`src/futures.js`、`src/trading/contracts.js`、`src/market/external.js`、`src/performance/runtime.js`、`src/core.js`、`src/strategy/grid.js`、`index.html`、`CHANGELOG.md`、`tools/check-version.mjs`、`.github/workflows/js-syntax.yml`。

### 后续事项
- 见 `backlog.md`。

## 2026-11-04 12:50 - 第十批：P2 清理（第二批）

### 用户目标
- 继续清 P2。

### 本轮处理
- 15 个动态注入 CSS 统一带构建键，选择器改前缀匹配。
- 13 个周期任务改用 `every()`：隐藏标签页不执行，回到前台刷新一次。
- bootstrap 增加 20 秒总启动超时。
- 回退行情 24H 涨跌改为最近 24 小时基准；合成盘口显示「GreedBit 参考深度」。
- chevron 扫描收窄到交易页。

### 关键结论
- 缓存键必须覆盖所有资源入口，不能只覆盖 `index.html` 里的 5 个样式表。
- 后台标签页暂停任务比继续跑更符合预期，但需要可见时的补偿刷新。

### 影响文件
- `src/core.js`、`src/market.js`、`src/market/preload.js`、`src/market/model.js`、`src/market/extended.js`、`src/market/external.js`、`src/bootstrap.js`、`src/performance/runtime.js`、`src/trading/contracts.js` 及 15 个注入样式的模块。

### 后续事项
- 见 `backlog.md`。









## 2026-11-04 13:05 - 图表网格改为坐标锚定 + v0.1.0

### 用户目标
- 网格线跟随拖动/缩放；发布 v0.1.0 并打 Toy 包。

### 本轮处理
- 找到真正生效的 draw 在 `ui/preferences.js`（覆盖 renderer），把像素等分网格改为价格/时间刻度。
- 时间轴标签减为 6 条并居中，修复右侧重叠。
- 版本号统一到 0.1.0。

### 关键结论
- `renderer.js` 的 draw 会被 `preferences.js` 覆盖；改图表必须改后者。

### 影响文件
- `src/ui/preferences.js`、`VERSION`、`src/core.js`、`src/bootstrap.js`、`index.html`、`README.md`、`CHANGELOG.md`、`tools/check-version.mjs`。

### 后续事项
- Toy 预览环境验证。
## 2026-11-04 13:25 - 网格密度翻倍

### 用户目标
- 网格线密度加到现在的两倍。

### 本轮处理
- 价格刻度目标 5 -> 10，时间刻度 6 -> 12。
- 时间标签改为「不重叠才绘制」，避免密度翻倍后文字重叠。

### 关键结论
- 自适应 nice step 下「目标数翻倍」不等于线数严格翻倍；本次用像素间距核对，价格线由 3 条变 5 条（间距 110px -> 55px），时间线 6 条变 12 条，符合两倍密度预期。

### 影响文件
- `src/ui/preferences.js`。

### 后续事项
- 重新打 Toy 包并在 Preview 验证。