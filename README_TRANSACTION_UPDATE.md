# Script de Actualización de Transacciones

## `complete-transaction-update.js`

### ¿Qué hace?
Script que borra todas las transacciones de un usuario y las importa de nuevo con la lógica corregida.

### ¿Qué corrige?
- **WALLET_DEPOSIT**: Aplica descuento del 0.3% correctamente
- **OVERRIDE_VIRTUAL_BALANCE**: Calcula diferencia entre balances
- **TRANSACTION_REJECTED**: Maneja decline_reason como objeto complejo
- **Stats**: Actualiza card.stats y user.stats con nueva estructura
- **Sync**: Registra fecha y fuente del último sync

### Scripts adicionales
- `verify-update-results.js` - Verificar resultados
- `update-user-transactions.js` - Solo borrar transacciones
