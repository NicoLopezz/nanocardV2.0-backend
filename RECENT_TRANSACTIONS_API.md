# Recent Transactions API

## Endpoint: GET /api/transactions/recent

Obtiene las últimas transacciones registradas en el sistema con información completa del usuario y tarjeta.

### Parámetros de Query

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `limit` | number | No | 10 | Número de transacciones a retornar (máximo 50) |

### Respuesta

#### Estructura de Respuesta Exitosa

```json
{
  "success": true,
  "data": {
    "queryDate": "2024-01-15T10:30:00.000Z",
    "totalTransactions": 10,
    "transactions": [
      {
        "transactionId": "txn_123456789",
        "userId": "john_doe",
        "userName": "John Doe",
        "cardId": "card_123456",
        "cardName": "John Doe - Card 1234",
        "last4": "1234",
        "transactionDetails": {
          "name": "Starbucks Coffee",
          "amount": 150.00,
          "date": "2024-01-15",
          "time": "09:45 AM",
          "operation": "TRANSACTION_APPROVED",
          "status": "TRANSACTION_APPROVED",
          "city": "New York",
          "country": "USA",
          "mcc_category": "5812",
          "mercuryCategory": "Food & Dining",
          "credit": false,
          "comentario": null
        },
        "timestamp": "2024-01-15T09:45:00.000Z"
      }
    ],
    "metadata": {
      "generatedAt": "2024-01-15T10:30:00.000Z",
      "queryDuration": "145ms",
      "filters": {
        "limit": 10,
        "orderBy": "date",
        "order": "desc",
        "includeDeleted": false
      }
    }
  }
}
```

#### Estructura de Respuesta de Error

```json
{
  "success": false,
  "error": "Limit cannot exceed 50 transactions"
}
```

### Ejemplos de Uso

#### Obtener las últimas 10 transacciones (default)
```bash
curl -X GET "http://localhost:3000/api/transactions/recent"
```

#### Obtener las últimas 5 transacciones
```bash
curl -X GET "http://localhost:3000/api/transactions/recent?limit=5"
```

#### Obtener las últimas 25 transacciones
```bash
curl -X GET "http://localhost:3000/api/transactions/recent?limit=25"
```

### Características

- **Ordenamiento**: Las transacciones se ordenan por fecha real de transacción (`date` + `time`) en orden descendente (más recientes primero)
- **Filtrado**: Solo incluye transacciones no eliminadas (`isDeleted: false`)
- **Enriquecimiento**: Cada transacción incluye información completa del usuario y tarjeta
- **Manejo de Errores**: Si no se encuentra información del usuario/tarjeta, se usa información de fallback
- **Límite**: Máximo 50 transacciones por consulta para evitar sobrecarga
- **Performance**: Medición automática del tiempo de consulta

### Campos de Transacción

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `transactionId` | string | ID único de la transacción |
| `userId` | string | ID del usuario |
| `userName` | string | Nombre del usuario |
| `cardId` | string | ID de la tarjeta |
| `cardName` | string | Nombre de la tarjeta |
| `last4` | string | Últimos 4 dígitos de la tarjeta |
| `transactionDetails` | object | Detalles completos de la transacción |
| `timestamp` | string | Timestamp de creación de la transacción |

### Estados de Operación

- `TRANSACTION_APPROVED`: Transacción aprobada
- `TRANSACTION_REJECTED`: Transacción rechazada
- `TRANSACTION_REVERSED`: Transacción revertida
- `TRANSACTION_REFUND`: Reembolso
- `WALLET_DEPOSIT`: Depósito a wallet
- `OVERRIDE_VIRTUAL_BALANCE`: Sobrescritura de balance virtual
- `WITHDRAWAL`: Retiro
- `TRANSACTION_PENDING`: Transacción pendiente

### Códigos de Estado HTTP

- `200`: Éxito
- `400`: Error de parámetros (limit > 50)
- `500`: Error interno del servidor

### Testing

Para probar el endpoint, ejecuta:

```bash
node test-recent-transactions.js
```

Este script probará diferentes límites y mostrará la respuesta completa del endpoint.
