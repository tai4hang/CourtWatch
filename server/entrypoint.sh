#!/bin/sh
set -e

# OCI Object Storage configuration
OCI_BUCKET_NAME="${OCI_BUCKET_NAME:-db-wallets}"
OCI_OBJECT_NAME="${OCI_OBJECT_NAME:-Wallet_UB3AK3MTVBQJS41L.zip}"
OCI_WALLET_DIR="/app/wallet"
OCI_NAMESPACE="${OCI_NAMESPACE}"
OCI_REGION="${OCI_REGION}"

echo "Downloading Oracle wallet from OCI bucket: $OCI_BUCKET_NAME"

# Create wallet directory
mkdir -p "$OCI_WALLET_DIR"

# Download wallet using OCI CLI
if command -v oci >/dev/null 2>&1; then
    echo "Using OCI CLI to download wallet..."
    oci os object get \
        --namespace-name "$OCI_NAMESPACE" \
        --bucket-name "$OCI_BUCKET_NAME" \
        --name "$OCI_OBJECT_NAME" \
        --file "$OCI_WALLET_DIR/wallet.zip"
else
    echo "OCI CLI not found, trying curl..."
    # Fallback: use pre-authenticated URL if provided
    if [ -n "$OCI_PAR_URL" ]; then
        curl -L "$OCI_PAR_URL" -o "$OCI_WALLET_DIR/wallet.zip"
    else
        echo "Error: Either OCI CLI or PAR_URL must be configured"
        exit 1
    fi
fi

# Extract wallet
echo "Extracting wallet..."
unzip -o "$OCI_WALLET_DIR/wallet.zip" -d "$OCI_WALLET_DIR"
rm -f "$OCI_WALLET_DIR/wallet.zip"

echo "Wallet ready at $OCI_WALLET_DIR"
echo "Starting application..."

# Execute the main command
exec "$@"
