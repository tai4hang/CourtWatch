#!/bin/sh
set -e

echo "=== Starting entrypoint ==="

# Fetch Oracle credentials from OCI Secrets using instance principal
echo "Fetching Oracle credentials from OCI Secrets..."

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

# Also check direct environment variable (for container instance env vars)
if [ -n "$ORACLE_CONNECT_STRING" ]; then
    export ORACLE_CONNECT_STRING
    echo "✓ Oracle connect string from environment"
fi

echo "=== Starting application ==="

# Execute the main command
exec "$@"