# Admin Dashboard - Transacciones Eliminadas

## Resumen

Se ha implementado la funcionalidad para que el dashboard admin pueda ver **TODAS las transacciones** (incluyendo las eliminadas) para propósitos de auditoría, manteniendo las estadísticas correctas que **NO incluyen** las transacciones eliminadas.

## ✅ Endpoint Actualizado

**Endpoint existente**: `/api/cards/card/:cardId/transactions`

Ahora soporta un nuevo parámetro query:

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `cardId` | string | ✅ | ID de la tarjeta (en la URL) |
| `page` | number | ❌ | Número de página (default: 1) |
| `limit` | number | ❌ | Límite por página (default: 50) |
| `sortBy` | string | ❌ | Campo de ordenamiento (default: 'date') |
| `sortOrder` | string | ❌ | Orden: 'asc' o 'desc' (default: 'desc') |
| `action` | string | ❌ | **NUEVO**: `all-movements` para incluir eliminadas |

## 🎯 Uso en Frontend

### Vista Normal (Solo Activas)
```javascript
// URL actual - sin cambios
const url = `/api/cards/card/${cardId}/transactions?limit=1000&page=1`;
```

### Vista Admin con Eliminadas
```javascript
// NUEVA - agregar action=all-movements
const url = `/api/cards/card/${cardId}/transactions?limit=1000&page=1&action=all-movements`;
```

## 📊 Respuesta del Endpoint

### Sin `action=all-movements` (comportamiento normal)
```json
{
  "success": true,
  "card": { "...": "..." },
  "stats": {
    "totalTransactions": 3,
    "totalDeposited": 0,
    "totalRefunded": 43.88,
    "totalPosted": 91.93,
    "totalAvailable": -48.05
  },
  "transactions": [
    // Solo transacciones activas
  ]
}
```

### Con `action=all-movements` (incluye eliminadas)
```json
{
  "success": true,
  "card": { "...": "..." },
  "stats": {
    "totalTransactions": 3,        // Solo activas (para cálculos)
    "totalDeposited": 0,           // Solo activas
    "totalRefunded": 43.88,        // Solo activas  
    "totalPosted": 91.93,          // Solo activas
    "totalAvailable": -48.05,      // Solo activas
    "totalDeletedTransactions": 1, // 🆕 Conteo de eliminadas
    "totalAllTransactions": 4      // 🆕 Total incluyendo eliminadas
  },
  "transactions": [
    {
      "_id": "...",
      "status": "SUCCESS",
      "isDeleted": false,           // 🆕 Flag para UI
      // ... resto de campos
    },
    {
      "_id": "...", 
      "status": "DELETED",
      "isDeleted": true,            // 🆕 Flag para UI
      "comentario": "Deleted at 25/09/2025 03:51 PM",
      // ... resto de campos
    }
  ]
}
```

## 🎨 Implementación Frontend

### 1. Detección de Transacciones Eliminadas
```javascript
// Cada transacción incluye el flag isDeleted
transaction.isDeleted // true si está eliminada
```

### 2. Estilos Visuales Sugeridos
```css
/* Transacción eliminada */
.transaction-deleted {
  opacity: 0.6;
  background-color: #fee;
  border-left: 3px solid #f56565;
}

.transaction-deleted .amount {
  text-decoration: line-through;
  color: #718096;
}

/* Badge de eliminada */
.deleted-badge {
  background-color: #fed7d7;
  color: #c53030;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}
```

### 3. Lógica de Componente
```javascript
const fetchTransactions = (cardId, includeDeleted = false) => {
  const baseUrl = `/api/cards/card/${cardId}/transactions`;
  const params = new URLSearchParams({
    limit: '1000',
    page: '1'
  });
  
  if (includeDeleted) {
    params.append('action', 'all-movements');
  }
  
  return fetch(`${baseUrl}?${params}`);
};

// Renderizar transacciones
const renderTransaction = (transaction) => {
  const className = transaction.isDeleted 
    ? 'transaction deleted' 
    : 'transaction active';
    
  return (
    <div className={className}>
      <span className="name">{transaction.name}</span>
      <span className="amount">${transaction.amount}</span>
      {transaction.isDeleted && (
        <span className="deleted-badge">ELIMINADA</span>
      )}
    </div>
  );
};
```

### 4. Toggle para Admin
```javascript
const [showDeleted, setShowDeleted] = useState(false);

// Botón toggle
<button onClick={() => setShowDeleted(!showDeleted)}>
  {showDeleted ? 'Ocultar Eliminadas' : 'Mostrar Eliminadas'}
</button>

// Fetch basado en toggle
useEffect(() => {
  fetchTransactions(cardId, showDeleted);
}, [cardId, showDeleted]);
```

## ⚠️ Consideraciones Importantes

### 1. Estadísticas Siempre Correctas
- Los `stats` **SIEMPRE** se calculan solo con transacciones activas
- No importa si `action=all-movements` está presente
- Los totales financieros son confiables para reportes

### 2. Caché Inteligente
- Las peticiones con `action=all-movements` **NO se almacenan en caché**
- Solo las vistas normales usan caché para mejor performance
- Esto asegura datos actualizados para auditorías

### 3. Información Adicional
Cuando `action=all-movements` está presente:
- `totalDeletedTransactions`: Cantidad de transacciones eliminadas
- `totalAllTransactions`: Total incluyendo activas + eliminadas
- Útil para mostrar conteos en la UI

## 🔧 Testing

### Prueba 1: Vista Normal
```bash
GET /api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000
# Resultado: Solo transacciones activas
```

### Prueba 2: Vista Admin 
```bash
GET /api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000&action=all-movements  
# Resultado: Todas las transacciones (activas + eliminadas)
```

## 📝 Ejemplo de URL Completa

```
http://localhost:3001/api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions?limit=1000&page=1&action=all-movements
```

---

**✅ Implementado y listo para usar**  
**🔒 Compatible con roles de admin**  
**📊 Stats siempre correctos**  
**🎨 UI flags incluidos**

