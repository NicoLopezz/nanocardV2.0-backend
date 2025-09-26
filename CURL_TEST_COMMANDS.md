# CURL Commands para Testing - Admin Transactions

## 🧪 Comandos CURL para Postman/Testing

### 1. Vista Normal (Solo Transacciones Activas)
```bash
curl -X GET "http://localhost:3001/api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000&page=1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Vista Admin (Todas las Transacciones - Incluyendo Eliminadas)
```bash
curl -X GET "http://localhost:3001/api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000&page=1&action=all-movements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Template Genérico (Reemplaza CARD_ID)
```bash
# Vista Normal
curl -X GET "http://localhost:3001/api/cards/card/{CARD_ID}/transactions?limit=1000&page=1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Vista Admin
curl -X GET "http://localhost:3001/api/cards/card/{CARD_ID}/transactions?limit=1000&page=1&action=all-movements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Para Postman

### Request 1: Solo Activas
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000&page=1`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_JWT_TOKEN`

### Request 2: Todas (Incluyendo Eliminadas)
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000&page=1&action=all-movements`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_JWT_TOKEN`

## 🎯 Resultados Esperados

### Sin `action=all-movements`:
```json
{
  "success": true,
  "stats": {
    "totalTransactions": 3,
    "totalDeposited": 0,
    "totalRefunded": 43.88,
    "totalPosted": 91.93
  },
  "transactions": [
    // Solo 3 transacciones activas
  ]
}
```

### Con `action=all-movements`:
```json
{
  "success": true,
  "stats": {
    "totalTransactions": 3,        // Solo activas para cálculos
    "totalDeposited": 0,
    "totalRefunded": 43.88,
    "totalPosted": 91.93,
    "totalDeletedTransactions": 1,  // 🆕 Conteo de eliminadas
    "totalAllTransactions": 4         // 🆕 Total incluyendo eliminadas
  },
  "transactions": [
    // 4 transacciones: 3 activas + 1 eliminada
    {
      "isDeleted": false,
      "status": "SUCCESS"
    },
    {
      "isDeleted": true,
      "status": "DELETED",
      "comentario": "Deleted at 25/09/2025 03:51 PM"
    }
  ]
}
```

## 🔍 Debug en Servidor

Si quieres ver los logs del servidor para debuggear:

```bash
# En la terminal donde corre el backend, deberías ver:
🔍 Debug - cardId: 95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo, action: all-movements, includeDeleted: true
✅ Card transactions fetched from database in XXXms
```

## 🚀 Testing Rápido

### 1. Obtener JWT Token (si no lo tienes)
```bash
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### 2. Usar el Token en las Requests
Reemplaza `YOUR_JWT_TOKEN` con el token obtenido del login.

### 3. Probar con Diferentes Card IDs
```bash
# Cambia el CARD_ID por cualquier ID de tarjeta
curl -X GET "http://localhost:3001/api/cards/card/OTRO_CARD_ID/transactions?limit=1000&page=1&action=all-movements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## ⚡ Quick Test Script

```bash
#!/bin/bash
CARD_ID="95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo"
TOKEN="YOUR_JWT_TOKEN"

echo "🧪 Testing Normal View (Active Only)..."
curl -s -X GET "http://localhost:3001/api/cards/card/$CARD_ID/transactions?limit=1000&page=1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq '.transactions | length'

echo "🧪 Testing Admin View (All Transactions)..."
curl -s -X GET "http://localhost:3001/api/cards/card/$CARD_ID/transactions?limit=1000&page=1&action=all-movements" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq '.transactions | length'
```

**Resultado esperado:**
- Primera llamada: `3` (solo activas)
- Segunda llamada: `4` (activas + eliminadas)

