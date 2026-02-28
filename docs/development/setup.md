# Development Guide

This guide helps you set up a local development environment for Sub2API.

## Quick Start

### Automated Setup (Recommended)

We provide setup scripts that automatically install all required development tools.

#### Windows (PowerShell)

```powershell
# Run in PowerShell
.\scripts\setup\setup.ps1
```

The script will install via [Scoop](https://scoop.sh/):
- Scoop (package manager)
- Git
- Just (task runner)
- Pixi (project package manager)
- Rust toolchain
- rust-script
- PostgreSQL (optional)
- Redis (optional)

#### macOS

```bash
# Run in Terminal
./scripts/setup/setup.sh
```

The script will install via [Homebrew](https://brew.sh/):
- Homebrew (if not installed)
- Just
- Pixi
- Rust toolchain
- rust-script
- PostgreSQL (optional)
- Redis (optional)

#### Linux

```bash
# Run in Terminal
./scripts/setup/setup.sh
```

The script will install:
- Just (via official installer)
- Pixi (via official installer)
- Rust toolchain (via rustup)
- rust-script (via cargo)

For PostgreSQL and Redis, install them using your distribution's package manager:

```bash
# Ubuntu/Debian
sudo apt install postgresql-15 redis-server

# Fedora/RHEL
sudo dnf install postgresql15-server redis

# Arch Linux
sudo pacman -S postgresql redis
```

---

## Manual Setup

If you prefer to install tools manually:

### 1. Install Just

Just is a task runner that simplifies common development tasks.

- **Windows (Scoop):** `scoop install just`
- **macOS (Homebrew):** `brew install just`
- **Linux:** `curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/.local/bin`

### 2. Install Pixi

Pixi manages project-specific dependencies (Go, Node.js, pnpm).

- **Windows (Scoop):** `scoop install pixi`
- **macOS (Homebrew):** `brew install pixi`
- **Linux:** `curl -fsSL https://pixi.sh/install.sh | bash`

### 3. Install Rust and rust-script

rust-script is used for database management scripts.

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install rust-script
cargo install rust-script
```

### 4. Install Pixi Dependencies

```bash
# Install Go, Node.js, pnpm, and other project dependencies
pixi install
```

### 5. Install PostgreSQL and Redis

Install PostgreSQL 15+ and Redis 7+ using your system's package manager.

---

## Development Workflow

Once setup is complete, use `just` commands for common tasks:

### View Available Commands

```bash
just
```

### Database Setup

```bash
# 1. Initialize PostgreSQL data directory (first time only)
just db-init

# 2. Start PostgreSQL and Redis
just db-up

# 3. Initialize database schema and admin account
just db-install

# Check database status
just db-status
```

### Frontend Development

#### Vue Frontend (Default)

```bash
# Install dependencies
just dev-install-vue

# Start development server (http://localhost:5173)
just dev-vue

# Build for production
just build-vue

# Run linter and type check
just test-vue
```

#### React Frontend (Alternative)

```bash
# Install dependencies
just dev-install-react

# Start development server
just dev-react

# Build for production
just build-react

# Run linter and type check
just test-react
```

### Backend Development

```bash
# Start backend server (http://localhost:8081)
just dev-be

# Build backend only
just build-backend

# Run backend tests
just test-backend
```

### Build Embedded Binary

Build a single binary with embedded frontend:

```bash
# Vue embedded binary
just build-embed-vue
just dev-serve-vue

# React embedded binary
just build-embed-react
just dev-serve-react
```

### Database Management

```bash
# Reset database (wipe data and reinitialize)
just db-reset

# Stop PostgreSQL and Redis
just db-down
```

---

## Project Structure

```
sub2api/
├── backend/           # Go backend (Gin + Ent)
├── frontend/          # Vue 3 frontend (default)
├── frontend-react/    # React frontend (alternative)
├── scripts/           # Development scripts
│   └── dbmgr.rs      # Database management (rust-script)
├── deploy/            # Deployment configurations
├── Justfile           # Task definitions
├── pixi.toml          # Pixi project configuration
├── pixi.lock          # Locked dependencies
├── setup.ps1          # Windows setup script
└── setup.sh           # Linux/macOS setup script
```

---

## Environment Variables

Development environment variables are loaded from [.env.dev](.env.dev).

Key variables:
- `DATA_DIR` - Application data directory
- `PGDATA` - PostgreSQL data directory
- `REDIS_DIR` - Redis data directory
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

---

## Tools Overview

| Tool | Purpose | Installation |
|------|---------|-------------|
| **Just** | Task runner (like Make but better) | `scoop install just` / `brew install just` |
| **Pixi** | Project package manager (manages Go, Node.js, pnpm) | `scoop install pixi` / `brew install pixi` |
| **rust-script** | Run Rust scripts (for database management) | `cargo install rust-script` |
| **PostgreSQL** | Primary database | System package manager |
| **Redis** | Cache and queue | System package manager |

---

## Troubleshooting

### "command not found: just"

Make sure Just is installed and in your PATH:
- Windows: `scoop install just`
- macOS: `brew install just`
- Linux: Add `~/.local/bin` to PATH

### "pixi: command not found"

Install Pixi and restart your terminal:
```bash
# Windows (PowerShell)
scoop install pixi

# macOS/Linux
curl -fsSL https://pixi.sh/install.sh | bash
```

### Database connection errors

1. Ensure PostgreSQL is running: `just db-status`
2. Start the database: `just db-up`
3. Initialize the database: `just db-init`
4. Install schema: `just db-install`

### Port already in use

Change the port in [.env.dev](.env.dev):
```bash
SERVER_PORT=9000
```

Or specify when running:
```bash
just dev-serve-vue 9000
```

---

## Next Steps

1. ✅ Run `just` to see all available commands
2. ✅ Run `just db-init && just db-up && just db-install` to set up the database
3. ✅ Run `just dev-vue` (or `just dev-react`) to start frontend development
4. ✅ Run `just dev-be` in a separate terminal to start the backend
5. ✅ Open http://localhost:5173 for the frontend
6. ✅ Access the backend API at http://localhost:8081

Happy coding! 🚀
