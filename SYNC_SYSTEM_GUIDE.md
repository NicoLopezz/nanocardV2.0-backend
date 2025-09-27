# Sistema de Sincronización Incremental

## 📋 Descripción

Sistema inteligente para sincronizar datos de CryptoMate con la base de datos local, detectando automáticamente cards nuevas y transacciones faltantes.

## 🏗️ Arquitectura

### Componentes:

1. **`models/SyncLog.js`** - Modelo para almacenar registro de sincronizaciones
2. **`services/syncService.js`** - Servicio principal de sincronización
3. **`scripts/sync-incremental.js`** - Script ejecutable para sincronización

### Base de Datos:

El registro de sincronización se almacena en la colección `SyncLog` con el siguiente documento:

```json
{
  "_id": "last_sync",
  "type": "last_sync",
  "lastSyncTimestamp": "2024-01-15T10:30:00.000Z",
  "lastSyncCardId": "card_123456",
  "totalExecutions": 15,
  "lastExecution": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "cardsImported": 2,
    "transactionsImported": 23,
    "cardsUpdated": 0,
    "transactionsUpdated": 0,
    "executionTime": "1.8s",
    "status": "success",
    "errors": []
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## 🚀 Uso

### Sincronización Incremental (Recomendada)

```bash
# Sincronización normal (solo cambios desde la última vez)
node scripts/sync-incremental.js
```

### Sincronización Completa

```bash
# Sincronización completa (primera vez o cuando hay problemas)
node scripts/sync-incremental.js --full
```

### Sincronización desde Fecha Específica

```bash
# Sincronizar desde una fecha específica
node scripts/sync-incremental.js --from="2024-01-01T00:00:00.000Z"
```

## 🔄 Flujo de Sincronización

### 1. **Primera Ejecución**
- Detecta que no hay registro previo
- Realiza sincronización completa
- Crea registro inicial en `SyncLog`

### 2. **Ejecuciones Posteriores**
- Lee el `lastSyncTimestamp` del registro
- Consulta CryptoMate API por cambios desde esa fecha
- Solo importa cards y transacciones nuevas
- Actualiza el registro de sincronización

### 3. **Detección de Cards Nuevas**
- Obtiene todas las cards de CryptoMate
- Compara con cards existentes en BD local
- Identifica cards que no existen localmente

### 4. **Detección de Transacciones Faltantes**
- Obtiene todas las transacciones de CryptoMate
- Compara con transacciones existentes en BD local
- Identifica transacciones que no existen localmente

## 📊 Estadísticas de Ejecución

El sistema registra automáticamente:

- **Cards importadas**: Nuevas cards agregadas
- **Transacciones importadas**: Nuevas transacciones agregadas
- **Tiempo de ejecución**: Duración total del proceso
- **Estado**: success, error, o partial
- **Errores**: Lista de errores encontrados

## 🛠️ Manejo de Errores

### Estados de Ejecución:

- **`success`**: Sincronización completada sin errores
- **`partial`**: Sincronización completada con algunos errores
- **`error`**: Sincronización falló completamente

### Recuperación de Errores:

```bash
# Si hay errores, ejecutar sincronización completa
node scripts/sync-incremental.js --full
```

## 🔍 Monitoreo

### Verificar Última Sincronización:

```javascript
// En MongoDB
db.synclogs.findOne({_id: "last_sync"})
```

### Verificar Estado del Sistema:

```bash
# Ver logs de la última ejecución
node scripts/sync-incremental.js
```

## ⚡ Optimizaciones

### Para Producción:

1. **Ejecutar periódicamente**: Usar cron job para ejecutar cada hora
2. **Monitoreo**: Verificar logs de sincronización regularmente
3. **Backup**: Hacer backup de `SyncLog` antes de cambios importantes

### Ejemplo de Cron Job:

```bash
# Ejecutar cada hora
0 * * * * cd /path/to/nano2.0-backend && node scripts/sync-incremental.js >> /var/log/sync.log 2>&1
```

## 🚨 Consideraciones Importantes

1. **API Limits**: El sistema respeta los límites de la API de CryptoMate
2. **Performance**: La sincronización incremental es mucho más rápida que la completa
3. **Datos**: Siempre mantiene un registro de la última sincronización
4. **Recuperación**: Puede recuperarse de errores automáticamente

## 🔧 Troubleshooting

### Problema: "No previous sync found"
**Solución**: Ejecutar con `--full` la primera vez

### Problema: "API Key does not have permission"
**Solución**: Verificar configuración de API key en variables de entorno

### Problema: "Database connection failed"
**Solución**: Verificar configuración de base de datos y conectividad

## 📝 Logs

Los logs se muestran en consola con formato:
- ✅ Éxito
- ❌ Error
- 🔄 Proceso
- 📊 Estadísticas
- ⚠️ Advertencias

Ejemplo de salida:
```
🚀 Starting Nano Backend Incremental Sync
==================================================
✅ Databases connected successfully
🔄 Performing incremental sync...
🔍 Detecting new cards...
📊 Found 2 new cards out of 150 total cards
🔍 Detecting missing transactions...
📊 Found 15 missing transactions out of 1250 total transactions
📥 Importing 2 new cards...
✅ Successfully imported 2/2 cards
📥 Importing 15 missing transactions...
✅ Successfully imported 15/15 transactions
✅ Sync log updated successfully
✅ Incremental sync completed successfully
📊 Stats: 2 cards, 15 transactions in 2.3s
==================================================
✅ Sync completed successfully!
📊 Summary:
   - Cards imported: 2
   - Transactions imported: 15
   - Execution time: 2.3s
   - Status: success
==================================================
```
