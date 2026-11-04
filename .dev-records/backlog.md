# Backlog

## 待处理

- [ ] 删除 `liqPrice` / `closePosition` / `settleFunding` 里的旧公式兜底分支，只保留 domain 一份实现。
- [ ] 逐步消除函数覆盖链：优先收敛 `setSymbol` / `renderBook` / `showPage` / `syncAuth`。
- [ ] 补一个真实的双标签页自动化用例（当前用修订号模拟验证）。
- [ ] 把 CDP 冒烟脚本固化进 `tools/` 并接入 CI（需要无头浏览器）。
- [ ] 资产页对负余额（穿仓）增加明确标识与提示文案。
- [ ] `tools/build-toy.ps1` 增加 `#requires -Version 7` 或改 UTF-8 读取，避免 5.1 误报。
- [ ] P2-20：`ui/home.js` / `account.js` 旧新闻栈等死代码整理。
- [ ] P2-30：网格引擎的亏损截断、静默跳过与费率口径。

## 已放弃

## 已完成

- [x] P0-1 交易函数绑定清理（保留声明 + 抛错 stub）
- [x] P0-2 风控覆盖全部仓位
- [x] P0-3 穿仓允许负余额
- [x] P0-4 `app/runtime` 初始化
- [x] P0-5 切换品种请求令牌
- [x] P0-6 高级委托撤单单一真相源
- [x] P0-7 平仓价格契约
- [x] P1-4 加载失败清空序列
- [x] P1-5 脏 localStorage 容错
- [x] P1-6 行情渲染降频
- [x] P1-7 密码哈希 + 管理入口改开发开关
- [x] P1-8 覆盖链文档化 + CI 所有权校验
- [x] P1-9 删除 fetch 劫持
- [x] P1-10 纯函数层 + `node:test` + CI
- [x] P1-11 Worker 降级与握手
- [x] P1-12 外部行情负缓存与超时
- [x] P1-13 高级委托触发返回值与费率
- [x] P1-14 手续费与已实现盈亏口径统一
- [x] P1-15 多标签页单一写入
- [x] P1-16 全仓强平按账户权益 + 杠杆上限 100X
- [x] P2-11 / P2-19 / P2-29
- [x] P2-12 动态 CSS 构建键
- [x] P2-13 版本号单源 + `tools/check-version.mjs`
- [x] P2-14 补 `[0.0.26]` CHANGELOG
- [x] P2-15 历史数组上限 500
- [x] P2-16 定时器可见性暂停
- [x] P2-17 新闻翻译改为纯手动
- [x] P2-18 chevron 扫描收窄
- [x] P2-21 启动 20 秒总超时
- [x] P2-22 模态框 dialog 语义 + Esc + 搜索框 label
- [x] P2-23 非法股票代码直接丢弃
- [x] P2-24 WebSocket `_gbSymbol`
- [x] P2-25 回退行情 24H 涨跌基准
- [x] P2-26 合成盘口标识
- [x] P2-27 新闻投票 JSON 走 `safeParse`
- [x] P2-28 合成行情存档 try/catch
- [x] P2-31 移除危险的历史种子迁移
- [x] P2-32 `configs` 可选链
- [x] P2-33 资金费不再写全局费率
