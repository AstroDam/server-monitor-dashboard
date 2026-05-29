#!/bin/bash

echo "Running smoke tests..."

HEALTH=$(curl -s http://localhost:3000/health)

if [[ $HEALTH != *"healthy"* ]]; then
  echo "Health check failed"
  exit 1
fi

DEPLOY=$(curl -s http://localhost:3000/deploy/validate)

if [[ $DEPLOY != *"deploy_valid"* ]]; then
  echo "Deploy validation failed"
  exit 1
fi

echo "Smoke tests passed"
exit 0