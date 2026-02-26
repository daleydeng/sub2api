# Sub2API — React 前端 Fork

> Fork 自 [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api)。
> 上游 README → [README.md](README.md) | [English](README_FORK.md)

## 与上游的区别

本 fork 新增了 **React 19 重写的前端**（`frontend-react/`），同时保留原有 Vue 前端。两套前端均编译到 `backend/internal/web/dist/`，嵌入 Go 单二进制。

### 技术栈（React 前端）

| 层级 | 选型 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 (beta) + React Compiler |
| 路由 | TanStack Router v1 |
| 数据请求 | TanStack React Query v5 |
| 表单 | TanStack Form v1 + Zod |
| 状态管理 | Zustand v5 |
| UI | Radix UI + shadcn/ui + Tailwind CSS 4 |
| 国际化 | react-i18next（中文 / 英文） |
| 新手引导 | driver.js 交互式引导 |

### 其他 Fork 改动

- **Justfile** — 双前端命令（`fe-vue-*` / `fe-react-*`）、embed 构建目标
- **pixi** — 可复现工具链（Node 24、Go 1.25、pnpm 10）
- **`onboarding_enabled`** — 系统设置，控制新用户登录后是否自动弹出引导教程
- **Podman Compose** 开发工作流，一键启动 PostgreSQL + Redis

## 快速开始

### 前置依赖

- [pixi](https://pixi.sh)（自动管理 Node、Go、pnpm）
- [just](https://just.systems)（命令运行器）
- PostgreSQL 15+ 和 Redis 7+（或通过 `just dev-up` 使用 Podman 启动）

### 开发

```bash
# 启动开发数据库（Podman 容器：PostgreSQL + Redis）
just dev-up

# 首次初始化（建表 + 创建管理员账户）
just dev-install

# 启动后端
just be-dev

# 另开终端 — 启动 React 前端开发服务器（:3000）
just fe-react-install
just fe-react-dev
```

### 构建

```bash
# React embed 二进制（前端 + Go 打包为单文件）
just build-embed-react

# 运行
just serve-react              # 默认 :8081
just serve-react port=9000    # 自定义端口

# Vue embed 二进制（原版前端）
just build-embed-vue
just serve-vue
```

### 查看所有命令

```bash
just --list
```

## 项目结构

```
sub2api/
├── backend/                 # Go 后端（两套前端共用）
├── frontend/                # Vue 3 前端（上游原版）
├── frontend-react/          # React 19 前端（本 fork 新增）
│   └── src/
│       ├── api/             # API 客户端（对应后端接口）
│       ├── components/      # shadcn/ui 组件 + 布局
│       ├── hooks/           # 自定义 Hooks（引导、主题等）
│       ├── i18n/            # 中英文翻译
│       ├── router/          # TanStack Router 路由配置
│       ├── stores/          # Zustand 状态管理（auth、app、settings）
│       ├── types/           # 共享 TypeScript 类型
│       ├── views/           # 页面组件
│       │   ├── admin/       # 管理后台页面
│       │   ├── auth/        # 登录、注册、OAuth、密码重置
│       │   ├── setup/       # 初始化向导
│       │   └── user/        # 用户面板页面
│       └── utils/           # 工具函数
├── deploy/                  # Docker / Podman / systemd 部署配置
├── Justfile                 # 任务命令
└── pixi.toml                # 可复现工具链配置
```

## 同步上游

```bash
git fetch upstream main
git merge upstream/main
# 如有冲突则解决，然后推送
git push
```

## 许可证

MIT — 与上游一致。
