# Nano Backend

Backend para la aplicación Nano con sistema de versionado de transacciones.

## 🚀 Características

- **Sistema de versionado** - Historial completo de cambios en transacciones
- **Soft delete** - Las transacciones no se pierden realmente
- **KPIs en tiempo real** - Estadísticas actualizadas automáticamente
- **Múltiples bases de datos** - Separación por dominio (users, cards, transactions)

## 📁 Estructura

```
├── config/
│   └── database.js          # Configuración de múltiples DBs
├── models/
│   ├── User.js              # Modelo de usuarios
│   ├── Card.js              # Modelo de tarjetas
│   └── Transaction.js       # Modelo de transacciones con versionado
├── services/
│   └── transactionService.js # Lógica de negocio de transacciones
├── routes/
│   └── transactions.js      # Rutas de transacciones
├── app.js                   # Aplicación principal
└── package.json
```

## 🛠️ Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp env.example .env
# Editar .env con tus configuraciones
```

3. Iniciar MongoDB (local o en la nube)

4. Ejecutar el servidor:
```bash
# Desarrollo (usa bases de datos con sufijo _dev)
npm run dev

# Producción (usa bases de datos con sufijo _prod)
npm start
# o
npm run prod

# Testing (usa bases de datos con sufijo _test)
npm test
```

## 🌍 Configuración de Entornos

El backend está configurado para manejar múltiples entornos automáticamente:

### **Desarrollo (`NODE_ENV=development`)**
- Bases de datos: `nano_users_dev`, `nano_cards_dev`, `nano_transactions_dev`
- Puerto: 3001
- Logs detallados

### **Producción (`NODE_ENV=production`)**
- Bases de datos: `nano_users_prod`, `nano_cards_prod`, `nano_transactions_prod`
- Puerto: 3001
- Logs mínimos

### **Testing (`NODE_ENV=test`)**
- Bases de datos: `nano_users_test`, `nano_cards_test`, `nano_transactions_test`
- Puerto: 3002
- Configuración optimizada para tests

### **Variables de Entorno**

El sistema usa tu configuración existente de `.env` y crea automáticamente las bases de datos separadas:

```env
# Tu configuración existente
MONGODB_URI=mongodb+srv://nicolaslopez1919:nico7193@cryptomate-cluster.7zcqj.mongodb.net/tarjetasCrypto-Mercury

# Se convierte automáticamente en:
# DESARROLLO: mongodb+srv://...@cryptomate-cluster.7zcqj.mongodb.net/nano_users_dev
# PRODUCCIÓN: mongodb+srv://...@cryptomate-cluster.7zcqj.mongodb.net/nano_users_prod
# TESTING: mongodb+srv://...@cryptomate-cluster.7zcqj.mongodb.net/nano_users_test
```

## 📊 API Endpoints

### Transacciones
- `GET /api/transactions/:userId/cards/:cardId/transactions` - Obtener transacciones
- `POST /api/transactions/:userId/cards/:cardId/transactions` - Crear transacción
- `PUT /api/transactions/:transactionId` - Actualizar transacción
- `DELETE /api/transactions/:transactionId` - Eliminar transacción (soft delete)
- `POST /api/transactions/:transactionId/restore` - Restaurar transacción
- `GET /api/transactions/:transactionId/history` - Obtener historial
- `GET /api/transactions/:userId/deleted` - Obtener transacciones eliminadas

### Health Check
- `GET /api/health` - Verificar estado del servidor

## 🔄 Sistema de Versionado

Cada transacción mantiene un historial completo de cambios:

```javascript
{
  _id: "transaction_123",
  name: "Starbucks",
  amount: 5.50,
  version: 2,
  isDeleted: false,
  history: [
    {
      version: 1,
      action: "created",
      timestamp: "2025-01-15T10:00:00Z",
      modifiedBy: "user_456"
    },
    {
      version: 2,
      action: "updated",
      changes: [
        {
          field: "amount",
          oldValue: 5.00,
          newValue: 5.50
        }
      ],
      timestamp: "2025-01-15T11:00:00Z",
      modifiedBy: "user_456"
    }
  ]
}
```

## 🎯 KPIs Automáticos

Los KPIs del usuario se actualizan automáticamente:
- `totalTransactions` - Total de transacciones
- `totalDeposited` - Money In (depósitos)
- `totalPosted` - Posted (gastos)
- `totalAvailable` - Available (disponible)

## 🗄️ Bases de Datos

- **nano_users** - Usuarios y sus KPIs
- **nano_cards** - Tarjetas de usuarios
- **nano_transactions** - Transacciones con historial

## 🔧 Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Ejecutar tests en modo watch
npm run test:watch
```

## 📝 Variables de Entorno

```env
# Database URLs
USERS_DB_URI=mongodb://localhost:27017/nano_users
CARDS_DB_URI=mongodb://localhost:27017/nano_cards
TRANSACTIONS_DB_URI=mongodb://localhost:27017/nano_transactions

# Server
PORT=3001
NODE_ENV=development
```
