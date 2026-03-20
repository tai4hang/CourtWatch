#!/bin/sh
set -e

echo "=== Starting entrypoint ==="

# If Oracle credentials are already provided as env vars (direct), use them
# Otherwise, try to fetch from OCI Secrets

if [ -n "$ORACLE_USER" ] && [ -n "$ORACLE_PASSWORD" ] && [ -n "$ORACLE_CONNECT_STRING" ]; then
    echo "Using direct environment variables for Oracle credentials"
else
    echo "Fetching Oracle credentials from OCI Secrets..."
    
    # Function to get secret value
    get_secret() {
        local secret_ocid="$1"
        local secret_name="$2"
        if [ -z "$secret_ocid" ]; then
            echo "Warning: Secret OCID not provided for $secret_name"
            return 1
        fi
        
        local payload
        payload=$(oci vault secret get --secret-id "$secret_ocid" \
            --query 'data."secret-bundle"."contents"[0]."payload"' \
            --raw-output 2>/dev/null)
        
        if [ -z "$payload" ]; then
            echo "Warning: Empty secret for $secret_name"
            return 1
        fi
        
        # Try base64 decode
        if echo "$payload" | base64 -d >/dev/null 2>&1; then
            echo "$payload" | base64 -d
        else
            echo "$payload"
        fi
    }

    if [ -n "$OCI_SECRET_ORACLE_USER" ] && [ -z "$ORACLE_USER" ]; then
        ORACLE_USER=$(get_secret "$OCI_SECRET_ORACLE_USER" "ORACLE_USER")
        export ORACLE_USER
    fi

    if [ -n "$OCI_SECRET_ORACLE_PASSWORD" ] && [ -z "$ORACLE_PASSWORD" ]; then
        ORACLE_PASSWORD=$(get_secret "$OCI_SECRET_ORACLE_PASSWORD" "ORACLE_PASSWORD")
        export ORACLE_PASSWORD
    fi

    if [ -n "$OCI_SECRET_ORACLE_CONNECT_STRING" ] && [ -z "$ORACLE_CONNECT_STRING" ]; then
        ORACLE_CONNECT_STRING=$(get_secret "$OCI_SECRET_ORACLE_CONNECT_STRING" "ORACLE_CONNECT_STRING")
        export ORACLE_CONNECT_STRING
    fi
fi

echo "=== Final Environment ==="
echo "ORACLE_USER: ${ORACLE_USER:0:10}..."
echo "ORACLE_PASSWORD length: ${#ORACLE_PASSWORD}"
echo "ORACLE_CONNECT_STRING: ${ORACLE_CONNECT_STRING:0:50}..."

echo "=== Starting application ==="
exec "$@"