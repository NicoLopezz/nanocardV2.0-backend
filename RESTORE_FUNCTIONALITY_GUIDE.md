# Guía de Funcionalidad de Restore

## Descripción

Se ha implementado un sistema completo de **soft delete** con capacidad de **restore** para transacciones. Esto permite:

- Eliminar transacciones manteniendo el historial completo
- Restaurar transacciones eliminadas
- Mantener un registro completo de todas las acciones (delete/restore)
- Recalcular automáticamente las estadísticas

## Endpoints Implementados

### 1. DELETE Transaction (Ya existía)
```http
DELETE /api/cards/card/{cardId}/transactions/{transactionId}
```

**Funcionalidad:**
- Marca la transacción como eliminada (`status: 'DELETED'`, `isDeleted: true`)
- Agrega entrada al historial con `action: 'deleted'`
- Recalcula estadísticas de la tarjeta
- Mantiene el registro de quién eliminó y cuándo

### 2. RESTORE Transaction (NUEVO)
```http
POST /api/cards/card/{cardId}/transactions/{transactionId}/restore
```

**Funcionalidad:**
- Restaura la transacción a su estado original
- Marca como activa (`isDeleted: false`, `status: originalStatus`)
- **Restaura el comentario original** (elimina "Deleted at..." y restaura el comentario previo)
- Agrega entrada al historial con `action: 'restored'`
- Recalcula estadísticas de la tarjeta
- Limpia campos de eliminación (`deletedAt`, `deletedBy`)

## Modelo de Datos Actualizado

### Campos Nuevos en Transaction
```javascript
{
  // Campos existentes...
  deletedAt: Date,           // Cuándo se eliminó
  deletedBy: String,         // Quién eliminó (userId)
  restoredAt: Date,          // Cuándo se restauró
  restoredBy: String,       // Quién restauró (userId)
  
  // Historial con nuevas acciones
  history: [{
    action: 'created' | 'updated' | 'deleted' | 'restored',
    // ... otros campos
  }]
}
```

## Flujo de Uso

### 1. Eliminar una Transacción
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:3002/api/cards/card/CARD_ID/transactions/TRANSACTION_ID"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Transaction deleted successfully",
  "transaction": { /* transacción actualizada */ },
  "updatedCardStats": {
    "deposited": 1000,
    "posted": 500,
    "available": 500
  }
}
```

### 2. Restaurar una Transacción
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:3002/api/cards/card/CARD_ID/transactions/TRANSACTION_ID/restore"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Transaction restored successfully",
  "transaction": { /* transacción restaurada */ },
  "updatedCardStats": {
    "deposited": 1000,
    "posted": 500,
    "available": 500
  }
}
```

## Verificación de Estados

### Ver Transacciones (Incluyendo Eliminadas)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3002/api/cards/card/CARD_ID/transactions?action=all-movements"
```

### Ver Historial de una Transacción
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3002/api/cards/card/CARD_ID/transactions/TRANSACTION_ID/history"
```

## Scripts de Prueba

### 1. Script de Prueba Automatizado
```bash
node test-restore-functionality.js
```

### 2. Script de Prueba Manual
```bash
./test-restore-curl.sh CARD_ID TRANSACTION_ID AUTH_TOKEN
```

### 3. Script de Prueba Legacy
```bash
node test-legacy-restore.js
```

## Migración de Transacciones Legacy

### Script de Migración
Para transacciones que fueron eliminadas antes de implementar el historial de comentarios:

```bash
node fix-deleted-transactions-history.js
```

**Funcionalidad:**
- Busca transacciones eliminadas sin historial de comentario
- Agrega el historial de comentario faltante
- Permite restaurar con comentarios correctos

**Uso recomendado:**
1. Ejecutar el script de migración
2. Probar restore en transacciones legacy
3. Verificar que los comentarios se restauran correctamente

## Casos de Uso

### Escenario 1: Eliminar y Restaurar
1. **v1**: Transacción original creada (comentario: "Pago en tienda")
2. **v2**: Transacción eliminada (comentario: "Deleted at 15/12/2024 2:30 PM")
3. **v3**: Transacción restaurada (comentario: "Pago en tienda" - restaurado)
4. **v4**: Transacción eliminada nuevamente (comentario: "Deleted at 15/12/2024 2:35 PM")
5. **v5**: Transacción restaurada nuevamente (comentario: "Pago en tienda" - restaurado)

Cada paso queda registrado en el historial con:
- Timestamp exacto
- Usuario que realizó la acción
- Cambios específicos realizados (status, isDeleted, comentario)
- Razón de la acción

### Escenario 2: Auditoría Completa
- Ver todas las transacciones (activas y eliminadas)
- Ver historial completo de cada transacción
- Rastrear quién hizo qué y cuándo
- Verificar integridad de estadísticas

## Validaciones

### Para DELETE:
- ✅ Transacción debe existir
- ✅ Transacción no debe estar ya eliminada
- ✅ Usuario debe tener permisos

### Para RESTORE:
- ✅ Transacción debe existir
- ✅ Transacción debe estar eliminada
- ✅ Usuario debe tener permisos
- ✅ Restaura al estado original (antes del delete)

## Estadísticas

Las estadísticas se recalculan automáticamente después de cada operación:
- **DELETE**: Excluye la transacción de los cálculos
- **RESTORE**: Incluye la transacción en los cálculos

## Frontend Integration

Para el frontend, puedes:

1. **Mostrar botón DELETE** cuando `isDeleted: false`
2. **Mostrar botón RESTORE** cuando `isDeleted: true`
3. **Mostrar historial** con todas las acciones
4. **Actualizar stats** después de cada operación

### Ejemplo de Lógica Frontend
```javascript
// Determinar qué botón mostrar
const showDeleteButton = !transaction.isDeleted && transaction.status !== 'DELETED';
const showRestoreButton = transaction.isDeleted || transaction.status === 'DELETED';

// Endpoints a llamar
const deleteUrl = `/api/cards/card/${cardId}/transactions/${transactionId}`;
const restoreUrl = `/api/cards/card/${cardId}/transactions/${transactionId}/restore`;
```

## Manejo de Comentarios

### Durante DELETE:
- **El comentario original NO se modifica** - se mantiene exactamente igual
- Solo se cambia el `status` a 'DELETED' y `isDeleted` a true
- El comentario del usuario permanece intacto
- El historial solo registra cambios de status, NO de comentario

### Durante RESTORE:
- **El comentario NO se modifica** - se mantiene exactamente igual
- Solo se cambia el `status` al valor original y `isDeleted` a false
- El comentario del usuario permanece intacto
- El historial solo registra cambios de status e isDeleted, NO de comentario

### Ejemplo de Flujo de Comentarios:

#### Comportamiento Correcto (comentario intacto):
```
Original: "Pago en supermercado"
↓ DELETE
Comentario: "Pago en supermercado" (SIN CAMBIOS)
Historial: { field: 'status', oldValue: 'Completed', newValue: 'DELETED' }
↓ RESTORE  
Comentario: "Pago en supermercado" (SIN CAMBIOS)
Historial: { field: 'status', oldValue: 'DELETED', newValue: 'Completed' }
```

#### Múltiples Ciclos:
```
"Comentario del usuario" → DELETE → "Comentario del usuario" → RESTORE → "Comentario del usuario" → DELETE → "Comentario del usuario"
```

## Notas Importantes

1. **Soft Delete**: Las transacciones nunca se eliminan físicamente
2. **Historial Completo**: Todas las acciones quedan registradas
3. **Comentarios**: Se preservan y restauran correctamente
4. **Estadísticas**: Se recalculan automáticamente
5. **Permisos**: Requiere autenticación válida
6. **Versionado**: Cada cambio incrementa la versión
7. **Auditoría**: Trazabilidad completa de todas las acciones

## Troubleshooting

### Error: "Transaction is not deleted, cannot restore"
- La transacción no está eliminada
- Verificar `isDeleted` y `status`

### Error: "Transaction is already deleted"
- La transacción ya está eliminada
- No se puede eliminar dos veces

### Error: "Transaction not found"
- Verificar que el `cardId` y `transactionId` sean correctos
- Verificar permisos de acceso
