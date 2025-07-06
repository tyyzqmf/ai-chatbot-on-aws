#!/bin/bash -x

echo "⏳ Running database migrations..."
# Run migrations and check exit status
npx tsx lib/db/migrate.ts
MIGRATION_EXIT_CODE=$?

# Check if migrations were successful
if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
  echo "❌ Database migrations failed with exit code $MIGRATION_EXIT_CODE"
  echo "Retrying migrations in 5 seconds..."
  sleep 5
  npx tsx lib/db/migrate.ts
  MIGRATION_EXIT_CODE=$?
  
  if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
    echo "❌ Database migrations failed again with exit code $MIGRATION_EXIT_CODE"
    echo "The application will now start, but there might be database schema issues"
  fi
fi

# Start the server after migrations are complete
echo "✅ Starting the server..."
exec node ./server.js