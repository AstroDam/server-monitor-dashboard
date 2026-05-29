#!/bin/bash

echo "================================="
echo " SERVER MONITOR DEPLOY "
echo "================================="

COMMIT_SHA=$(git rev-parse HEAD)

VERSION=$(date +"%Y.%m.%d-%H%M")

echo "Version: $VERSION"
echo "Commit: $COMMIT_SHA"

docker compose up -d --build

echo "Running smoke tests..."

./scripts/smoke-test.sh

RESULT=$?

if [ $RESULT -eq 0 ]
then

    STATUS="success"
    SMOKE="true"

    echo "Deploy aprovado"

else

    STATUS="failed"
    SMOKE="false"

    echo "Deploy falhou"

fi

curl -X POST http://localhost:3000/deploy-registry \
-H "Content-Type: application/json" \
-d "{
    \"version\":\"$VERSION\",
    \"commit_sha\":\"$COMMIT_SHA\",
    \"status\":\"$STATUS\",
    \"smoke_test_passed\":$SMOKE,
    \"notes\":\"Deploy automático\"
}"

echo "Deploy registrado"