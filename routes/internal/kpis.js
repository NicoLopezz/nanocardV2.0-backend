const express = require('express');
const router = express.Router();
const { getTransactionModel } = require('../../models/Transaction');
const { getCardModel } = require('../../models/Card');
const { getUserModel } = require('../../models/User');
const { authenticateToken } = require('../../middleware/auth');

// Endpoint para obtener las últimas 10 movimientos del sistema con detalles de usuario y tarjeta
router.get('/last-10-movements', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Transaction = getTransactionModel();
    const Card = getCardModel();
    const User = getUserModel();

    // Obtener las últimas 10 transacciones del sistema (ordenadas por fecha de creación)
    const transactions = await Transaction.find({
      isDeleted: { $ne: true },
      status: { $ne: 'DELETED' }
    })
    .select({
      _id: 1,
      userId: 1,
      cardId: 1,
      name: 1,
      amount: 1,
      date: 1,
      time: 1,
      status: 1,
      operation: 1,
      createdAt: 1
    })
    .sort({ createdAt: -1 })
    .limit(10);

    // Enriquecer cada transacción con información del usuario y tarjeta
    const enrichedTransactions = await Promise.all(transactions.map(async (transaction) => {
      // Obtener información del usuario
      const user = await User.findById(transaction.userId).select({
        _id: 1,
        username: 1,
        email: 1,
        profile: 1
      });

      // Obtener información de la tarjeta
      const card = await Card.findById(transaction.cardId).select({
        _id: 1,
        name: 1,
        last4: 1,
        status: 1
      });

      return {
        _id: transaction._id,
        name: transaction.name,
        amount: transaction.amount,
        date: transaction.date,
        time: transaction.time,
        status: transaction.status,
        operation: transaction.operation,
        createdAt: transaction.createdAt,
        user: user ? {
          _id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile
        } : null,
        card: card ? {
          _id: card._id,
          name: card.name,
          last4: card.last4,
          status: card.status
        } : null
      };
    }));

    const responseTime = Date.now() - startTime;
    console.log(`✅ Last 10 movements KPIs fetched in ${responseTime}ms`);

    res.json({
      success: true,
      kpis: {
        last10Movements: enrichedTransactions,
        count: enrichedTransactions.length,
        timestamp: new Date().toISOString(),
        responseTime: responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching last 10 movements KPIs (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint para obtener el consumo promedio diario de los últimos 7 días (lunes a domingo)
router.get('/daily-consumption-7days', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Transaction = getTransactionModel();
    
    // Lógica inteligente: Si es lunes, mostrar semana anterior completa
    // Si es martes-domingo, mostrar semana actual completa
    const getSmartWeekRange = () => {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
      
      let monday, sunday;
      
      if (dayOfWeek === 1) { // Si es lunes
        // Mostrar semana anterior completa
        monday = new Date(today);
        monday.setDate(today.getDate() - 7); // Lunes de la semana pasada
        monday.setHours(0, 0, 0, 0);
        
        sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6); // Domingo de la semana pasada
        sunday.setHours(23, 59, 59, 999);
      } else {
        // Si es martes-domingo, mostrar semana actual completa
        monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + 1);
        monday.setHours(0, 0, 0, 0);
        
        sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
      }
      
      return { monday, sunday };
    };

    const { monday, sunday } = getSmartWeekRange();
    const today = new Date();
    
    const query = {
      isDeleted: { $ne: true },
      operation: 'TRANSACTION_APPROVED'
    };

    const generateDateFormats = (date) => {
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      const withZeros = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      const withoutZeros = `${day}/${month}/${year}`;
      
      return [withZeros, withoutZeros];
    };

    const dateRange = [];
    for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
      const dateFormats = generateDateFormats(d);
      dateRange.push(...dateFormats);
    }

    const dailyData = await Transaction.aggregate([
      { 
        $match: {
          ...query,
          date: { $in: dateRange }
        }
      },
      {
        $group: {
          _id: "$date",
          totalAmount: { $sum: "$amount" },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Nombres de los días de la semana
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Procesar datos diarios
    const dailyBreakdown = [];
    let totalConsumption = 0;
    let totalTransactions = 0;

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(monday);
      currentDay.setDate(monday.getDate() + i);
      
      const dateFormats = generateDateFormats(currentDay);
      const dayData = dailyData.find(d => 
        dateFormats.includes(d._id)
      );

      const dayName = dayNames[currentDay.getDay()];
      const totalAmount = dayData ? dayData.totalAmount : 0;
      const transactionCount = dayData ? dayData.transactionCount : 0;

      const dailyAverage = transactionCount > 0 ? totalAmount / transactionCount : 0;

      dailyBreakdown.push({
        day: dayName,
        date: currentDay.toISOString().split('T')[0],
        totalAmount: totalAmount,
        transactionCount: transactionCount,
        dailyAverage: Math.round(dailyAverage * 100) / 100
      });

      totalConsumption += totalAmount;
      totalTransactions += transactionCount;
    }

    // Calcular promedios
    const averageDailyConsumption = totalConsumption / 7;
    const averageTransactionsPerDay = totalTransactions / 7;
    
    // Calcular métricas adicionales
    const daysWithTransactions = dailyBreakdown.filter(day => day.transactionCount > 0).length;
    const daysWithoutTransactions = 7 - daysWithTransactions;
    const maxDailyConsumption = Math.max(...dailyBreakdown.map(day => day.totalAmount));
    const minDailyConsumption = Math.min(...dailyBreakdown.filter(day => day.totalAmount > 0).map(day => day.totalAmount));
    const maxDailyTransactions = Math.max(...dailyBreakdown.map(day => day.transactionCount));
    const minDailyTransactions = Math.min(...dailyBreakdown.filter(day => day.transactionCount > 0).map(day => day.transactionCount));
    
    // Calcular promedio de transacciones por día (solo días con transacciones)
    const averageTransactionAmount = totalTransactions > 0 ? totalConsumption / totalTransactions : 0;
    
    // Calcular días de la semana más activos
    const dayStats = dailyBreakdown.reduce((acc, day) => {
      if (!acc[day.day]) {
        acc[day.day] = { totalAmount: 0, transactionCount: 0, days: 0 };
      }
      acc[day.day].totalAmount += day.totalAmount;
      acc[day.day].transactionCount += day.transactionCount;
      acc[day.day].days += 1;
      return acc;
    }, {});
    
    const dayAverages = Object.keys(dayStats).map(day => ({
      day,
      averageAmount: dayStats[day].totalAmount / dayStats[day].days,
      averageTransactions: dayStats[day].transactionCount / dayStats[day].days
    }));
    
    const mostActiveDay = dayAverages.reduce((max, day) => 
      day.averageAmount > max.averageAmount ? day : max, dayAverages[0] || { day: 'N/A', averageAmount: 0 });
    
    const leastActiveDay = dayAverages.reduce((min, day) => 
      day.averageAmount < min.averageAmount ? day : min, dayAverages[0] || { day: 'N/A', averageAmount: 0 });

    const responseTime = Date.now() - startTime;
    console.log(`✅ Daily consumption 7 days KPIs fetched in ${responseTime}ms`);

    res.json({
      success: true,
      kpis: {
        dailyConsumption7Days: {
          period: {
            startDate: monday.toISOString().split('T')[0],
            endDate: sunday.toISOString().split('T')[0],
            daysCount: 7,
            logic: today.getDay() === 1 ? 'previous_week' : 'current_week',
            description: today.getDay() === 1 ? 'Semana anterior completa (lunes a domingo)' : 'Semana actual completa (lunes a domingo)'
          },
          dailyBreakdown: dailyBreakdown,
          summary: {
            totalConsumption: totalConsumption,
            averageDailyConsumption: Math.round(averageDailyConsumption * 100) / 100,
            totalTransactions: totalTransactions,
            averageTransactionsPerDay: Math.round(averageTransactionsPerDay * 100) / 100,
            
            // Métricas adicionales
            daysWithTransactions: daysWithTransactions,
            daysWithoutTransactions: daysWithoutTransactions,
            maxDailyConsumption: Math.round(maxDailyConsumption * 100) / 100,
            minDailyConsumption: Math.round(minDailyConsumption * 100) / 100,
            maxDailyTransactions: maxDailyTransactions,
            minDailyTransactions: minDailyTransactions,
            averageTransactionAmount: Math.round(averageTransactionAmount * 100) / 100,
            
            // Días más/menos activos
            mostActiveDay: mostActiveDay.day,
            mostActiveDayAmount: Math.round(mostActiveDay.averageAmount * 100) / 100,
            leastActiveDay: leastActiveDay.day,
            leastActiveDayAmount: Math.round(leastActiveDay.averageAmount * 100) / 100,
            
            // Estadísticas por día de la semana
            dayStats: dayAverages.map(day => ({
              day: day.day,
              averageAmount: Math.round(day.averageAmount * 100) / 100,
              averageTransactions: Math.round(day.averageTransactions * 100) / 100
            }))
          }
        },
        timestamp: new Date().toISOString(),
        responseTime: responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching daily consumption 7 days KPIs (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint para obtener el consumo promedio diario en un rango de fechas personalizado
router.get('/daily-consumption-custom', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Transaction = getTransactionModel();
    const { startDate, endDate } = req.query;
    
    // Validar que se proporcionen las fechas
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        example: '?startDate=2024-01-15&endDate=2024-01-21'
      });
    }
    
    // Convertir fechas a objetos Date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Validar que las fechas sean válidas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD format'
      });
    }
    
    // Validar que la fecha de inicio sea anterior a la fecha de fin
    if (start >= end) {
      return res.status(400).json({
        success: false,
        error: 'startDate must be before endDate'
      });
    }
    
    // Crear copias para no modificar las fechas originales
    const queryStart = new Date(start);
    const queryEnd = new Date(end);
    
    // Ajustar horas para incluir todo el día
    queryStart.setHours(0, 0, 0, 0);
    queryEnd.setHours(23, 59, 59, 999);
    
    // Query para transacciones aprobadas en el rango personalizado
    // Buscar por el campo 'date' en formato DD/MM/YYYY
    const query = {
      isDeleted: { $ne: true },
      operation: 'TRANSACTION_APPROVED'
    };

    // Función para convertir fecha DD/MM/YYYY a objeto Date
    const parseDate = (dateStr) => {
      const [day, month, year] = dateStr.split('/');
      return new Date(year, month - 1, day);
    };

    // Función para generar ambos formatos de fecha (con y sin ceros)
    const generateDateFormats = (date) => {
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      
      // Formato con ceros: "29/05/2025"
      const withZeros = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
      
      // Formato sin ceros: "29/5/2025"
      const withoutZeros = `${day}/${month}/${year}`;
      
      return [withZeros, withoutZeros];
    };

    // Generar array de fechas en el rango (ambos formatos)
    const dateRange = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateFormats = generateDateFormats(d);
      dateRange.push(...dateFormats); // Agregar ambos formatos
    }

    // Agregación por día usando el campo 'date'
    console.log('Buscando fechas:', dateRange);
    const dailyData = await Transaction.aggregate([
      { 
        $match: {
          ...query,
          date: { $in: dateRange }
        }
      },
      {
        $group: {
          _id: "$date",
          totalAmount: { $sum: "$amount" },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    console.log('Datos diarios encontrados:', dailyData);

    // Nombres de los días de la semana
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Calcular el número de días en el rango
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    // Procesar datos diarios
    const dailyBreakdown = [];
    let totalConsumption = 0;
    let totalTransactions = 0;

    // Crear array con todos los días del rango
    for (let i = 0; i < daysDiff; i++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + i);
      
      // Buscar datos para ambos formatos de fecha
      const dateFormats = generateDateFormats(currentDay);
      const dayData = dailyData.find(d => 
        dateFormats.includes(d._id)
      );

      const dayName = dayNames[currentDay.getDay()];
      const totalAmount = dayData ? dayData.totalAmount : 0;
      const transactionCount = dayData ? dayData.transactionCount : 0;

      // Calcular promedio del día (suma total / número de transacciones)
      const dailyAverage = transactionCount > 0 ? totalAmount / transactionCount : 0;

      dailyBreakdown.push({
        day: dayName,
        date: currentDay.toISOString().split('T')[0],
        totalAmount: totalAmount,
        transactionCount: transactionCount,
        dailyAverage: Math.round(dailyAverage * 100) / 100
      });

      totalConsumption += totalAmount;
      totalTransactions += transactionCount;
    }

    // Calcular promedios
    const averageDailyConsumption = totalConsumption / daysDiff;
    const averageTransactionsPerDay = totalTransactions / daysDiff;
    
    // Calcular métricas adicionales
    const daysWithTransactions = dailyBreakdown.filter(day => day.transactionCount > 0).length;
    const daysWithoutTransactions = daysDiff - daysWithTransactions;
    const maxDailyConsumption = Math.max(...dailyBreakdown.map(day => day.totalAmount));
    const minDailyConsumption = Math.min(...dailyBreakdown.filter(day => day.totalAmount > 0).map(day => day.totalAmount));
    const maxDailyTransactions = Math.max(...dailyBreakdown.map(day => day.transactionCount));
    const minDailyTransactions = Math.min(...dailyBreakdown.filter(day => day.transactionCount > 0).map(day => day.transactionCount));
    
    // Calcular promedio de transacciones por día (solo días con transacciones)
    const averageTransactionAmount = totalTransactions > 0 ? totalConsumption / totalTransactions : 0;
    
    // Calcular días de la semana más activos
    const dayStats = dailyBreakdown.reduce((acc, day) => {
      if (!acc[day.day]) {
        acc[day.day] = { totalAmount: 0, transactionCount: 0, days: 0 };
      }
      acc[day.day].totalAmount += day.totalAmount;
      acc[day.day].transactionCount += day.transactionCount;
      acc[day.day].days += 1;
      return acc;
    }, {});
    
    const dayAverages = Object.keys(dayStats).map(day => ({
      day,
      averageAmount: dayStats[day].totalAmount / dayStats[day].days,
      averageTransactions: dayStats[day].transactionCount / dayStats[day].days
    }));
    
    const mostActiveDay = dayAverages.reduce((max, day) => 
      day.averageAmount > max.averageAmount ? day : max, dayAverages[0] || { day: 'N/A', averageAmount: 0 });
    
    const leastActiveDay = dayAverages.reduce((min, day) => 
      day.averageAmount < min.averageAmount ? day : min, dayAverages[0] || { day: 'N/A', averageAmount: 0 });

    const responseTime = Date.now() - startTime;
    console.log(`✅ Daily consumption custom range KPIs fetched in ${responseTime}ms`);

    res.json({
      success: true,
      kpis: {
        dailyConsumptionCustom: {
          period: {
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            daysCount: daysDiff,
            logic: 'custom_range',
            description: `Rango personalizado (${startDate} a ${endDate})`
          },
          dailyBreakdown: dailyBreakdown,
          summary: {
            totalConsumption: totalConsumption,
            averageDailyConsumption: Math.round(averageDailyConsumption * 100) / 100,
            totalTransactions: totalTransactions,
            averageTransactionsPerDay: Math.round(averageTransactionsPerDay * 100) / 100,
            
            // Métricas adicionales
            daysWithTransactions: daysWithTransactions,
            daysWithoutTransactions: daysWithoutTransactions,
            maxDailyConsumption: Math.round(maxDailyConsumption * 100) / 100,
            minDailyConsumption: Math.round(minDailyConsumption * 100) / 100,
            maxDailyTransactions: maxDailyTransactions,
            minDailyTransactions: minDailyTransactions,
            averageTransactionAmount: Math.round(averageTransactionAmount * 100) / 100,
            
            // Días más/menos activos
            mostActiveDay: mostActiveDay.day,
            mostActiveDayAmount: Math.round(mostActiveDay.averageAmount * 100) / 100,
            leastActiveDay: leastActiveDay.day,
            leastActiveDayAmount: Math.round(leastActiveDay.averageAmount * 100) / 100,
            
            // Estadísticas por día de la semana
            dayStats: dayAverages.map(day => ({
              day: day.day,
              averageAmount: Math.round(day.averageAmount * 100) / 100,
              averageTransactions: Math.round(day.averageTransactions * 100) / 100
            }))
          }
        },
        timestamp: new Date().toISOString(),
        responseTime: responseTime
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error fetching daily consumption custom range KPIs (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

// Endpoint de debug para verificar transacciones
router.get('/debug-transactions', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const Transaction = getTransactionModel();
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Buscar transacciones en el rango por campo 'date' (ambos formatos)
    const day = start.getDate();
    const month = start.getMonth() + 1;
    const year = start.getFullYear();
    
    const withZeros = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    const withoutZeros = `${day}/${month}/${year}`;
    const dateFormats = [withZeros, withoutZeros];
    
    console.log('Buscando fechas:', dateFormats);
    
    // Buscar directamente por el campo date sin filtros adicionales
    const transactions = await Transaction.find({
      date: { $in: dateFormats }
    })
    .select('_id amount date operation')
    .sort({ createdAt: -1 })
    .limit(10);
    
    console.log('Transacciones encontradas:', transactions.length);
    
    // También buscar todas las transacciones recientes para ver qué fechas tienen datos
    const recentTransactions = await Transaction.find({
      isDeleted: { $ne: true },
      operation: 'TRANSACTION_APPROVED'
    })
    .select('_id amount createdAt operation date')
    .sort({ createdAt: -1 })
    .limit(20);
    
    // Buscar TODAS las transacciones del 29/09 sin filtros
    const allTransactions29 = await Transaction.find({
      date: { $in: dateFormats }
    })
    .select('_id amount date operation isDeleted status')
    .sort({ createdAt: -1 })
    .limit(20);
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      debug: {
        range: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        transactionsInRange: transactions.length,
        transactionsInRangeData: transactions,
        recentTransactions: recentTransactions.length,
        recentTransactionsData: recentTransactions,
        allTransactions29: allTransactions29.length,
        allTransactions29Data: allTransactions29,
        responseTime: responseTime
      }
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ Error in debug endpoint (${responseTime}ms):`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      responseTime: responseTime 
    });
  }
});

module.exports = router;
