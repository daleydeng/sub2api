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

# 安装前端依赖
fe-install:
    pixi run pnpm --dir frontend install

# ── 开发基础设施（PostgreSQL + Redis）─────────────

# 启动开发所需的数据库服务
dev-up:
    {{proxy}} pixi run podman-compose -f deploy/docker-compose-test.yml up -d postgres redis

# 停止数据库服务
dev-down:
    pixi run podman-compose -f deploy/docker-compose-test.yml down

# 首次安装（建表 + 创建管理员账户），直接调用 Go，无需后端进程在线
[working-directory: 'backend']
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
[working-directory: 'backend']
be-dev:
    {{proxy}} pixi run go run ./cmd/server

# 启动前端开发服务器
fe-dev:
    pixi run pnpm --dir frontend run dev

# ── 构建 ──────────────────────────────────────────

# 编译前后端
build: build-backend build-frontend

# 编译后端
build-backend:
    pixi run go build -o backend/bin/server ./backend/cmd/server

# 编译前端
build-frontend:
    pixi run pnpm --dir frontend run build

# ── 测试 ──────────────────────────────────────────

# 运行所有测试
test: test-backend test-frontend

# 后端测试
test-backend:
    pixi run go test ./backend/...

# 前端 lint + 类型检查
test-frontend:
    pixi run pnpm --dir frontend run lint:check
    pixi run pnpm --dir frontend run typecheck
