# GreedBit × Bilibili Toy 兼容性验收

验收日期：2026-11-02

目标：确认 GreedBit 作为**纯前端静态项目**部署到 Bilibili Toy 的可行性，并明确哪些项目已经静态通过、哪些必须在 Toy 真实预览中验证。

## 结论

**静态结构：通过。**

GreedBit 当前适合按静态文件夹 / ZIP 的方式上传 Bilibili Toy，没有发现必须依赖自建后端或数据库的功能。

**最终上线结论：待 Toy 真实预览。**

当前唯一不能靠仓库静态检查证明通过的核心风险，是 Toy 页面运行环境对第三方网络请求的实际放行情况，尤其是 Binance REST / WebSocket 与资讯跨域请求。

## 项目架构结论

GreedBit 定性为纯前端项目：

```text
Bilibili Toy / Browser
│
├─ index.html
├─ CSS / JavaScript / PNG
├─ localStorage
│  ├─ 本地账号
│  ├─ 模拟资产
│  ├─ 持仓 / 订单 / 成交
│  ├─ 通知
│  ├─ 用户头像
│  └─ 图表与界面设置
│
└─ 公共第三方接口
   ├─ Binance Spot REST
   ├─ Binance Spot WebSocket
   ├─ Binance Futures REST / WebSocket
   ├─ Frankfurter 汇率接口
   └─ CoinDesk RSS / 浏览器跨域代理
```

不规划：

- Node.js / Java / Python 自建服务端。
- SQLite / MySQL / PostgreSQL 自建数据库。
- 服务端账号鉴权。
- 服务端行情代理。
- 将 Secret / API Key 写入前端。

如果未来使用 Bilibili Toy 官方云存储，它只作为平台原生的低频存档能力，不改变“无自建后端”的项目定位。

## Toy 官方规则对照

### 1. 入口文件

状态：**PASS**

- 仓库根目录存在唯一 `index.html`。
- 当前 `index.html` 大约 17 KB，远低于 Toy 对入口 `index.html` 的 1 MB 解压后硬上限。
- 没有多个一级入口 HTML 造成包根歧义。

### 2. 子路径资源

状态：**PASS**

Toy 页面最终运行在：

```text
/toy/<slug>/index.html
```

因此包内资源不能使用：

```text
/assets/app.js
/styles/app.css
```

GreedBit 当前入口使用：

```text
styles/base.css
src/core.js
src/market.js
...
```

运行时动态加载也使用：

```text
styles/v009.css
styles/v010.css
styles/v011.css
assets/greedbit-logo.png
assets/default%20avatar.png
```

这些都是相对于当前 Toy 文档的路径，可在 `/toy/<slug>/` 下解析。

### 3. 路由

状态：**PASS**

GreedBit 不使用 history 路由，不会生成 `/trade`、`/assets` 等需要服务器回退的真实路径。

主页、行情、交易、合约、资产、管理等页面全部是同一个 `index.html` 中的 DOM 区块，通过 JavaScript 切换显示，因此刷新时不会要求 Toy 提供额外 HTML 路由。

### 4. 包体内容

状态：**PASS / 建议使用专用包**

项目本身没有 `node_modules`、构建产物依赖或服务端文件。

仍不建议把整个 Git 仓库上传 Toy。使用：

```powershell
.\tools\build-toy.ps1
```

生成只包含：

```text
index.html
assets/
styles/
src/
```

的 `GreedBit-toy.zip`。

### 5. contenthash

状态：**INFO，不阻断**

当前 GreedBit 是手写静态项目，JS / CSS 文件名没有构建指纹，例如：

```text
src/core.js
styles/trading.css
```

Toy 可以正常发布；缺点是更新后 CDN 复用效率不如带 contenthash 的构建产物。

现阶段不为了这一点引入 Vite / Webpack，避免把简单静态项目复杂化。

### 6. localStorage

状态：**PASS，产品限制**

GreedBit 所有模拟账号与交易数据均保存在浏览器 `localStorage`。

优点：

- 完全纯前端。
- 无服务器成本。
- Toy 页面刷新后可继续读取本地存档。

限制：

- 换设备 / 换浏览器不能自动同步。
- 清理站点数据可能丢档。
- 本地账号不是安全认证系统。
- `admin / 123456` 只是本地演示入口，不是安全管理员账号。

后续优先增加存档导出 / 导入，而不是建设后端。

### 7. 用户上传头像

状态：**PASS**

头像只在浏览器中读取：

1. 用户选择本地 PNG / JPEG / WebP。
2. Canvas 居中裁剪为正方形。
3. 缩放到 256×256。
4. 压缩为 WebP Data URL。
5. 保存到当前浏览器 `localStorage`。

不依赖服务器上传接口。

### 8. 外部网络：Binance Spot

状态：**STATIC PASS / PREVIEW REQUIRED**

代码使用 Binance 无需密钥的公开市场数据端点，并配置多个 REST 与 WebSocket 备用节点。

Spot 公共市场数据本身不需要 API Key；但 Toy 页面是否会被平台 CSP、浏览器网络策略、地区网络或目标站点 CORS 限制，只能在 Toy 真实预览中确认。

预览必须检查：

- 首屏 500 根 K 线是否加载。
- BTC / ETH 24H ticker 是否加载。
- `data-stream.binance.vision` WebSocket 是否连接。
- `stream.binance.com` 备用 WebSocket 是否可连接。
- 100ms 深度流是否持续更新。
- 向左拖动后历史补载是否成功。

### 9. 外部网络：Binance Futures

状态：**PREVIEW REQUIRED**

合约“数据”和“实时成交”依赖 Binance USDⓈ-M Futures 公共 REST / WebSocket。

Toy 预览必须检查：

- `fapi.binance.com` 公共数据请求。
- Futures 实时成交 WebSocket。
- 资金费率、持仓量、多空比等数据面板。

失败时不应影响 Spot 主行情与本地模拟账户基本操作。

### 10. 汇率

状态：**PASS WITH FALLBACK / PREVIEW REQUIRED**

折算货币尝试访问公开汇率接口；代码已有：

- 网络刷新。
- `localStorage` 缓存。
- 内置近似汇率 fallback。

即使 Toy 阻止汇率接口，也不会阻断 BTC / ETH USDT 行情和交易模拟。

### 11. CoinDesk RSS / 跨域代理

状态：**WARN / PREVIEW REQUIRED**

这是当前 Toy 部署中风险最高的附属功能之一。

RSS 通常不能直接从浏览器跨域读取，因此 GreedBit 使用浏览器跨域代理回退方案。第三方代理的 CORS、稳定性和 Toy CSP 都可能变化。

要求：

- 资讯加载失败不能导致页面白屏。
- 资讯失败不能影响行情、图表和交易模拟。
- Toy 预览中单独验证“行情”页刷新快讯。

如果公开 Toy 环境长期不稳定，优先降级或移除资讯模块，而不是为资讯功能建设后端。

## 真实 Toy 预览验收清单

### 页面 / 静态资源

- [ ] Toy 预览能打开 `index.html`，无白屏。
- [ ] Logo 正常。
- [ ] 默认头像正常。
- [ ] 所有 CSS 正常。
- [ ] 浏览器控制台没有包内资源 404。
- [ ] 刷新 Toy 页面仍能进入应用。

### 行情

- [ ] BTC/USDT 首屏 K 线加载。
- [ ] ETH/USDT 首屏 K 线加载。
- [ ] Spot WebSocket 显示“真实行情已连接”。
- [ ] 盘口持续更新。
- [ ] 实时成交驱动当前 K 线。
- [ ] 价格心跳动画正常。
- [ ] 历史 K 线补载正常。

### 合约公共数据

- [ ] 合约概况页正常。
- [ ] 合约数据页 REST 请求正常。
- [ ] Futures 实时成交正常。

### 本地存档

- [ ] 注册一个测试账号。
- [ ] 模拟入金 / 划转 / 下单。
- [ ] 刷新 Toy 后数据仍存在。
- [ ] 修改头像后刷新仍存在。
- [ ] 图表设置刷新后仍存在。

### 移动端 / Bilibili App

- [ ] Toy 在 Bilibili App 内可打开。
- [ ] 页面没有横向严重溢出。
- [ ] 主要按钮可点击。
- [ ] K 线触控不会完全阻断页面操作。
- [ ] 登录弹窗、账户菜单、图表设置可正常关闭。

### 附属网络功能

- [ ] 汇率接口成功，或正确回退缓存 / 内置汇率。
- [ ] CoinDesk 快讯成功加载，或失败时正常降级。

## 验收等级

当前：**STATIC READY / PREVIEW PENDING**

即：

- 包结构：可以进入 Toy 预览阶段。
- 自建后端：不需要，也不规划。
- 正式发布：必须先通过 Toy preview 的网络与移动端验收。

## 发布原则

1. 先运行 `tools/build-toy.ps1`。
2. 再运行 Bilibili 官方 `toy_doctor.py` 对 `GreedBit-toy.zip` 做预检。
3. ERROR 必须修复。
4. WARN 必须人工确认。
5. 先生成 Toy preview，不直接提交审核。
6. 桌面端与 Bilibili App 都检查完，再提交审核。
