# Scripts de Base de Datos

## ⚠️ ADVERTENCIA CRÍTICA

**NUNCA ejecutes scripts de limpieza en producción sin autorización explícita.**

## 🛡️ Medidas de Seguridad Implementadas

### 1. Script de Limpieza Seguro (`clean-databases.js`)

```bash
# Para desarrollo (seguro)
NODE_ENV=development node scripts/clean-databases.js

# Para producción (requiere confirmación doble)
NODE_ENV=prod FORCE_PRODUCTION_CLEAN=true node scripts/clean-databases.js
```

**Características de seguridad:**
- ✅ Confirmación doble requerida
- ✅ Validación de entorno
- ✅ Contador de documentos antes de eliminar
- ✅ Mensajes de advertencia claros
- ✅ Variable de entorno especial para producción

### 2. Script de Backup (`backup-databases.js`)

```bash
# Crear backup antes de cualquier operación
NODE_ENV=development node scripts/backup-databases.js
NODE_ENV=prod node scripts/backup-databases.js
```

**Características:**
- ✅ Backup automático con timestamp
- ✅ Metadatos incluidos
- ✅ Estructura organizada
- ✅ JSON legible

## 📋 Procedimientos Recomendados

### Para Desarrollo
```bash
# 1. Crear backup (opcional)
NODE_ENV=development node scripts/backup-databases.js

# 2. Limpiar bases de datos
NODE_ENV=development node scripts/clean-databases.js
```

### Para Producción (SOLO en emergencias)
```bash
# 1. SIEMPRE crear backup primero
NODE_ENV=prod node scripts/backup-databases.js

# 2. Verificar backup
ls -la backups/prod_*

# 3. Solo si es absolutamente necesario
NODE_ENV=prod FORCE_PRODUCTION_CLEAN=true node scripts/clean-databases.js
```

## 🚨 Reglas de Oro

1. **NUNCA** toques producción sin backup
2. **SIEMPRE** confirma el entorno antes de ejecutar
3. **SIEMPRE** lee los mensajes de advertencia
4. **NUNCA** ejecutes scripts directamente en el servidor de producción
5. **SIEMPRE** usa staging para pruebas

## 🔄 Flujo de Trabajo Seguro

1. **Desarrollo** → Pruebas en staging
2. **Staging** → Validación completa
3. **Backup** → Crear respaldo de producción
4. **Deploy** → Despliegue controlado
5. **Monitoreo** → Verificar funcionamiento

## 📞 Contacto de Emergencia

En caso de problemas en producción:
1. Detener el servicio inmediatamente
2. Restaurar desde backup más reciente
3. Contactar al equipo de desarrollo
4. Documentar el incidente

## 🛠️ Comandos Útiles

```bash
# Ver estado de las bases de datos
NODE_ENV=development node -e "require('./config/database').connectDatabases().then(() => console.log('✅ Connected'))"

# Verificar conexiones
NODE_ENV=prod node -e "require('./config/database').connectDatabases().then(() => console.log('✅ Connected'))"

# Listar backups
ls -la backups/
```
