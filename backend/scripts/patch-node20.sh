#!/bin/bash
# Patches wallet-sdk-shielded for Node.js 20 compatibility
# The SDK uses Iterator.prototype.map() which requires Node.js 22+
# This replaces it with Array.from().map() which works on all Node versions

CORE_WALLET="node_modules/@midnight-ntwrk/wallet-sdk-shielded/dist/v1/CoreWallet.js"

if [ -f "$CORE_WALLET" ]; then
  sed -i 's/state\.pendingOutputs\.values()\.map/Array.from(state.pendingOutputs.values()).map/g' "$CORE_WALLET"
  echo "✅ Patched wallet-sdk-shielded for Node.js 20 compatibility"
fi
