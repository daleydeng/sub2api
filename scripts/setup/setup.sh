#!/usr/bin/env bash
# Sub2API Development Environment Setup Script
# This script installs all required development tools

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🚀 Sub2API Development Environment Setup${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=Linux;;
    Darwin*)    PLATFORM=Mac;;
    MINGW*|MSYS*|CYGWIN*)     PLATFORM=Windows;;
    *)          PLATFORM="UNKNOWN";;
esac

echo -e "${YELLOW}📍 Detected platform: ${PLATFORM}${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install for macOS
install_macos() {
    echo -e "${YELLOW}🍎 Setting up for macOS...${NC}"

    # Install Homebrew if not present
    if ! command_exists brew; then
        echo -e "${GREEN}Installing Homebrew...${NC}"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    else
        echo -e "${GREEN}✅ Homebrew already installed${NC}"
    fi

    # Install Just
    if ! command_exists just; then
        echo -e "${GREEN}Installing Just...${NC}"
        brew install just
    else
        echo -e "${GREEN}✅ Just already installed${NC}"
    fi

    # Install Pixi
    if ! command_exists pixi; then
        echo -e "${GREEN}Installing Pixi...${NC}"
        brew install pixi
    else
        echo -e "${GREEN}✅ Pixi already installed${NC}"
    fi

    # Install Rust
    if ! command_exists rustc; then
        echo -e "${GREEN}Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    else
        echo -e "${GREEN}✅ Rust already installed${NC}"
    fi

    # Install rust-script
    if ! command_exists rust-script; then
        echo -e "${GREEN}Installing rust-script...${NC}"
        cargo install rust-script
    else
        echo -e "${GREEN}✅ rust-script already installed${NC}"
    fi

    # Optional: PostgreSQL
    if ! command_exists psql; then
        echo -e "${CYAN}PostgreSQL not found. Install? (Y/n): ${NC}"
        read -r install_pg
        if [[ -z "$install_pg" || "$install_pg" == "Y" || "$install_pg" == "y" ]]; then
            brew install postgresql@15
            brew services start postgresql@15
        fi
    else
        echo -e "${GREEN}✅ PostgreSQL already installed${NC}"
    fi

    # Optional: Redis
    if ! command_exists redis-server; then
        echo -e "${CYAN}Redis not found. Install? (Y/n): ${NC}"
        read -r install_redis
        if [[ -z "$install_redis" || "$install_redis" == "Y" || "$install_redis" == "y" ]]; then
            brew install redis
            brew services start redis
        fi
    else
        echo -e "${GREEN}✅ Redis already installed${NC}"
    fi
}

# Install for Linux
install_linux() {
    echo -e "${YELLOW}🐧 Setting up for Linux...${NC}"

    # Install Just
    if ! command_exists just; then
        echo -e "${GREEN}Installing Just...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/.local/bin
        export PATH="$HOME/.local/bin:$PATH"
    else
        echo -e "${GREEN}✅ Just already installed${NC}"
    fi

    # Install Pixi
    if ! command_exists pixi; then
        echo -e "${GREEN}Installing Pixi...${NC}"
        curl -fsSL https://pixi.sh/install.sh | bash
        export PATH="$HOME/.pixi/bin:$PATH"
    else
        echo -e "${GREEN}✅ Pixi already installed${NC}"
    fi

    # Install Rust
    if ! command_exists rustc; then
        echo -e "${GREEN}Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
    else
        echo -e "${GREEN}✅ Rust already installed${NC}"
    fi

    # Install rust-script
    if ! command_exists rust-script; then
        echo -e "${GREEN}Installing rust-script...${NC}"
        cargo install rust-script
    else
        echo -e "${GREEN}✅ rust-script already installed${NC}"
    fi

    echo ""
    echo -e "${YELLOW}⚠️  PostgreSQL and Redis installation varies by distribution.${NC}"
    echo -e "${YELLOW}   Please install them manually:${NC}"
    echo -e "   • Ubuntu/Debian: sudo apt install postgresql-15 redis-server"
    echo -e "   • Fedora/RHEL:   sudo dnf install postgresql15-server redis"
    echo -e "   • Arch Linux:    sudo pacman -S postgresql redis"
}

# Install for Windows (Git Bash/MSYS2)
install_windows() {
    echo -e "${YELLOW}🪟 Detected Windows environment${NC}"
    echo -e "${YELLOW}Please use the PowerShell script instead:${NC}"
    echo -e "   ${GREEN}.\setup.ps1${NC}"
    echo ""
    echo -e "${YELLOW}Or install Scoop and run:${NC}"
    echo -e "   scoop install just pixi rust rust-script"
    exit 1
}

# Main installation logic
case "${PLATFORM}" in
    Mac)
        install_macos
        ;;
    Linux)
        install_linux
        ;;
    Windows)
        install_windows
        ;;
    *)
        echo -e "${RED}❌ Unsupported platform: ${PLATFORM}${NC}"
        exit 1
        ;;
esac

# Setup Pixi environment
echo ""
echo -e "${YELLOW}🔧 Setting up Pixi environment...${NC}"
if [[ -f "pixi.toml" ]]; then
    pixi install
    echo -e "${GREEN}✅ Pixi environment ready${NC}"
else
    echo -e "${YELLOW}⚠️  pixi.toml not found, skipping Pixi setup${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}=========================================${NC}"
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${CYAN}Installed tools:${NC}"
echo -e "  ${NC}• Just         - Task runner${NC}"
echo -e "  ${NC}• Pixi         - Project package manager${NC}"
echo -e "  ${NC}• Rust         - Rust toolchain${NC}"
echo -e "  ${NC}• rust-script  - Rust script runner${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  ${NC}1. Run 'just' to see available commands${NC}"
echo -e "  ${NC}2. Run 'just db-init' to initialize the database${NC}"
echo -e "  ${NC}3. Run 'just db-install' to setup schema${NC}"
echo -e "  ${NC}4. Run 'just dev-vue' or 'just dev-react' to start development${NC}"
echo ""
