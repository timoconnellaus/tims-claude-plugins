#!/bin/bash
set -e

# Tim's Claude Skills CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/timoconnellaus/tims-claude-plugins/main/scripts/install.sh | bash
#
# Options:
#   VERSION=x.y.z ./install.sh  - Install specific version
#   INSTALL_DIR=/path ./install.sh - Install to custom directory

REPO="timoconnellaus/tims-claude-plugins"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
CLIS=("req" "docs")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Detect platform
detect_platform() {
    local os arch

    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    arch="$(uname -m)"

    case "$os" in
        darwin) os="darwin" ;;
        linux) os="linux" ;;
        *) error "Unsupported OS: $os (only macOS and Linux are supported)" ;;
    esac

    case "$arch" in
        x86_64|amd64) arch="x64" ;;
        arm64|aarch64) arch="arm64" ;;
        *) error "Unsupported architecture: $arch" ;;
    esac

    echo "${os}-${arch}"
}

# Get latest release version from GitHub API
get_latest_version() {
    local response
    response=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null)
    echo "$response" | grep '"tag_name":' | sed -E 's/.*"v?([^"]+)".*/\1/' | head -1
}

# Download a binary
download_binary() {
    local cli="$1"
    local version="$2"
    local platform="$3"
    local url="https://github.com/${REPO}/releases/download/v${version}/${cli}-${platform}"
    local tmp_file="/tmp/${cli}-${platform}-$$"

    info "Downloading ${cli} v${version} for ${platform}..." >&2

    if command -v curl &> /dev/null; then
        if ! curl -fsSL -o "$tmp_file" "$url" 2>/dev/null; then
            error "Failed to download ${cli}. Check that v${version} exists and includes ${cli}-${platform}"
        fi
    elif command -v wget &> /dev/null; then
        if ! wget -q -O "$tmp_file" "$url" 2>/dev/null; then
            error "Failed to download ${cli}. Check that v${version} exists and includes ${cli}-${platform}"
        fi
    else
        error "Neither curl nor wget found. Please install one of them."
    fi

    echo "$tmp_file"
}

# Verify checksum (optional)
verify_checksum() {
    local file="$1"
    local cli="$2"
    local version="$3"
    local platform="$4"

    # Try to download checksums
    local checksums_url="https://github.com/${REPO}/releases/download/v${version}/checksums.txt"
    local checksums_file="/tmp/checksums-$$"

    if curl -fsSL -o "$checksums_file" "$checksums_url" 2>/dev/null; then
        local expected
        expected=$(grep "${cli}-${platform}" "$checksums_file" 2>/dev/null | cut -d' ' -f1)

        if [ -n "$expected" ]; then
            local actual
            if command -v sha256sum &> /dev/null; then
                actual=$(sha256sum "$file" | cut -d' ' -f1)
            elif command -v shasum &> /dev/null; then
                actual=$(shasum -a 256 "$file" | cut -d' ' -f1)
            else
                warn "No SHA256 tool found, skipping verification"
                rm -f "$checksums_file"
                return 0
            fi

            if [ "$actual" != "$expected" ]; then
                rm -f "$checksums_file"
                error "Checksum mismatch for ${cli}! Expected: ${expected}, Got: ${actual}"
            fi

            info "Checksum verified for ${cli}"
        fi
        rm -f "$checksums_file"
    fi
}

# Install binary
install_binary() {
    local tmp_file="$1"
    local cli="$2"
    local dest="${INSTALL_DIR}/${cli}"

    # Create install directory if needed
    mkdir -p "$INSTALL_DIR"

    # Move binary
    mv "$tmp_file" "$dest"
    chmod +x "$dest"

    info "Installed ${cli} to ${dest}"
}

# Check if directory is in PATH
check_path() {
    case ":$PATH:" in
        *":$INSTALL_DIR:"*) return 0 ;;
        *) return 1 ;;
    esac
}

# Get shell profile file
get_shell_profile() {
    local shell_name
    shell_name=$(basename "$SHELL")

    case "$shell_name" in
        zsh) echo "$HOME/.zshrc" ;;
        bash)
            if [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.bashrc"
            fi
            ;;
        fish) echo "$HOME/.config/fish/config.fish" ;;
        *) echo "$HOME/.profile" ;;
    esac
}

# Main installation
main() {
    local version="${VERSION:-$(get_latest_version)}"
    local platform
    platform=$(detect_platform)

    if [ -z "$version" ]; then
        error "Could not determine latest version. Check your internet connection or specify VERSION=x.y.z"
    fi

    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}   Tim's Claude Skills CLI Installer               ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
    info "Version: ${version}"
    info "Platform: ${platform}"
    info "Install directory: ${INSTALL_DIR}"
    echo ""

    # Download and install each CLI
    for cli in "${CLIS[@]}"; do
        local tmp_file
        tmp_file=$(download_binary "$cli" "$version" "$platform")
        verify_checksum "$tmp_file" "$cli" "$version" "$platform"
        install_binary "$tmp_file" "$cli"
    done

    echo ""

    # Check PATH
    if ! check_path; then
        warn "Install directory is not in your PATH"
        echo ""
        local profile
        profile=$(get_shell_profile)
        echo "Add this line to ${profile}:"
        echo ""
        echo -e "  ${YELLOW}export PATH=\"\$PATH:$INSTALL_DIR\"${NC}"
        echo ""
        echo "Then restart your shell or run:"
        echo ""
        echo -e "  ${YELLOW}source ${profile}${NC}"
        echo ""
    fi

    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "Usage:"
    echo "  req --help     # Requirements tracker"
    echo "  docs --help    # Documentation skill"
    echo ""
    echo "To update in the future:"
    echo "  req upgrade"
    echo "  docs upgrade"
    echo ""
}

main "$@"
