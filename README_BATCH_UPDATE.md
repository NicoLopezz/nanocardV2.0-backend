# Actualización Masiva de Transacciones

## Scripts Disponibles

### 1. `update-all-cards-transactions.js`
**Genera comandos** para todas las cards y crea un script batch.

```bash
node update-all-cards-transactions.js
```
- Genera: `update-all-cards-batch.sh` (174 cards)
- Uso: `chmod +x update-all-cards-batch.sh && ./update-all-cards-batch.sh`

### 2. `update-cards-batch-smart.js` ⭐ **RECOMENDADO**
**Procesa automáticamente** todas las cards en lotes inteligentes.

```bash
node update-cards-batch-smart.js
```

**Características:**
- ✅ Procesa 174 cards automáticamente
- ✅ Lotes de 10 cards con pausas
- ✅ Manejo de errores individual
- ✅ Resumen de éxito/fallos
- ✅ No sobrecarga el sistema

## ¿Qué hace?
- **Borra** todas las transacciones de cada card
- **Importa** todas las transacciones (2024-2025) con nueva lógica
- **Aplica** descuentos del 0.3% en WALLET_DEPOSIT
- **Calcula** diferencias correctas en OVERRIDE_VIRTUAL_BALANCE
- **Maneja** decline_reason como objetos complejos
- **Actualiza** stats de cards y usuarios

## Requisitos
- Servidor corriendo en puerto 3001
- Base de datos conectada
- ~30-45 minutos de procesamiento

## Resultado Esperado
- 174 cards procesadas
- Stats actualizadas correctamente
- Sin errores de validación
- LastSync registrado para cada usuario

