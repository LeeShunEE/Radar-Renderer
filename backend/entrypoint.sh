#!/bin/bash
# Backend entrypoint script for Docker deployment
# Runs database migrations before starting the application

set -e

echo "=== Starting Backend Container ==="

# Wait for database to be ready (if using PostgreSQL)
if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" == *"postgresql"* ]]; then
    echo "Waiting for PostgreSQL to be ready..."

    # Extract connection info from DATABASE_URL
    # Format: postgresql+asyncpg://user:password@host:port/database
    # We need to convert to postgresql:// for pg_isready

    # Simple approach: wait with timeout
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        # Try to connect using Python (since pg_isready may not be installed)
        python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def check():
    # Convert async URL to sync for simple check
    sync_url = '${DATABASE_URL}'.replace('+asyncpg', '')
    engine = create_async_engine('${DATABASE_URL}')
    try:
        async with engine.connect() as conn:
            pass
        print('Database ready')
    except Exception as e:
        print(f'Database not ready: {e}')
        raise
    finally:
        await engine.dispose()

asyncio.run(check())
" 2>/dev/null && break

        attempt=$((attempt + 1))
        echo "Database not ready yet (attempt $attempt/$max_attempts)..."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        echo "ERROR: Database connection failed after $max_attempts attempts"
        exit 1
    fi
fi

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

echo "Migrations completed successfully."

# Execute the main command (passed as CMD)
exec "$@"