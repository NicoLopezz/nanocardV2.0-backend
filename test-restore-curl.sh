#!/bin/bash

# Script para probar la funcionalidad de restore
# Uso: ./test-restore-curl.sh <CARD_ID> <TRANSACTION_ID> <AUTH_TOKEN>

CARD_ID=$1
TRANSACTION_ID=$2
AUTH_TOKEN=$3
BASE_URL="http://localhost:3002"

if [ -z "$CARD_ID" ] || [ -z "$TRANSACTION_ID" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Uso: $0 <CARD_ID> <TRANSACTION_ID> <AUTH_TOKEN>"
    echo "   Ejemplo: $0 507f1f77bcf86cd799439011 ecb4aceb-479d-48bc-8c7c-50a604759c34 your_token_here"
    exit 1
fi

echo "🧪 Testing Restore Functionality..."
echo "Card ID: $CARD_ID"
echo "Transaction ID: $TRANSACTION_ID"
echo "Base URL: $BASE_URL"
echo ""

# Headers comunes
HEADERS=(
    -H "Authorization: Bearer $AUTH_TOKEN"
    -H "Content-Type: application/json"
)

# 1. Verificar estado actual de la transacción
echo "1️⃣ Checking current transaction status..."
curl -s "${HEADERS[@]}" \
    "$BASE_URL/api/cards/card/$CARD_ID/transactions/$TRANSACTION_ID/history" | jq '.'

echo -e "\n"

# 2. Intentar restaurar la transacción
echo "2️⃣ Attempting to restore transaction..."
RESTORE_RESPONSE=$(curl -s -w "\n%{http_code}" "${HEADERS[@]}" \
    -X POST \
    "$BASE_URL/api/cards/card/$CARD_ID/transactions/$TRANSACTION_ID/restore")

# Separar respuesta y código HTTP
RESTORE_BODY=$(echo "$RESTORE_RESPONSE" | head -n -1)
RESTORE_CODE=$(echo "$RESTORE_RESPONSE" | tail -n 1)

echo "HTTP Status: $RESTORE_CODE"
echo "Response:"
echo "$RESTORE_BODY" | jq '.'

echo -e "\n"

# 3. Verificar estado después del restore
echo "3️⃣ Checking transaction status after restore..."
curl -s "${HEADERS[@]}" \
    "$BASE_URL/api/cards/card/$CARD_ID/transactions/$TRANSACTION_ID/history" | jq '.'

echo -e "\n"

# 4. Verificar stats de la tarjeta
echo "4️⃣ Checking card stats..."
curl -s "${HEADERS[@]}" \
    "$BASE_URL/api/cards/card/$CARD_ID/transactions?action=all-movements&limit=5" | jq '.stats'

echo -e "\n"

if [ "$RESTORE_CODE" = "200" ]; then
    echo "✅ Restore test completed successfully!"
else
    echo "❌ Restore test failed with status: $RESTORE_CODE"
fi
