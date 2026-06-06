#!/bin/bash
set -e

echo "Starting Redis..."
redis-server --daemonize yes --maxmemory 128mb --maxmemory-policy allkeys-lru
until redis-cli ping 2>/dev/null | grep -q PONG; do sleep 0.5; done
echo "Redis ready"

exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
