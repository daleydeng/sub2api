# Sub2API — React Frontend Fork

> Fork of [Wei-Shaw/sub2api](https://github.com/Wei-Shaw/sub2api).
> Upstream README → [README.md](README.md) | [中文](README_FORK_CN.md)

## What's Different

This fork adds a **React 19 rewrite** of the frontend (`frontend-react/`) while keeping the original Vue frontend intact. Both compile to the same `backend/internal/web/dist/` and embed into the Go binary.

### Tech Stack (React Frontend)

| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 (beta) + React Compiler |
| Routing | TanStack Router v1 |
| Data Fetching | TanStack React Query v5 |
| Forms | TanStack Form v1 + Zod |
| State | Zustand v5 |
| UI | Radix UI + shadcn/ui + Tailwind CSS 4 |
| i18n | react-i18next (EN / ZH) |
| Onboarding | driver.js interactive tour |

### Other Fork Changes

- **Justfile** — dual frontend commands (`fe-vue-*` / `fe-react-*`), embed build targets
- **pixi** — reproducible toolchain (Node 24, Go 1.25, pnpm 10)
- **`onboarding_enabled`** — system setting to control the new-user guided tour
- **Podman Compose** dev workflow for PostgreSQL + Redis

## Quick Start

### Prerequisites

- [pixi](https://pixi.sh) (manages Node, Go, pnpm automatically)
- [just](https://just.systems) (command runner)
- PostgreSQL 15+ & Redis 7+ (or use `just dev-up` with Podman)

### Development

```bash
# Start dev databases (PostgreSQL + Redis via Podman)
just dev-up

# First-time setup (create tables + admin account)
just dev-install

# Start backend
just be-dev

# In another terminal — start React frontend dev server (:3000)
just fe-react-install
just fe-react-dev
```

### Build

```bash
# React embed binary (frontend + Go in one binary)
just build-embed-react

# Run it
just serve-react              # default :8081
just serve-react port=9000    # custom port

# Vue embed binary (original frontend)
just build-embed-vue
just serve-vue
```

### All Commands

```bash
just --list
```

## Project Structure

```
sub2api/
├── backend/                 # Go backend (shared by both frontends)
├── frontend/                # Vue 3 frontend (upstream original)
├── frontend-react/          # React 19 frontend (this fork)
│   └── src/
│       ├── api/             # API client (mirrors backend endpoints)
│       ├── components/      # shadcn/ui components + layout
│       ├── hooks/           # Custom hooks (onboarding, theme, etc.)
│       ├── i18n/            # EN + ZH translations
│       ├── router/          # TanStack Router config
│       ├── stores/          # Zustand stores (auth, app, settings)
│       ├── types/           # Shared TypeScript types
│       ├── views/           # Page components
│       │   ├── admin/       # Admin dashboard pages
│       │   ├── auth/        # Login, register, OAuth, password reset
│       │   ├── setup/       # Setup wizard
│       │   └── user/        # User dashboard pages
│       └── utils/           # Helpers
├── deploy/                  # Docker / Podman / systemd configs
├── Justfile                 # Task runner commands
└── pixi.toml                # Reproducible toolchain
```

## Syncing with Upstream

```bash
git fetch upstream main
git merge upstream/main
# resolve conflicts if any, then push
git push
```

## License

MIT — same as upstream.
