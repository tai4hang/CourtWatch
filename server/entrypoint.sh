#!/bin/sh
set -e

# OCI Object Storage configuration
OCI_BUCKET_NAME="${OCI_BUCKET_NAME:-db-wallets}"
OCI_OBJECT_NAME="${OCI_OBJECT_NAME:-Wallet_UB3AK3MTVBQJS41L.zip}"
OCI_WALLET_DIR="/app/wallet"
OCI_REGION="${OCI_REGION:-us-phoenix-1}"

# OCI Secret OCIDs
OCI_SECRET_ORACLE_USER="${OCI_SECRET_ORACLE_USER}"
OCI_SECRET_ORACLE_PASSWORD="${OCI_SECRET_ORACLE_PASSWORD}"
OCI_SECRET_ORACLE_CONNECT_STRING="${OCI_SECRET_ORACLE_CONNECT_STRING}"
OCI_SECRET_ORACLE_WALLET_PASSWORD="${OCI_SECRET_ORACLE_WALLET_PASSWORD}"

echo "=== Starting entrypoint ==="

# Function to get secret value
get_secret() {
    local secret_ocid="$1"
    if [ -z "$secret_ocid" ]; then
        echo "Warning: Secret OCID not provided"
        return 1
    fi
    oci secrets secret get --secret-id "$secret_ocid" --query 'data."secret-bundle"."contents"[0]."payload"' --raw-output | base64 -d
}

# Download and extract wallet from OCI bucket
echo "Downloading Oracle wallet from OCI bucket: $OCI_BUCKET_NAME"
mkdir -p "$OCI_WALLET_DIR"

if command -v oci >/dev/null 2>&1; then
    echo "Using OCI CLI to download wallet..."
    oci os object get \
        --namespace-name "$OCI_NAMESPACE" \
        --bucket-name "$OCI_BUCKET_NAME" \
        --name "$OCI_OBJECT_NAME" \
        --file "$OCI_WALLET_DIR/wallet.zip" || \
    (echo "OCI bucket download failed, trying PAR_URL..." && \
    curl -L "$OCI_PAR_URL" -o "$OCI_WALLET_DIR/wallet.zip")
else
    echo "OCI CLI not found, trying PAR_URL..."
    curl -L "$OCI_PAR_URL" -o "$OCI_WALLET_DIR/wallet.zip"
fi

# Extract wallet
echo "Extracting wallet..."
unzip -o "$OCI_WALLET_DIR/wallet.zip" -d "$OCI_WALLET_DIR"
rm -f "$OCI_WALLET_DIR/wallet.zip"
echo "Wallet ready at $OCI_WALLET_DIR"

# Fetch Oracle credentials from OCI Secrets
echo "Fetching Oracle credentials from OCI Secrets..."

if [ -n "$OCI_SECRET_ORACLE_USER" ]; then
    ORACLE_USER=$(get_secret "$OCI_SECRET_ORACLE_USER")
    export ORACLE_USER
    echo "✓ Oracle user loaded from secret"
fi

if [ -n "$OCI_SECRET_ORACLE_PASSWORD" ]; then
    ORACLE_PASSWORD=$(get_secret "$OCI_SECRET_ORACLE_PASSWORD")
    export ORACLE_PASSWORD
    echo "✓ Oracle password loaded from secret"
fi

if [ -n "$OCI_SECRET_ORACLE_CONNECT_STRING" ]; then
    ORACLE_CONNECT_STRING=$(get_secret "$OCI_SECRET_ORACLE_CONNECT_STRING")
    export ORACLE_CONNECT_STRING
    echo "✓ Oracle connect string loaded from secret"
fi

if [ -n "$OCI_SECRET_ORACLE_WALLET_PASSWORD" ]; then
    ORACLE_WALLET_PASSWORD=$(get_secret "$OCI_SECRET_ORACLE_WALLET_PASSWORD")
    export ORACLE_WALLET_PASSWORD
    echo "✓ Oracle wallet password loaded from secret"
fi

# Set wallet location
export ORACLE_WALLET_LOCATION="$OCI_WALLET_DIR"

echo "=== Starting application ==="

# Execute the main command
exec "$@"
