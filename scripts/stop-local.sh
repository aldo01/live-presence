#!/bin/bash

# Stop all local development services
set -e

echo "🛑 Stopping Live Presence Local Development Environment..."

docker-compose -f docker-compose.local.yml down

echo "✅ All services stopped!"
echo ""
echo "To remove all data (volumes), run:"
echo "   docker-compose -f docker-compose.local.yml down -v"
