#!/bin/sh
set -e

# OCI Object Storage configuration
OCI_BUCKET_NAME="${OCI_BUCKET_NAME:-db-wallets}"
OCI_OBJECT_NAME="${OCI_OBJECT_NAME:-Wallet_UB3AK3MTVBQJS41L.zip}"
OCI_WALLET_DIR="/app/wallet"
OCI_REGION="${OCI_REGION:-us-phoenix-1}"

# PAR_URL or OCI CLI configuration
PAR_URL="${PAR_URL}"

# OCI Secret OCIDs
OCI_SECRET_ORACLE_USER="${OCI_SECRET_ORACLE_USER}"
OCI_SECRET_ORACLE_PASSWORD="${OCI_SECRET_ORACLE_PASSWORD}"
OCI_SECRET_ORACLE_CONNECT_STRING="${OCI_SECRET_ORACLE_CONNECT_STRING}"
OCI_SECRET_ORACLE_WALLET_PASSWORD="${OCI_SECRET_ORACLE_WALLET_PASSWORD}"

echo "=== Starting entrypoint ==="

# Function to get secret value using instance principal auth
get_secret() {
    local secret_ocid="$1"
    if [ -z "$secret_ocid" ]; then
        echo "Warning: Secret OCID not provided"
        return 1
    fi
    oci secrets secret get --secret-id "$secret_ocid" \
        --query 'data."secret-bundle"."contents"[0]."payload"' \
        --raw-output \
        --auth instance_principal | base64 -d
}

# Wallet is embedded in the image, just verify it exists
if [ "$DB_TYPE" != "sqlite" ]; then
    if [ -d "$OCI_WALLET_DIR" ] && [ "$(ls -A $OCI_WALLET_DIR)" ]; then
        echo "Wallet found at $OCI_WALLET_DIR"
    else
        echo "Error: Wallet not found at $OCI_WALLET_DIR"
        exit 1
    fi
else
    echo "Skipping wallet (SQLite mode)"
fi

# Fetch Oracle credentials from OCI Secrets using instance principal
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