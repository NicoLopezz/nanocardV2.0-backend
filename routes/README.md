# 📁 Routes Structure

Esta carpeta contiene todas las rutas de la API organizadas por funcionalidad.

## 🏗️ Estructura

```
routes/
├── api/                    # APIs externas
│   └── cryptomate/        # Integración con CryptoMate
│       ├── index.js       # Servicios básicos de CryptoMate
│       ├── real.js        # Integración principal con CryptoMate
│       └── backups/       # Archivos de respaldo
│           ├── backup1.js # Versión anterior 1
│           ├── backup2.js # Versión anterior 2
│           └── updated.js # Versión actualizada
├── internal/              # APIs internas del sistema
│   ├── auth.js           # Autenticación y autorización
│   ├── admin.js          # Panel administrativo
│   ├── cards.js          # Estadísticas y gestión de tarjetas
│   ├── transactions.js   # CRUD de transacciones
│   └── history.js        # Historial del sistema
├── dev/                   # Desarrollo y testing
│   ├── test/             # Archivos de prueba
│   │   ├── cryptomate.js # Pruebas de CryptoMate
│   │   └── cards.js      # Pruebas de tarjetas
│   ├── seed.js           # Datos de prueba
│   ├── cleanup.js        # Limpieza de datos
│   └── clone.js          # Clonación entre entornos
└── README.md             # Este archivo
```

## 🔗 Endpoints

### APIs Externas
- `/api/cryptomate` - Servicios básicos de CryptoMate
- `/api/real-cryptomate` - Integración principal con CryptoMate

### APIs Internas
- `/api/auth` - Autenticación
- `/api/admin` - Panel administrativo
- `/api/cards` - Gestión de tarjetas
- `/api/transactions` - Gestión de transacciones
- `/api/history` - Historial del sistema

### Desarrollo y Testing
- `/api/seed` - Datos de prueba
- `/api/test` - Pruebas de CryptoMate
- `/api/test-cards` - Pruebas de tarjetas
- `/api/cleanup` - Limpieza de datos
- `/api/clone` - Clonación entre entornos

## 📝 Notas

- Los archivos en `backups/` son versiones anteriores mantenidas por seguridad
- Las rutas de `dev/` solo deben usarse en desarrollo
- Todas las rutas internas requieren autenticación
- Las rutas de CryptoMate manejan la integración con la API externa
