# Vue vs React 前端功能对照表

> 对比 `frontend/`（Vue 原版）与 `frontend-react/`（React 重写）的功能覆盖情况。
> 最后更新：2026-02-27

## 总览

| 模块 | Vue | React | 差距 |
|------|-----|-------|------|
| 认证页面 | 完整 | 完整 | - |
| 管理员设置 | 完整 | 完整 | 极小 |
| 用户 Dashboard | 完整 | 有数据无图表 | 小 |
| 用户 API Keys | 完整 | 缺使用指南弹窗 | 中 |
| 用户 Profile | 完整 | 缺 TOTP 管理 | **大** |
| 管理员账号管理 | 完整 | 仅基础 CRUD | **大** |
| 管理员用户管理 | 完整 | 缺多个功能弹窗 | 中 |
| 管理员 Ops 监控 | 完整 | 仅占位符 | **很大** |
| 图表组件 | 有图表库 | 纯表格展示 | 中 |
| Turnstile 验证码 | 完整 | 状态已接但组件未渲染 | **大** |
| Simple Mode 路由守卫 | 路由级拦截 | 仅侧栏隐藏 | 小 |
| 公共组件库 | 33 个 | 4 个 + shadcn 基础 | **大** |

---

## 一、已完成（功能对等）

### 认证相关
- [x] 登录（含 TOTP 二步验证输入流程）
- [x] 注册（含邀请码、推广码校验）
- [x] 邮箱验证
- [x] 忘记密码 / 重置密码
- [x] OAuth 回调（通用 + LinuxDo）
- [x] 新手引导（driver.js，支持 admin/user 步骤区分）

### 管理员
- [x] Dashboard 概览（统计卡片 + 数据表格）
- [x] 用户管理 — 基础 CRUD（创建、编辑、删除）
- [x] 分组管理
- [x] 账号管理 — 基础 CRUD + 测试连接
- [x] 代理管理
- [x] 订阅计划管理
- [x] 公告管理
- [x] 兑换码管理
- [x] 推广码管理
- [x] 用量统计（筛选 + 分页 + CSV 导出）
- [x] 系统设置（注册、SMTP、Turnstile、LinuxDo、TOTP 开关、站点配置、流超时、管理员 API Key、引导开关）

### 用户
- [x] Dashboard（统计卡片 + 用量趋势 + 模型分布，数据齐全）
- [x] API Key 管理（创建、编辑、删除、IP 黑白名单、配额、过期时间）
- [x] 用量查看（按 Key 筛选 + 日期范围 + 分页）
- [x] 订阅列表
- [x] 购买订阅
- [x] 兑换码兑换 + 历史
- [x] 个人资料（修改用户名、修改密码）
- [x] 初始化向导（SetupWizard）

---

## 二、未完成 / 缺失清单

### 管理员 Ops 监控面板 `严重`

Vue 有 19 个子组件，React 仅有一个开关和占位符。

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| 吞吐量趋势图 | OpsThroughputTrendChart | 缺失 |
| 延迟分布图 | OpsLatencyChart | 缺失 |
| 错误趋势图 | OpsErrorTrendChart | 缺失 |
| 错误分布图 | OpsErrorDistributionChart | 缺失 |
| 账号切换率趋势 | OpsSwitchRateTrendChart | 缺失 |
| 并发状态卡片 | OpsConcurrencyCard | 缺失 |
| OpenAI Token 统计 | OpsOpenAITokenStatsCard | 缺失 |
| 错误日志表 | OpsErrorLogTable | 缺失 |
| 错误详情弹窗 | OpsErrorDetailModal / OpsErrorDetailsModal | 缺失 |
| 请求详情弹窗 | OpsRequestDetailsModal | 缺失 |
| 告警规则管理 | OpsAlertRulesCard | 缺失 |
| 告警事件列表 | OpsAlertEventsCard | 缺失 |
| 邮件通知配置 | OpsEmailNotificationCard | 缺失 |
| 运行时设置 | OpsRuntimeSettingsCard / OpsSettingsDialog | 缺失 |
| 系统日志表 | OpsSystemLogTable | 缺失 |
| 仪表盘骨架屏 | OpsDashboardSkeleton | 缺失 |

### 管理员账号管理 `严重`

React 仅有基础的创建/编辑/删除/测试，缺少高级功能。

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| OAuth 授权流程（Anthropic/OpenAI/Gemini/Antigravity） | OAuthAuthorizationFlow | 缺失 |
| 重新授权弹窗 | ReAuthAccountModal | 缺失 |
| 批量编辑（字段级） | BulkEditAccountModal | 缺失（仅有批量删除） |
| 模型白名单选择器 | ModelWhitelistSelector | 缺失 |
| 从 CRS 同步导入 | SyncFromCrsModal | 缺失 |
| 账号统计详情弹窗 | AccountStatsModal | 缺失 |
| 临时取消调度弹窗 | TempUnschedStatusModal | 缺失 |
| 容量/用量进度展示 | AccountCapacityCell / AccountUsageCell / UsageProgressBar | 缺失 |
| 平台特定凭证构建 | credentialsBuilder.ts | 缺失 |

### 用户 Profile TOTP 管理 `严重`

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| TOTP 状态卡片 | ProfileTotpCard | 缺失 |
| TOTP 设置弹窗（QR 码 + 验证） | TotpSetupModal | 缺失 |
| TOTP 关闭确认 | TotpDisableDialog | 缺失 |

> 用户在 React 前端无法启用/关闭两步验证。登录时的 TOTP 输入流程已实现。

### Turnstile 验证码 `严重`

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| Cloudflare Turnstile 组件 | TurnstileWidget.vue | 缺失（状态已声明但无渲染） |

> React 的 LoginView/RegisterView 读取了 `turnstileEnabled` 设置并维护 `turnstileToken` 状态，但没有实际渲染 Turnstile widget，因此即使管理员开启了 Turnstile，React 前端也无法正常工作。

### 管理员用户管理 `中等`

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| 余额调整弹窗 | UserBalanceModal | 缺失 |
| 余额变动历史 | UserBalanceHistoryModal | 缺失 |
| 查看用户 API Keys | UserApiKeysModal | 缺失 |
| 用户分组权限配置 | UserAllowedGroupsModal | 缺失 |

### Key 使用指南弹窗 `中等`

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| 平台/CLI 使用说明 + 代码片段 | UseKeyModal（按 Anthropic/OpenAI/Gemini/Antigravity 分 tab） | 缺失 |

### 图表可视化 `中等`

| 功能 | Vue 组件 | React 状态 |
|------|----------|------------|
| 模型分布饼图 | ModelDistributionChart | 纯 HTML 表格 |
| Token 用量趋势折线图 | TokenUsageTrend | 纯 HTML 表格 |

> React 的数据获取和展示逻辑完整，但以表格代替图表。需引入图表库（如 Recharts）。

### Simple Mode 路由守卫 `小`

| 功能 | Vue | React |
|------|-----|-------|
| 路由级拦截 | `beforeEach` 守卫阻止直接访问 | 仅侧栏隐藏菜单项，URL 直接访问不受限 |

### 公共组件抽取 `小`

Vue 有 33 个通用组件，React 多数逻辑内联在各 View 中。不影响功能但影响代码复用：

- DataTable（可排序/筛选分页表格）
- Pagination（通用分页器）
- ConfirmDialog / BaseDialog（通用弹窗封装）
- GroupSelector / ProxySelector（多选选择器）
- GroupBadge / StatusBadge / PlatformIcon / ModelIcon（展示组件）
- EmptyState / LoadingSpinner / NavigationProgress
- SearchInput / HelpTooltip / ExportProgressDialog

### Hooks 抽取 `小`

Vue 有 12 个 composable，React 仅 2 个 hook。以下逻辑存在但未提取为独立 hook：

| Vue Composable | React 等价 | 状态 |
|----------------|-----------|------|
| useAccountOAuth / useAntigravityOAuth / useGeminiOAuth / useOpenAIOAuth | — | 缺失（OAuth 流程整体缺失） |
| useClipboard | — | 内联在 KeysView |
| useForm | @tanstack/react-form | 已由库替代 |
| useModelWhitelist | — | 缺失（功能缺失） |
| useTableLoader | — | 内联在各 View |
| useKeyedDebouncedSearch | — | 内联在 UsersView |
| useRoutePrefetch | — | 缺失 |
| useNavigationLoading | — | 缺失 |

---

## 三、建议优先级

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | Turnstile 验证码组件 | 开启后会导致 React 前端无法登录/注册 |
| P0 | Profile TOTP 管理 | 用户无法在 React 前端管理两步验证 |
| P1 | 账号 OAuth 授权流程 | Anthropic/Gemini 等 OAuth 账号无法在 React 前端添加/重新授权 |
| P1 | 账号模型白名单 | 无法在 React 前端配置模型过滤 |
| P1 | Simple Mode 路由守卫 | 安全缺陷，URL 直接访问可绕过限制 |
| P2 | Ops 监控面板 | 功能完全缺失，但不影响核心业务 |
| P2 | 用户管理高级功能 | 余额调整、Keys 查看等可在 Vue 端操作 |
| P2 | Key 使用指南 | 改善用户体验 |
| P3 | 图表可视化 | 数据已有，仅展示形式差异 |
| P3 | 公共组件 / Hooks 抽取 | 代码质量改善，不影响功能 |
