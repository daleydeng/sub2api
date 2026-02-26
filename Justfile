# sub2api Justfile — 直接用 `just <recipe>` 执行
# node/go/pnpm 由 pixi 提供，just/cargo 在系统 PATH

set dotenv-path := "deploy/.env"

proxy := "http_proxy=http://127.0.0.1:7897 https_proxy=http://127.0.0.1:7897"

# 默认列出所有 recipes
default:
    @just --list

# ── 环境 ──────────────────────────────────────────

# 安装系统依赖（podman）
sys-install:
    sudo dnf install -y podman

# ── 开发基础设施（PostgreSQL + Redis）─────────────

# 启动开发所需的数据库服务
dev-up:
    {{ proxy }} pixi run podman-compose -f deploy/docker-compose-test.yml up -d postgres redis

# 停止数据库服务
dev-down:
    pixi run podman-compose -f deploy/docker-compose-test.yml down

# 首次安装（建表 + 创建管理员账户），直接调用 Go，无需后端进程在线
[working-directory('backend')]
dev-install:
    pixi run go run ./cmd/install

# 重置数据库（删除卷后重启，会重新初始化）
dev-reset-db:
    just dev-down
    podman volume rm -f deploy_postgres_data
    rm -f backend/.installed backend/config.yaml
    just dev-up

# 完整重置：重置 DB + 直接安装（无需启停后端）
dev-fresh:
    just dev-reset-db
    just dev-install
    @echo "Done! Run 'just be-dev' to start the backend."

# 清理残留容器和镜像
dev-clean:
    podman rm -f sub2api-postgres sub2api-redis || true
    podman system prune -f

# ── 开发服务器 ────────────────────────────────────

# 启动后端开发服务器
[working-directory('backend')]
be-dev:
    {{ proxy }} pixi run go run ./cmd/server

# ── 前端（Vue）─────────────────────────────────────

# 安装 Vue 前端依赖
fe-vue-install:
    pixi run pnpm --dir frontend install

# 启动 Vue 前端开发服务器
fe-vue-dev:
    pixi run pnpm --dir frontend run dev

# 编译 Vue 前端
build-fe-vue:
    pixi run pnpm --dir frontend run build

# Vue 前端 lint + 类型检查
test-fe-vue:
    pixi run pnpm --dir frontend run lint:check
    pixi run pnpm --dir frontend run typecheck

# ── 前端（React）───────────────────────────────────

# 安装 React 前端依赖
fe-react-install:
    pixi run pnpm --dir frontend-react install

# 启动 React 前端开发服务器
fe-react-dev:
    pixi run pnpm --dir frontend-react run dev

# 编译 React 前端（输出到 backend/internal/web/dist/）
build-fe-react:
    pixi run pnpm --dir frontend-react run build

# React 前端 lint + 类型检查
test-fe-react:
    pixi run pnpm --dir frontend-react run lint
    pixi run pnpm --dir frontend-react run build

# ── 构建 ──────────────────────────────────────────

# 编译前后端（默认 Vue）
build: build-backend build-fe-vue

# 编译后端（不嵌入前端）
[working-directory('backend')]
build-backend:
    pixi run go build -o bin/server ./cmd/server

# ── 嵌入构建（前端 + Go 单二进制）─────────────────

# Vue 版：构建前端 + Go embed 单二进制
[working-directory('backend')]
build-embed-vue: build-fe-vue
    pixi run go build -tags embed -ldflags="-s -w" -o bin/server-vue ./cmd/server

# React 版：构建前端 + Go embed 单二进制
[working-directory('backend')]
build-embed-react: build-fe-react
    pixi run go build -tags embed -ldflags="-s -w" -o bin/server-react ./cmd/server

# ── 运行 embed 二进制 ─────────────────────────────

# 运行 Vue embed 二进制，可指定端口：just serve-vue port=9000
[working-directory('backend')]
serve-vue port="8081": build-embed-vue
    SERVER_PORT={{ port }} ./bin/server-vue

# 运行 React embed 二进制，可指定端口：just serve-react port=9000
[working-directory('backend')]
serve-react port="8081": build-embed-react
    SERVER_PORT={{ port }} ./bin/server-react

# ── 测试 ──────────────────────────────────────────

# 运行所有测试（默认 Vue）
test: test-backend test-fe-vue

# 后端测试
test-backend:
    pixi run go test ./backend/...
