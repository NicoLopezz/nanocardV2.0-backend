#!/bin/bash

# Script para importar todo desde Cryptomate
# Importa cards, usuarios y transacciones en un solo comando

echo "🚀 Starting complete import from Cryptomate..."
echo "📋 Step 1: Importing all cards and users"
echo "💳 Step 2: Importing all transactions"
echo "============================================================"

# Verificar que el servidor esté corriendo
echo ""
echo "🔍 Checking server status..."
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo "✅ Server is running and ready"
else
    echo "❌ Server is not running or not accessible"
    echo "💡 Please start the server with: npm start"
    exit 1
fi

# Paso 1: Importar cards y usuarios
echo ""
echo "📋 STEP 1: Importing cards and users from Cryptomate..."
CARDS_START=$(date +%s)

CARDS_RESULT=$(curl -s -X POST http://localhost:3001/api/real-cryptomate/import-real-data)

if [ $? -eq 0 ]; then
    CARDS_END=$(date +%s)
    CARDS_TIME=$((CARDS_END - CARDS_START))
    
    echo "✅ Cards import completed in ${CARDS_TIME}s"
    
    # Extraer información del resultado (básico)
    echo "📋 Cards import result:"
    echo "$CARDS_RESULT" | grep -o '"cardsImported":[0-9]*' | head -1
    echo "$CARDS_RESULT" | grep -o '"users":[0-9]*' | head -1
    echo "$CARDS_RESULT" | grep -o '"cardsUpdated":[0-9]*' | head -1
else
    echo "❌ Cards import failed"
    exit 1
fi

# Esperar un momento para que se procesen las cards
echo ""
echo "⏳ Waiting 5 seconds for cards to be processed..."
sleep 5

# Paso 2: Importar transacciones
echo ""
echo "💳 STEP 2: Importing transactions from Cryptomate..."
echo "⚡ This may take several minutes depending on the number of cards..."

TRANSACTIONS_START=$(date +%s)

node scripts/import-optimized-transactions.js

TRANSACTIONS_EXIT_CODE=$?
TRANSACTIONS_END=$(date +%s)
TRANSACTIONS_TIME=$((TRANSACTIONS_END - TRANSACTIONS_START))
TRANSACTIONS_MINUTES=$((TRANSACTIONS_TIME / 60))

if [ $TRANSACTIONS_EXIT_CODE -eq 0 ]; then
    echo "✅ Transactions import completed in ${TRANSACTIONS_MINUTES} minutes"
else
    echo "⚠️  Transactions import completed with some errors"
    echo "💡 Check the output above for details"
fi

# Mostrar resumen final
TOTAL_END=$(date +%s)
TOTAL_TIME=$((TOTAL_END - CARDS_START))
TOTAL_MINUTES=$((TOTAL_TIME / 60))

echo ""
echo "============================================================"
echo "🎉 COMPLETE IMPORT FINISHED!"
echo "📊 Final Summary:"
echo "   ⏱️  Total time: ${TOTAL_MINUTES} minutes"
echo "   📈 Cards import: ${CARDS_TIME}s"
echo "   📈 Transactions import: ${TRANSACTIONS_MINUTES} minutes"
echo ""
echo "✅ Your dev database is now fully populated with Cryptomate data!"
echo "🔍 You can verify the import by checking:"
echo "   - GET /api/cards/admin/all (to see all cards)"
echo "   - GET /api/cards/admin/stats (to see statistics)"
echo "   - GET /api/cards/card/{cardId}/transactions (to see transactions)"
echo ""

if [ $TRANSACTIONS_EXIT_CODE -eq 0 ]; then
    echo "🎉 All imports completed successfully!"
    exit 0
else
    echo "⚠️  Import completed with some errors"
    exit 1
fi
