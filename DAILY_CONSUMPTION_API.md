# 📊 Daily Consumption API - 7 Days

## Endpoints

### 1. Semana Inteligente (Automática)
```
GET /api/kpis/daily-consumption-7days
```

### 2. Rango Personalizado
```
GET /api/kpis/daily-consumption-custom?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

## Puerto
- **Backend**: `http://localhost:3001`
- **Frontend**: `http://localhost:3002`

## Response Structure
```json
{
  "success": true,
  "kpis": {
    "dailyConsumption7Days": {
      "period": {
        "startDate": "2025-09-22",
        "endDate": "2025-09-29", 
        "daysCount": 7,
        "logic": "previous_week",
        "description": "Semana anterior completa (lunes a domingo)"
      },
      "dailyBreakdown": [
        {
          "day": "Monday",
          "date": "2025-09-22",
          "totalAmount": 0,
          "transactionCount": 0,
          "dailyAverage": 0
        },
        {
          "day": "Sunday",
          "date": "2025-09-28",
          "totalAmount": 516880,
          "transactionCount": 5701,
          "dailyAverage": 90.66
        }
        // ... resto de días
      ],
      "summary": {
        "totalConsumption": 8732.60,
        "averageDailyConsumption": 1247.51,
        "totalTransactions": 45,
        "averageTransactionsPerDay": 6.43,
        
        // Métricas adicionales
        "daysWithTransactions": 5,
        "daysWithoutTransactions": 2,
        "maxDailyConsumption": 2500.00,
        "minDailyConsumption": 500.00,
        "maxDailyTransactions": 15,
        "minDailyTransactions": 3,
        "averageTransactionAmount": 194.06,
        
        // Días más/menos activos
        "mostActiveDay": "Friday",
        "mostActiveDayAmount": 2500.00,
        "leastActiveDay": "Sunday",
        "leastActiveDayAmount": 500.00,
        
        // Estadísticas por día de la semana
        "dayStats": [
          {
            "day": "Monday",
            "averageAmount": 1200.00,
            "averageTransactions": 8.5
          },
          {
            "day": "Friday",
            "averageAmount": 2500.00,
            "averageTransactions": 15.0
          }
        ]
      }
    },
    "timestamp": "2024-01-22T10:30:00.000Z",
    "responseTime": 45
  }
}
```

## Frontend Usage

### 1. Semana Inteligente (Recomendado)
```javascript
// Fetch automático (semana inteligente)
const fetchWeeklyData = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/kpis/daily-consumption-7days');
    const data = await response.json();
    
    if (data.success) {
      return data.kpis.dailyConsumption7Days;
    }
    throw new Error('Error fetching data');
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
};
```

### 2. Rango Personalizado
```javascript
// Fetch con rango personalizado
const fetchCustomRange = async (startDate, endDate) => {
  try {
    const response = await fetch(
      `http://localhost:3001/api/kpis/daily-consumption-custom?startDate=${startDate}&endDate=${endDate}`
    );
    const data = await response.json();
    
    if (data.success) {
      return data.kpis.dailyConsumptionCustom;
    }
    throw new Error('Error fetching data');
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
};

// Ejemplo de uso
const data = await fetchCustomRange('2025-08-22', '2025-08-23'); ```

### 3. Ejemplo React/Next.js
```javascript
// Hook personalizado para consumo diario
import { useState, useEffect } from 'react';

const useDailyConsumption = (startDate = null, endDate = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        let url = 'http://localhost:3001/api/kpis/daily-consumption-7days';
        
        if (startDate && endDate) {
          url = `http://localhost:3001/api/kpis/daily-consumption-custom?startDate=${startDate}&endDate=${endDate}`;
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
          const consumptionData = result.kpis.dailyConsumption7Days || result.kpis.dailyConsumptionCustom;
          setData(consumptionData);
        } else {
          setError(result.error || 'Error fetching data');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate]);

  return { data, loading, error };
};

// Uso en componente
const DailyConsumptionChart = () => {
  const { data, loading, error } = useDailyConsumption();

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No hay datos</div>;

  return (
    <div>
      <h2>Consumo Diario - {data.period.description}</h2>
      <div>
        <p>Total: ${data.summary.totalConsumption}</p>
        <p>Promedio diario: ${data.summary.averageDailyConsumption}</p>
        <p>Transacciones: {data.summary.totalTransactions}</p>
      </div>
      {/* Aquí iría tu gráfico */}
    </div>
  );
};
```

### 4. Chart Data
```javascript
// Para gráfico de barras - Consumo total
const chartData = data?.dailyBreakdown?.map(day => ({
  x: day.day,
  y: day.totalAmount,
  date: day.date
})) || [];

// Para gráfico de líneas - Promedio del día
const averageChartData = data?.dailyBreakdown?.map(day => ({
  x: day.day,
  y: day.dailyAverage,
  date: day.date
})) || [];
```

### 5. KPI Cards
```javascript
// Métricas principales
const kpis = {
  total: data.summary.totalConsumption,
  average: data.summary.averageDailyConsumption,
  transactions: data.summary.totalTransactions,
  averagePerDay: data.summary.averageTransactionsPerDay
};

// Métricas por día
const dailyMetrics = data.dailyBreakdown.map(day => ({
  day: day.day,
  totalAmount: day.totalAmount,
  transactionCount: day.transactionCount,
  dailyAverage: day.dailyAverage
}));
```

### 6. Ejemplos de Uso Específicos

#### A. Dashboard Principal (Semana Inteligente)
```javascript
// Para el dashboard principal - siempre muestra datos relevantes
const DashboardChart = () => {
  const { data, loading, error } = useDailyConsumption();

  if (loading) return <div>Cargando datos...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Consumo Diario - {data.period.description}</h3>
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-100 p-4 rounded">
          <h4>Total Semana</h4>
          <p className="text-2xl font-bold">${data.summary.totalConsumption}</p>
        </div>
        <div className="bg-green-100 p-4 rounded">
          <h4>Promedio Diario</h4>
          <p className="text-2xl font-bold">${data.summary.averageDailyConsumption}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded">
          <h4>Transacciones</h4>
          <p className="text-2xl font-bold">{data.summary.totalTransactions}</p>
        </div>
        <div className="bg-orange-100 p-4 rounded">
          <h4>Promedio/Día</h4>
          <p className="text-2xl font-bold">{data.summary.averageTransactionsPerDay}</p>
        </div>
      </div>
    </div>
  );
};
```

#### B. Selector de Fechas Personalizado
```javascript
// Para selector de fechas personalizado
const CustomDateRange = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { data, loading, error } = useDailyConsumption(startDate, endDate);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Los datos se actualizarán automáticamente por el hook
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Fecha inicio"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="Fecha fin"
        />
        <button type="submit">Buscar</button>
      </form>
      
      {data && (
        <div>
          <h3>Resultados: {data.period.description}</h3>
          {/* Tu gráfico aquí */}
        </div>
      )}
    </div>
  );
};
```

#### C. Gráfico con Chart.js/Recharts
```javascript
// Para Chart.js
const chartData = {
  labels: data.dailyBreakdown.map(day => day.day),
  datasets: [
    {
      label: 'Consumo Total',
      data: data.dailyBreakdown.map(day => day.totalAmount),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    },
    {
      label: 'Promedio del Día',
      data: data.dailyBreakdown.map(day => day.dailyAverage),
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderColor: 'rgba(255, 99, 132, 1)',
      borderWidth: 1
    }
  ];
```

## Features
- ✅ Sin autenticación requerida
- ✅ **Lógica inteligente**: 
  - Si es **lunes**: Muestra semana anterior completa
  - Si es **martes-domingo**: Muestra semana actual completa
- ✅ Solo transacciones aprobadas
- ✅ Breakdown diario + resumen
- ✅ Optimizado con agregación MongoDB
- ✅ Evita semanas con datos en cero
- ✅ **Métricas avanzadas**:
  - Días con/sin transacciones
  - Máximo/mínimo consumo diario
  - Máximo/mínimo transacciones diarias
  - Promedio por transacción
  - Día más/menos activo
  - Estadísticas por día de la semana

## Métricas del Summary

### Métricas Básicas
- `totalConsumption`: Consumo total del período
- `averageDailyConsumption`: Promedio diario de consumo
- `totalTransactions`: Total de transacciones
- `averageTransactionsPerDay`: Promedio de transacciones por día

### Métricas Adicionales
- `daysWithTransactions`: Días que tuvieron transacciones
- `daysWithoutTransactions`: Días sin transacciones
- `maxDailyConsumption`: Mayor consumo en un día
- `minDailyConsumption`: Menor consumo en un día (solo días con transacciones)
- `maxDailyTransactions`: Mayor número de transacciones en un día
- `minDailyTransactions`: Menor número de transacciones en un día (solo días con transacciones)
- `averageTransactionAmount`: Promedio de monto por transacción

### Análisis de Días
- `mostActiveDay`: Día de la semana más activo
- `mostActiveDayAmount`: Monto promedio del día más activo
- `leastActiveDay`: Día de la semana menos activo
- `leastActiveDayAmount`: Monto promedio del día menos activo

### Estadísticas por Día de la Semana
- `dayStats`: Array con estadísticas por cada día de la semana
  - `day`: Nombre del día
  - `averageAmount`: Monto promedio del día
  - `averageTransactions`: Promedio de transacciones del día
