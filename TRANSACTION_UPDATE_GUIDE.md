# Guía de Actualización Completa de Transacciones

## Script Final para Actualización de Movimientos/Transacciones

### Archivos del Sistema:

1. **`complete-transaction-update.js`** - Script principal que ejecuta todo el proceso
2. **`update-user-transactions.js`** - Script de preparación (borra transacciones y muestra comando)
3. **`verify-update-results.js`** - Script de verificación de resultados

### Uso del Script Principal:

```bash
# Ejecutar actualización completa
node complete-transaction-update.js
```

### ¿Qué hace el script?

1. **Conecta a la base de datos**
2. **Borra todas las transacciones** del usuario especificado
3. **Importa todas las transacciones** desde 2024-01-01 hasta 2025-12-31
4. **Aplica la nueva lógica**:
   - WALLET_DEPOSIT: Descuento del 0.3%
   - OVERRIDE_VIRTUAL_BALANCE: Diferencia entre balances
   - TRANSACTION_REJECTED: Maneja decline_reason como objeto complejo
5. **Actualiza las stats** de la card y del usuario
6. **Registra el último sync** con fecha y fuente

### Configuración Actual:

- **Usuario**: `CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ`
- **Período**: 2024-01-01 a 2025-12-31 (TODO 2024 Y 2025)
- **Operaciones**: Todas las tipos incluidas
- **Servidor**: http://localhost:3001
- **Endpoint**: `/api/real-cryptomate/import-transactions/{userId}`

### Resultados Esperados:

- ✅ **36 transacciones** importadas (todas las que llegan por API)
- ✅ **Stats de card** actualizadas con nueva estructura
- ✅ **Stats de usuario** actualizadas
- ✅ **LastSync** registrado correctamente
- ✅ **Decline_reason** objetos complejos manejados correctamente

### Verificación Manual:

Si quieres verificar los resultados manualmente:

```bash
# Verificar resultados
node verify-update-results.js
```

### Cambios Realizados en el Sistema:

1. **Modelo Transaction**: `decline_reason` ahora acepta objetos complejos
2. **Lógica de importación**: Aplica descuentos y cálculos correctos
3. **Stats de card**: Usa nueva estructura con campos individuales
4. **Stats de usuario**: Registra último sync y fuente

### Comando Manual (si necesitas ejecutarlo paso a paso):

```bash
# 1. Preparar (borrar transacciones)
node update-user-transactions.js

# 2. Ejecutar importación manual
curl -X POST http://localhost:3001/api/real-cryptomate/import-transactions/CsDoSzkWqjQkLTuy1K1c1FFE0lM44gfJ \
  -H "Content-Type: application/json" \
  -d '{
    "fromDate": "2024-01-01",
    "toDate": "2025-12-31",
    "maxPages": 10,
    "operations": "TRANSACTION_APPROVED,TRANSACTION_REJECTED,TRANSACTION_REVERSED,TRANSACTION_REFUND,WALLET_DEPOSIT,OVERRIDE_VIRTUAL_BALANCE"
  }'

# 3. Verificar resultados
node verify-update-results.js
```

### Notas Importantes:

- El servidor debe estar corriendo en puerto 3001
- Se borran TODAS las transacciones del usuario antes de importar
- Se importan TODAS las transacciones del período especificado
- Las stats se actualizan automáticamente con la nueva lógica
- Se registra la fecha y fuente del último sync

