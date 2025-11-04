#!/usr/bin/env bash
set -e

# ==============================================================
#  Tauri prerequisites installer for Debian/Ubuntu
# ==============================================================
# 1) System packages
echo "[1/5] Installing system packages..."
sudo apt update
sudo apt install -y \
libwebkit2gtk-4.1-dev \
build-essential \
curl \
wget \
file \
libxdo-dev \
libssl-dev \
libayatana-appindicator3-dev \
librsvg2-dev

# ==============================================================
# 2) Rust via rustup
# ==============================================================
if ! command -v rustc >/dev/null 2>&1; then
    echo "[2/5] Installing Rust..."
    curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y
    export PATH="$HOME/.cargo/bin:$PATH"
else
    echo "[2/5] Rust already installed, skipping."
fi

# ==============================================================
# 3) Node.js via nvm (v0.40.3)
# ==============================================================
if [ ! -d "$HOME/.nvm" ]; then
    echo "[3/5] Installing nvm v0.40.3..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
else
    echo "[3/5] nvm already installed."
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# ==============================================================
# 4) Node LTS setup
# ==============================================================
echo "[4/5] Installing Node.js LTS (v20)..."
nvm install 20
nvm use 20
nvm alias default 20

# Verify toolchain
echo "[4.1/5] Versions:"
node -v
npm -v
rustc --version
cargo --version

# ==============================================================
# 5) Open new shell in app directory and install packages
# ==============================================================
APP_DIR="sentinel-app-client"
echo "[5/5] Installing npm packages in $APP_DIR..."

if [ -d "$APP_DIR" ]; then
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal -- bash -c "cd '$APP_DIR' && npm i && exec bash"
        elif command -v x-terminal-emulator >/dev/null 2>&1; then
        x-terminal-emulator -e bash -c "cd '$APP_DIR' && npm i && exec bash"
    else
        echo "No graphical terminal found. Running inline..."
        cd "$APP_DIR" && npm i
    fi
else
    echo "Error: $APP_DIR directory not found. Skipping npm install."
fi

echo "Setup complete. Restart your shell to ensure PATH updates take effect."
