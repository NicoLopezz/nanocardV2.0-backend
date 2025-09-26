# Lógica de Cálculo de Totales - Transaction Summary

## 📊 Resumen de Operaciones

El sistema calcula los totales basándose en el campo `operation` de cada transacción. Cada tipo de operación se trata de manera específica para los cálculos financieros.

## 🔧 Tipos de Operaciones y su Tratamiento

### 1. **WALLET_DEPOSIT** (Depósitos)
- **Campo**: `operation: "WALLET_DEPOSIT"`
- **Cálculo**: Se suma al `totalDeposited`
- **Efecto**: Aumenta el balance disponible
- **Ejemplo**: Usuario deposita $100 → `totalDeposited += 100`

### 2. **TRANSACTION_APPROVED** (Transacciones Aprobadas)
- **Campo**: `operation: "TRANSACTION_APPROVED"`
- **Cálculo**: Se suma al `totalPosted`
- **Efecto**: Disminuye el balance disponible (gasto)
- **Ejemplo**: Compra de $50 → `totalPosted += 50`

### 3. **TRANSACTION_REFUND** (Reembolsos)
- **Campo**: `operation: "TRANSACTION_REFUND"`
- **Cálculo**: Se suma al `totalRefunded`
- **Efecto**: Aumenta el balance disponible
- **Ejemplo**: Reembolso de $25 → `totalRefunded += 25`

### 4. **TRANSACTION_PENDING** (Transacciones Pendientes)
- **Campo**: `operation: "TRANSACTION_PENDING"`
- **Cálculo**: Se suma al `totalPending`
- **Efecto**: Disminuye temporalmente el balance disponible
- **Ejemplo**: Transacción pendiente de $30 → `totalPending += 30`

### 5. **TRANSACTION_REJECTED** (Transacciones Rechazadas)
- **Campo**: `operation: "TRANSACTION_REJECTED"`
- **Cálculo**: **NO se incluye** en ningún total
- **Efecto**: No afecta el balance
- **Ejemplo**: Transacción rechazada de $20 → No se suma a nada

### 6. **TRANSACTION_REVERSED** (Transacciones Revertidas)
- **Campo**: `operation: "TRANSACTION_REVERSED"`
- **Cálculo**: **NO se incluye** en ningún total
- **Efecto**: No afecta el balance
- **Ejemplo**: Transacción revertida de $15 → No se suma a nada

## 🧮 Fórmulas de Cálculo

### **Total Available (Balance Disponible)**
```javascript
totalAvailable = totalDeposited + totalRefunded - totalPosted - totalPending
```

### **Desglose por Operación**
```javascript
// Solo se incluyen transacciones activas (isDeleted: false, status: 'SUCCESS')
const stats = {
  totalDeposited: transactions
    .filter(tx => tx.operation === 'WALLET_DEPOSIT' && !tx.isDeleted && tx.status === 'SUCCESS')
    .reduce((sum, tx) => sum + tx.amount, 0),
    
  totalRefunded: transactions
    .filter(tx => tx.operation === 'TRANSACTION_REFUND' && !tx.isDeleted && tx.status === 'SUCCESS')
    .reduce((sum, tx) => sum + tx.amount, 0),
    
  totalPosted: transactions
    .filter(tx => tx.operation === 'TRANSACTION_APPROVED' && !tx.isDeleted && tx.status === 'SUCCESS')
    .reduce((sum, tx) => sum + tx.amount, 0),
    
  totalPending: transactions
    .filter(tx => tx.operation === 'TRANSACTION_PENDING' && !tx.isDeleted && tx.status === 'SUCCESS')
    .reduce((sum, tx) => sum + tx.amount, 0)
};
```

## 📋 Implementación Frontend

### **Función de Cálculo de Totales**
```javascript
const calculateTransactionTotals = (transactions) => {
  // Filtrar solo transacciones activas
  const activeTransactions = transactions.filter(tx => 
    !tx.isDeleted && tx.status === 'SUCCESS'
  );
  
  const totals = {
    totalDeposited: 0,
    totalRefunded: 0,
    totalPosted: 0,
    totalPending: 0,
    totalRejected: 0,
    totalReversed: 0
  };
  
  activeTransactions.forEach(transaction => {
    const amount = transaction.amount;
    
    switch (transaction.operation) {
      case 'WALLET_DEPOSIT':
        totals.totalDeposited += amount;
        break;
      case 'TRANSACTION_REFUND':
        totals.totalRefunded += amount;
        break;
      case 'TRANSACTION_APPROVED':
        totals.totalPosted += amount;
        break;
      case 'TRANSACTION_PENDING':
        totals.totalPending += amount;
        break;
      case 'TRANSACTION_REJECTED':
        totals.totalRejected += amount;
        break;
      case 'TRANSACTION_REVERSED':
        totals.totalReversed += amount;
        break;
    }
  });
  
  // Calcular balance disponible
  totals.totalAvailable = totals.totalDeposited + totals.totalRefunded - totals.totalPosted - totals.totalPending;
  
  return totals;
};
```

### **Componente de Resumen**
```javascript
const TransactionSummary = ({ transactions }) => {
  const totals = calculateTransactionTotals(transactions);
  
  return (
    <div className="transaction-summary">
      <div className="summary-row">
        <span>Deposits:</span>
        <span>${totals.totalDeposited.toFixed(2)}</span>
        <span>({transactions.filter(tx => tx.operation === 'WALLET_DEPOSIT' && !tx.isDeleted).length})</span>
      </div>
      
      <div className="summary-row">
        <span>Approved:</span>
        <span>${totals.totalPosted.toFixed(2)}</span>
        <span>({transactions.filter(tx => tx.operation === 'TRANSACTION_APPROVED' && !tx.isDeleted).length})</span>
      </div>
      
      <div className="summary-row">
        <span>Refunds:</span>
        <span>${totals.totalRefunded.toFixed(2)}</span>
        <span>({transactions.filter(tx => tx.operation === 'TRANSACTION_REFUND' && !tx.isDeleted).length})</span>
      </div>
      
      <div className="summary-row">
        <span>Pending:</span>
        <span>${totals.totalPending.toFixed(2)}</span>
        <span>({transactions.filter(tx => tx.operation === 'TRANSACTION_PENDING' && !tx.isDeleted).length})</span>
      </div>
      
      <div className="summary-row">
        <span>Rejected:</span>
        <span>${totals.totalRejected.toFixed(2)}</span>
        <span>({transactions.filter(tx => tx.operation === 'TRANSACTION_REJECTED' && !tx.isDeleted).length})</span>
      </div>
      
      <div className="summary-row">
        <span>Reversed:</span>
        <span>${totals.totalReversed.toFixed(2)}</span>
        <span>({transactions.filter(tx => tx.operation === 'TRANSACTION_REVERSED' && !tx.isDeleted).length})</span>
      </div>
      
      <div className="summary-row total">
        <span>Available Balance:</span>
        <span>${totals.totalAvailable.toFixed(2)}</span>
      </div>
    </div>
  );
};
```

## 🎯 Reglas de Negocio

### **1. Transacciones Eliminadas**
- **NO se incluyen** en los cálculos de totales
- **SÍ se muestran** en la lista para auditoría
- **Flag**: `isDeleted: true` o `status: 'DELETED'`

### **2. Transacciones Activas**
- **SÍ se incluyen** en los cálculos
- **Flag**: `isDeleted: false` y `status: 'SUCCESS'`

### **3. Operaciones que NO Afectan Balance**
- `TRANSACTION_REJECTED`: No se suma a nada
- `TRANSACTION_REVERSED`: No se suma a nada
- Solo se cuentan para estadísticas

### **4. Operaciones que SÍ Afectan Balance**
- `WALLET_DEPOSIT`: + (aumenta balance)
- `TRANSACTION_REFUND`: + (aumenta balance)
- `TRANSACTION_APPROVED`: - (disminuye balance)
- `TRANSACTION_PENDING`: - (disminuye balance temporalmente)

## 📊 Ejemplo de Cálculo

```javascript
// Transacciones de ejemplo
const transactions = [
  { operation: 'WALLET_DEPOSIT', amount: 100, isDeleted: false, status: 'SUCCESS' },
  { operation: 'TRANSACTION_APPROVED', amount: 50, isDeleted: false, status: 'SUCCESS' },
  { operation: 'TRANSACTION_REFUND', amount: 25, isDeleted: false, status: 'SUCCESS' },
  { operation: 'TRANSACTION_PENDING', amount: 30, isDeleted: false, status: 'SUCCESS' },
  { operation: 'TRANSACTION_REJECTED', amount: 20, isDeleted: false, status: 'SUCCESS' },
  { operation: 'WALLET_DEPOSIT', amount: 200, isDeleted: true, status: 'DELETED' } // Eliminada
];

// Resultado:
const totals = {
  totalDeposited: 100,    // Solo la activa
  totalRefunded: 25,      // Solo la activa
  totalPosted: 50,        // Solo la activa
  totalPending: 30,       // Solo la activa
  totalRejected: 20,      // Solo la activa
  totalAvailable: 45      // 100 + 25 - 50 - 30 = 45
};
```

## 🔍 Debugging

### **Verificar Cálculos**
```javascript
const debugTotals = (transactions) => {
  console.log('=== DEBUG TRANSACTION TOTALS ===');
  
  transactions.forEach((tx, index) => {
    console.log(`Transaction ${index + 1}:`, {
      operation: tx.operation,
      amount: tx.amount,
      isDeleted: tx.isDeleted,
      status: tx.status,
      included: !tx.isDeleted && tx.status === 'SUCCESS'
    });
  });
  
  const totals = calculateTransactionTotals(transactions);
  console.log('Calculated totals:', totals);
};
```

---

**✅ Esta lógica es la base para todos los cálculos de totales en el sistema**  
**🔒 Las transacciones eliminadas NUNCA afectan los totales financieros**  
**📊 Los totales siempre reflejan el estado real del balance**

