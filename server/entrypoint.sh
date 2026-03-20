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
        echo "ERROR: Secret OCID not provided for $secret_name"
        return 1
    fi
    echo "Fetching secret $secret_name (OCID: $secret_ocid)..."
    
    # Get the base64 payload with full error capture
    local payload
    local oci_exit_code
    payload=$(oci vault secret get --secret-id "$secret_ocid" \
        --query 'data."secret-bundle"."contents"[0]."payload"' \
        --raw-output 2>&1)
    oci_exit_code=$?
    
    echo "OCI CLI exit code: $oci_exit_code"
    echo "OCI response (first 100 chars): ${payload:0:100}"
    
    if [ $oci_exit_code -ne 0 ]; then
        echo "ERROR: OCI CLI failed for $secret_name: $payload"
        return 1
    fi
    
    if [ -z "$payload" ]; then
        echo "ERROR: Empty secret value for $secret_name"
        return 1
    fi
    
    # Try to decode from base64
    local decoded
    if decoded=$(echo "$payload" | base64 -d 2>&1); then
        echo "SUCCESS: Decoded $secret_name (length: ${#decoded})"
        echo "Decoded value: $decoded"
        echo "$decoded"
    else
        echo "WARNING: Base64 decode failed, using raw value"
        echo "Raw value: $payload"
        echo "$payload"
    fi
}

if [ -n "$OCI_SECRET_ORACLE_USER" ]; then
    ORACLE_USER=$(get_secret "$OCI_SECRET_ORACLE_USER" "ORACLE_USER")
    export ORACLE_USER
    echo "✓ Oracle user loaded: ${ORACLE_USER:0:5}..."
fi

if [ -n "$OCI_SECRET_ORACLE_PASSWORD" ]; then
    ORACLE_PASSWORD=$(get_secret "$OCI_SECRET_ORACLE_PASSWORD" "ORACLE_PASSWORD")
    export ORACLE_PASSWORD
    echo "✓ Oracle password loaded (length: ${#ORACLE_PASSWORD})"
fi

if [ -n "$OCI_SECRET_ORACLE_CONNECT_STRING" ]; then
    ORACLE_CONNECT_STRING=$(get_secret "$OCI_SECRET_ORACLE_CONNECT_STRING" "ORACLE_CONNECT_STRING")
    export ORACLE_CONNECT_STRING
    echo "✓ Oracle connect string loaded: ${ORACLE_CONNECT_STRING:0:30}..."
fi

echo "=== Final Environment ==="
echo "ORACLE_USER: ${ORACLE_USER:0:10}..."
echo "ORACLE_PASSWORD length: ${#ORACLE_PASSWORD}"
echo "ORACLE_CONNECT_STRING: ${ORACLE_CONNECT_STRING:0:50}..."

echo "=== Starting application ==="

# Execute the main command
exec "$@"