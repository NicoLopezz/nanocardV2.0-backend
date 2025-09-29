# Stats Microservice Guide

## 🎯 Objetivo

Separar las responsabilidades de la aplicación para tener una arquitectura más limpia y escalable:

- **Transactions Service**: Solo maneja CRUD de transacciones
- **Stats Service**: Solo consume y muestra estadísticas  
- **Stats Refresh Service**: Se encarga de actualizar las stats cuando hay cambios

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Transactions  │    │   Event Service  │    │ Stats Refresh   │
│     Service     │───▶│                  │───▶│    Service      │
│                 │    │                  │    │                 │
│ - Create        │    │ - Event Listeners│    │ - User Stats    │
│ - Update        │    │ - Event Emitters │    │ - Card Stats    │
│ - Delete        │    │ - Auto Updates   │    │ - Batch Ops     │
│ - Restore       │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Database      │    │   Event System   │    │   API Routes    │
│                 │    │                  │    │                 │
│ - Transactions  │    │ - Auto Triggers  │    │ - /api/stats    │
│ - Users         │    │ - Async Updates  │    │ - Batch Endpoints│
│ - Cards         │    │ - Error Handling │    │ - Health Checks  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
- `services/statsRefreshService.js` - Microservicio de actualización de stats
- `services/eventService.js` - Sistema de eventos para comunicación
- `routes/internal/stats.js` - Rutas API para el microservicio
- `scripts/test-stats-microservice.js` - Script de testing

### Archivos Modificados
- `services/transactionService.js` - Refactorizado para solo CRUD
- `app.js` - Agregadas rutas de stats y inicialización de eventos

## 🚀 Uso del Microservicio

### 1. Actualización Automática (Eventos)

Las stats se actualizan automáticamente cuando hay cambios en transacciones:

```javascript
// Al crear una transacción
const transaction = await createTransaction(transactionData);
// ✅ EventService.emitTransactionCreated() se ejecuta automáticamente
// ✅ StatsRefreshService.refreshAllStats() se ejecuta automáticamente

// Al actualizar una transacción  
await updateTransaction(transactionId, updates, modifiedBy, reason);
// ✅ EventService.emitTransactionUpdated() se ejecuta automáticamente

// Al eliminar una transacción
await deleteTransaction(transactionId, deletedBy, reason);
// ✅ EventService.emitTransactionDeleted() se ejecuta automáticamente
```

### 2. API Endpoints

#### Refrescar Stats de Usuario
```bash
POST /api/stats/users/:userId/refresh
Content-Type: application/json

{
  "cardId": "card_id_here",
  "transactionData": { ... },
  "action": "create"
}
```

#### Recalcular Stats de Usuario
```bash
POST /api/stats/users/:userId/recalculate
```

#### Refrescar Stats de Tarjeta
```bash
POST /api/stats/cards/:cardId/refresh
```

#### Obtener Stats de Tarjeta
```bash
GET /api/stats/cards/:cardId
```

#### Batch Operations
```bash
# Refrescar múltiples usuarios
POST /api/stats/users/batch/refresh
{
  "userIds": ["user1", "user2", "user3"]
}

# Refrescar múltiples tarjetas
POST /api/stats/cards/batch/refresh
{
  "cardIds": ["card1", "card2", "card3"]
}
```

### 3. Uso Programático

```javascript
const StatsRefreshService = require('./services/statsRefreshService');
const EventService = require('./services/eventService');

// Refrescar stats de un usuario
await StatsRefreshService.refreshUserStats(userId, transactionData, 'create');

// Refrescar stats de una tarjeta
await StatsRefreshService.refreshCardStats(cardId);

// Recalcular stats completas
await StatsRefreshService.recalculateUserStats(userId);
await StatsRefreshService.recalculateCardStats(cardId);

// Emitir eventos manualmente
EventService.emitTransactionCreated(userId, cardId, transaction);
EventService.emitTransactionUpdated(userId, cardId, transaction);
EventService.emitTransactionDeleted(userId, cardId, transaction);
```

## 🔧 Configuración

### Inicialización Automática

El sistema se inicializa automáticamente al arrancar el servidor:

```javascript
// En app.js
EventService.initialize(); // ✅ Se ejecuta automáticamente
```

### Event Listeners

Los listeners se configuran automáticamente:

```javascript
// EventService.initialize() configura:
- transaction.created → StatsRefreshService.refreshAllStats()
- transaction.updated → StatsRefreshService.refreshAllStats()  
- transaction.deleted → StatsRefreshService.refreshAllStats()
- transaction.restored → StatsRefreshService.refreshAllStats()
```

## 🧪 Testing

### Ejecutar Tests

```bash
# Test del microservicio
node scripts/test-stats-microservice.js

# Test de endpoints
curl -X POST http://localhost:3002/api/stats/users/USER_ID/refresh
curl -X GET http://localhost:3002/api/stats/cards/CARD_ID
```

### Verificar Funcionamiento

1. **Crear una transacción** → Verificar que las stats se actualicen automáticamente
2. **Actualizar una transacción** → Verificar que las stats se recalculen
3. **Eliminar una transacción** → Verificar que las stats se ajusten
4. **Usar endpoints de stats** → Verificar que funcionen correctamente

## 📊 Beneficios

### ✅ Separación de Responsabilidades
- **Transactions**: Solo CRUD
- **Stats**: Solo consumo y presentación
- **Stats Refresh**: Solo actualización de estadísticas

### ✅ Escalabilidad
- Microservicio independiente
- Fácil de testear
- Fácil de mantener

### ✅ Flexibilidad
- Actualización automática por eventos
- Actualización manual por API
- Batch operations para eficiencia

### ✅ Consistencia
- Sistema de eventos garantiza consistencia
- Manejo de errores centralizado
- Logs detallados

## 🔍 Monitoreo

### Logs del Sistema

```bash
# Al crear transacción
✅ Stats updated after transaction creation: transaction_id

# Al actualizar transacción  
✅ Stats updated after transaction update: transaction_id

# Al eliminar transacción
✅ Stats updated after transaction deletion: transaction_id

# Errores
❌ Error updating stats after transaction creation: error_message
```

### Health Checks

```bash
# Verificar que el sistema esté funcionando
GET /api/health

# Verificar stats de una tarjeta
GET /api/stats/cards/:cardId
```

## 🚨 Troubleshooting

### Problemas Comunes

1. **Stats no se actualizan automáticamente**
   - Verificar que EventService.initialize() se ejecute
   - Verificar que los listeners estén configurados

2. **Errores en batch operations**
   - Verificar que los IDs sean válidos
   - Verificar permisos de base de datos

3. **Performance lenta**
   - Usar batch operations en lugar de operaciones individuales
   - Considerar implementar cache si es necesario

### Debug

```javascript
// Verificar eventos
console.log(EventService.eventListeners);

// Verificar stats de usuario
const user = await User.findById(userId);
console.log(user.stats);

// Verificar stats de tarjeta
const card = await Card.findById(cardId);
console.log(card.transactionStats);
```

## 🔄 Migración

### Antes (Código Anterior)
```javascript
// ❌ Todo mezclado en transactionService
await createTransaction(data);
await updateUserStats(userId, data); // ❌ Acoplado
```

### Después (Nuevo Sistema)
```javascript
// ✅ Separado y desacoplado
await createTransaction(data); // ✅ Solo CRUD
// ✅ EventService maneja la actualización automáticamente
```

## 📈 Próximos Pasos

1. **Cache Layer**: Implementar cache para stats frecuentemente consultadas
2. **Metrics**: Agregar métricas de performance del microservicio
3. **Queue System**: Implementar cola para operaciones batch grandes
4. **Real-time Updates**: WebSockets para updates en tiempo real
5. **Analytics**: Dashboard de estadísticas del microservicio
