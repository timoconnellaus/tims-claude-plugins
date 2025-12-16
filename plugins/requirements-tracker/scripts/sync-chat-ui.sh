#!/bin/bash

# Sync chat UI components from shadcn-ui-for-claude-agent-sdk
# Usage: ./scripts/sync-chat-ui.sh [path-to-shadcn-repo]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
SHADCN_REPO="${1:-$PLUGIN_DIR/../../../shadcn-ui-for-claude-agent-sdk}"

# Resolve to absolute path
SHADCN_REPO="$(cd "$SHADCN_REPO" 2>/dev/null && pwd)" || {
    echo "Error: Could not find shadcn-ui-for-claude-agent-sdk at: $1"
    echo "Usage: $0 [path-to-shadcn-repo]"
    exit 1
}

echo "Syncing from: $SHADCN_REPO"
echo "Syncing to: $PLUGIN_DIR"
echo ""

# Check source directories exist
if [ ! -d "$SHADCN_REPO/registry/new-york/claude-chat" ]; then
    echo "Error: claude-chat directory not found in $SHADCN_REPO/registry/new-york/"
    exit 1
fi

# Create target directories if needed
mkdir -p "$PLUGIN_DIR/src/ui/chat"
mkdir -p "$PLUGIN_DIR/src/ui/shadcn"
mkdir -p "$PLUGIN_DIR/src/ui/lib"
mkdir -p "$PLUGIN_DIR/src/ui/handler"

# ============================================================
# Sync chat types
# ============================================================
echo "Syncing chat types..."
cp "$SHADCN_REPO/registry/new-york/claude-chat-types/types.ts" "$PLUGIN_DIR/src/ui/chat/types.ts"

# ============================================================
# Sync useClaudeChat hook
# ============================================================
echo "Syncing useClaudeChat hook..."
# Copy and fix imports
sed -e "s|from '@/registry/new-york/claude-chat-types'|from './types'|g" \
    "$SHADCN_REPO/registry/new-york/use-claude-chat/use-claude-chat.ts" \
    > "$PLUGIN_DIR/src/ui/chat/use-claude-chat.ts"

# ============================================================
# Sync chat components
# ============================================================
echo "Syncing chat components..."

CHAT_SRC="$SHADCN_REPO/registry/new-york/claude-chat"
CHAT_DEST="$PLUGIN_DIR/src/ui/chat"

# Function to transform imports in chat components
transform_chat_imports() {
    local file="$1"
    sed -e 's|"use client"||g' \
        -e "s|from \"@/lib/utils\"|from \"../lib/utils\"|g" \
        -e "s|from \"@/components/ui/button\"|from \"../shadcn/button\"|g" \
        -e "s|from \"@/components/ui/card\"|from \"../shadcn/card\"|g" \
        -e "s|from \"@/components/ui/textarea\"|from \"../shadcn/textarea\"|g" \
        -e "s|from \"@/components/ui/collapsible\"|from \"../shadcn/collapsible\"|g" \
        -e "s|from \"@/components/ui/avatar\"|from \"../shadcn/avatar\"|g" \
        -e "s|from \"@/components/ui/alert-dialog\"|from \"../shadcn/alert-dialog\"|g" \
        -e "s|from \"@/components/ui/scroll-area\"|from \"../shadcn/scroll-area\"|g" \
        -e "s|from \"@/components/ui/input\"|from \"../shadcn/input\"|g" \
        -e "s|from \"../claude-chat-types/types\"|from \"./types\"|g" \
        -e "s|from \"../claude-chat-types\"|from \"./types\"|g" \
        -e "s|from \"../use-claude-chat\"|from \"./use-claude-chat\"|g" \
        -e "s|from \"\./chat-header\"|from \"./ChatHeader\"|g" \
        -e "s|from \"\./chat-input\"|from \"./ChatInput\"|g" \
        -e "s|from \"\./chat-message\"|from \"./ChatMessage\"|g" \
        -e "s|from \"\./chat-message-list\"|from \"./ChatMessageList\"|g" \
        -e "s|from \"\./chat-tool-call\"|from \"./ChatToolCall\"|g" \
        -e "s|from \"\./chat-typing-indicator\"|from \"./ChatTypingIndicator\"|g" \
        -e "s|from \"\./chat-agent-status\"|from \"./ChatAgentStatus\"|g" \
        -e "s|from \"\./chat-subagent-tool-call\"|from \"./ChatSubagentToolCall\"|g" \
        -e "s|from \"\./chat-parallel-tool-group\"|from \"./ChatParallelToolGroup\"|g" \
        -e "s|from \"\./tool-displays\"|from \"./ToolDisplays\"|g" \
        -e "s|from \"\./tool-expanded-views\"|from \"./ToolExpandedViews\"|g" \
        -e "s|from \"\./tool-approval-panel\"|from \"./ToolApprovalPanel\"|g" \
        "$file"
}

# Copy and transform each chat component
for src_file in "$CHAT_SRC"/*.tsx; do
    filename=$(basename "$src_file")

    # Map source filenames to PascalCase destination names
    case "$filename" in
        "claude-chat.tsx")
            dest_name="ClaudeChat.tsx"
            ;;
        "chat-header.tsx")
            dest_name="ChatHeader.tsx"
            ;;
        "chat-input.tsx")
            dest_name="ChatInput.tsx"
            ;;
        "chat-message.tsx")
            dest_name="ChatMessage.tsx"
            ;;
        "chat-message-list.tsx")
            dest_name="ChatMessageList.tsx"
            ;;
        "chat-tool-call.tsx")
            dest_name="ChatToolCall.tsx"
            ;;
        "chat-typing-indicator.tsx")
            dest_name="ChatTypingIndicator.tsx"
            ;;
        "chat-agent-status.tsx")
            dest_name="ChatAgentStatus.tsx"
            ;;
        "chat-subagent-tool-call.tsx")
            dest_name="ChatSubagentToolCall.tsx"
            ;;
        "chat-parallel-tool-group.tsx")
            dest_name="ChatParallelToolGroup.tsx"
            ;;
        "tool-displays.tsx")
            dest_name="ToolDisplays.tsx"
            ;;
        "tool-expanded-views.tsx")
            dest_name="ToolExpandedViews.tsx"
            ;;
        "tool-approval-panel.tsx")
            dest_name="ToolApprovalPanel.tsx"
            ;;
        "index.ts")
            # Skip index, we have our own
            continue
            ;;
        *)
            dest_name="$filename"
            ;;
    esac

    echo "  $filename -> $dest_name"
    transform_chat_imports "$src_file" > "$CHAT_DEST/$dest_name"
done

# ============================================================
# Sync shadcn/ui components
# ============================================================
echo "Syncing shadcn/ui components..."

UI_SRC="$SHADCN_REPO/components/ui"
UI_DEST="$PLUGIN_DIR/src/ui/shadcn"

# Function to transform imports in UI components
transform_ui_imports() {
    local file="$1"
    sed -e 's|"use client"||g' \
        -e "s|from \"@/lib/utils\"|from \"../lib/utils\"|g" \
        -e "s|from \"@/components/ui/button\"|from \"./button\"|g" \
        "$file"
}

for src_file in "$UI_SRC"/*.tsx; do
    filename=$(basename "$src_file")
    echo "  $filename"
    transform_ui_imports "$src_file" > "$UI_DEST/$filename"
done

# ============================================================
# Sync utils
# ============================================================
echo "Syncing lib/utils..."
cp "$SHADCN_REPO/lib/utils.ts" "$PLUGIN_DIR/src/ui/lib/utils.ts"

# ============================================================
# Sync chat handler
# ============================================================
echo "Syncing chat handler..."

HANDLER_SRC="$SHADCN_REPO/registry/new-york/claude-chat-handler"
HANDLER_DEST="$PLUGIN_DIR/src/ui/handler"

# Function to transform imports in handler files
transform_handler_imports() {
    local file="$1"
    sed -e "s|from '../claude-chat-types'|from '../chat/types'|g" \
        -e "s|from '../claude-chat-types/types'|from '../chat/types'|g" \
        "$file"
}

for src_file in "$HANDLER_SRC"/*.ts; do
    filename=$(basename "$src_file")
    # Skip README
    if [[ "$filename" == "README.md" ]]; then
        continue
    fi
    echo "  $filename"
    transform_handler_imports "$src_file" > "$HANDLER_DEST/$filename"
done

# ============================================================
# Update chat index.ts with correct exports
# ============================================================
echo "Updating chat/index.ts..."
cat > "$CHAT_DEST/index.ts" << 'EOF'
export { ClaudeChat } from "./ClaudeChat"
export { ChatHeader } from "./ChatHeader"
export { ChatInput } from "./ChatInput"
export { ChatMessage } from "./ChatMessage"
export { ChatMessageList } from "./ChatMessageList"
export { ChatToolCall } from "./ChatToolCall"
export { ChatSubagentToolCall } from "./ChatSubagentToolCall"
export { ChatParallelToolGroup } from "./ChatParallelToolGroup"
export { ChatAgentStatus } from "./ChatAgentStatus"
export { ChatTypingIndicator } from "./ChatTypingIndicator"
export { ToolApprovalPanel } from "./ToolApprovalPanel"
export { ToolDisplay } from "./ToolDisplays"
export { ToolExpandedView } from "./ToolExpandedViews"
export { useClaudeChat } from "./use-claude-chat"
export * from "./types"
EOF

# ============================================================
# Update shadcn index.ts
# ============================================================
echo "Updating shadcn/index.ts..."
cat > "$UI_DEST/index.ts" << 'EOF'
export * from "./button"
export * from "./card"
export * from "./input"
export * from "./textarea"
export * from "./collapsible"
export * from "./avatar"
export * from "./alert-dialog"
export * from "./scroll-area"
EOF

echo ""
echo "Sync complete!"
echo ""
echo "Next steps:"
echo "  1. Run 'bun install' if new dependencies were added"
echo "  2. Run 'bun run typecheck' to verify types"
echo "  3. Test the UI with 'req ui'"
