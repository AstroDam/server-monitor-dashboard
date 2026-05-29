#!/bin/bash

echo "================================="
echo " SERVER MONITOR DEPLOY GUARD "
echo "================================="

COMMIT_SHA=$(git rev-parse HEAD)
VERSION=$(date +"%Y.%m.%d-%H%M")
STATUS="failed"
SMOKE="false"

echo "Version: $VERSION"
echo "Commit: $COMMIT_SHA"

echo "Building and starting containers..."
docker compose up -d --build

echo "Waiting for backend health..."

MAX_RETRIES=12
RETRY=0

until curl -s http://localhost:3000/health | grep -q "healthy"
do
  RETRY=$((RETRY + 1))

  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "Backend did not become healthy in time"
    break
  fi

  echo "Waiting backend... attempt $RETRY/$MAX_RETRIES"
  sleep 5
done

echo "Running smoke tests..."

./scripts/smoke-test.sh
RESULT=$?

if [ $RESULT -eq 0 ]; then
  STATUS="success"
  SMOKE="true"
  echo "Deploy aprovado"
else
  STATUS="failed"
  SMOKE="false"
  echo "Deploy falhou"
fi

echo "Registering deploy..."

curl -s -X POST http://localhost:3000/deploy-registry \
-H "Content-Type: application/json" \
-d "{
  \"version\":\"$VERSION\",
  \"commit_sha\":\"$COMMIT_SHA\",
  \"status\":\"$STATUS\",
  \"smoke_test_passed\":$SMOKE,
  \"notes\":\"Deploy automático com health validation\"
}"

echo ""
echo "Deploy registrado com status: $STATUS"
echo "================================="