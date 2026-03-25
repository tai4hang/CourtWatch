#!/bin/sh
set -e

echo "=== Starting entrypoint ==="

# For Firestore, we don't need any secret fetching
# Google Cloud automatically provides credentials via Workload Identity

echo "=== Starting application ==="

# Execute the main command
exec "$@"