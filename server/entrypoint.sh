#!/bin/sh
set -e

echo "=== Starting entrypoint ==="

# Fetch Oracle credentials from OCI Secrets using instance principal
echo "Fetching Oracle credentials from OCI Secrets..."

# Function to get secret value using instance principal auth
# OCI Vault secrets are base64 encoded by default
get_secret() {
    local secret_ocid="$1"
    local secret_name="$2"
    if [ -z "$secret_ocid" ]; then
        echo "Warning: Secret OCID not provided for $secret_name"
        return 1
    fi
    # Get the base64 payload
    local payload
    payload=$(oci vault secret get --secret-id "$secret_ocid" \
        --query 'data."secret-bundle"."contents"[0]."payload"' \
        --raw-output 2>/dev/null)
    
    if [ -z "$payload" ]; then
        echo "Warning: Empty secret value for $secret_name"
        return 1
    fi
    
    # Debug: Show first 50 chars of raw payload
    echo "Debug: Raw payload for $secret_name: ${payload:0:50}..."
    
    # Try to decode from base64, but validate first
    # Check if payload looks like valid base64 (alphanumeric + some special chars)
    if echo "$payload" | base64 -d >/dev/null 2>&1; then
        # Valid base64 - decode it
        echo "$payload" | base64 -d
    else
        # Not valid base64 - assume it's plain text (user pasted directly)
        echo "$payload"
    fi
}

if [ -n "$OCI_SECRET_ORACLE_USER" ]; then
    ORACLE_USER=$(get_secret "$OCI_SECRET_ORACLE_USER" "ORACLE_USER")
    export ORACLE_USER
    echo "✓ Oracle user loaded from secret"
fi

if [ -n "$OCI_SECRET_ORACLE_PASSWORD" ]; then
    ORACLE_PASSWORD=$(get_secret "$OCI_SECRET_ORACLE_PASSWORD" "ORACLE_PASSWORD")
    export ORACLE_PASSWORD
    echo "✓ Oracle password loaded from secret"
fi

if [ -n "$OCI_SECRET_ORACLE_CONNECT_STRING" ]; then
    ORACLE_CONNECT_STRING=$(get_secret "$OCI_SECRET_ORACLE_CONNECT_STRING" "ORACLE_CONNECT_STRING")
    export ORACLE_CONNECT_STRING
    echo "✓ Oracle connect string loaded from secret"
fi

echo "=== Starting application ==="

# Execute the main command
exec "$@"