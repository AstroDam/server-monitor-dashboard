#!/bin/bash

echo "================================="
echo " SERVER MONITOR ROLLBACK GUARD "
echo "================================="

CURRENT_COMMIT=$(git rev-parse HEAD)
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
VERSION=$(date +"%Y.%m.%d-%H%M-rollback")

echo "Current commit: $CURRENT_COMMIT"
echo "Rollback target: $PREVIOUS_COMMIT"

echo "Checking out previous commit..."
git checkout "$PREVIOUS_COMMIT"

echo "Rebuilding stack..."
docker compose up -d --build

echo "Waiting for backend health..."

MAX_RETRIES=12
RETRY=0

until curl -s http://localhost:3000/health | grep -q "healthy"
do
  RETRY=$((RETRY + 1))

  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "Backend did not become healthy after rollback"
    STATUS="rollback_failed"
    SMOKE="false"
    break
  fi

  echo "Waiting backend... attempt $RETRY/$MAX_RETRIES"
  sleep 5
done

echo "Running smoke tests after rollback..."

./scripts/smoke-test.sh
RESULT=$?

if [ $RESULT -eq 0 ]; then
  STATUS="rollback_success"
  SMOKE="true"
  echo "Rollback aprovado"
else
  STATUS="rollback_failed"
  SMOKE="false"
  echo "Rollback falhou"
fi

echo "Registering rollback..."

curl -s -X POST http://localhost:3000/deploy-registry \
-H "Content-Type: application/json" \
-d "{
  \"version\":\"$VERSION\",
  \"commit_sha\":\"$PREVIOUS_COMMIT\",
  \"status\":\"$STATUS\",
  \"smoke_test_passed\":$SMOKE,
  \"notes\":\"Rollback controlado a partir de $CURRENT_COMMIT\"
}"

echo ""
echo "Rollback registrado com status: $STATUS"
echo "================================="