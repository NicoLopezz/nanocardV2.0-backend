const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDatabases } = require('./config/database');
const config = require('./config/environment');
const timingMiddleware = require('./middleware/timing');
const EventService = require('./services/eventService');

// Importar rutas - APIs externas
const cryptomateRoutes = require('./routes/api/cryptomate/index');
const realCryptoMateRoutes = require('./routes/api/cryptomate/real');
const mercuryRoutes = require('./routes/api/mercury/index');

// Importar rutas - APIs internas
const transactionRoutes = require('./routes/internal/transactions');
const cardsStatsRoutes = require('./routes/internal/cards');
const statsRoutes = require('./routes/internal/stats');
const authRoutes = require('./routes/internal/auth');
const adminRoutes = require('./routes/internal/admin');
const historyRoutes = require('./routes/internal/history');
const reconciliationRoutes = require('./routes/internal/reconciliations');
const consolidationRoutes = require('./routes/internal/consolidations');
const kpisRoutes = require('./routes/internal/kpis');
const refreshAllStatsRoutes = require('./routes/internal/refresh-all-stats');
const usersCardsCountRoutes = require('./routes/internal/users-cards-count');

// Importar rutas - Desarrollo y testing
const seedRoutes = require('./routes/dev/seed');
const testCryptoMateRoutes = require('./routes/dev/test/test-cryptomate');
const testCardsRoutes = require('./routes/dev/test/test-cards');
const cleanupRoutes = require('./routes/dev/cleanup');
const cloneRoutes = require('./routes/dev/clone');

// Importar rutas - Cronjobs
const cronjobsRoutes = require('./routes/cronjobs');

const app = express();

// Trust proxy for Render
app.set('trust proxy', 1);

// Middleware de timing
app.use(timingMiddleware);

// Middleware de seguridad
app.use(helmet());

// Configuración CORS - Permite cualquier origen y maneja requests sin Origin
app.use(cors({
  origin: function (origin, callback) {
    // Permite requests sin Origin (como ngrok)
    if (!origin) return callback(null, true);
    // Permite cualquier origen
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));


// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas - APIs externas
app.use('/api/cryptomate', cryptomateRoutes);
app.use('/api/real-cryptomate', realCryptoMateRoutes);
app.use('/api', mercuryRoutes);

// Rutas - APIs internas
app.use('/api/transactions', transactionRoutes);
app.use('/api/cards', cardsStatsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reconciliations', reconciliationRoutes);
app.use('/consolidations', consolidationRoutes);
app.use('/api/kpis', kpisRoutes);
app.use('/api/refresh', refreshAllStatsRoutes);
app.use('/api/users-cards-count', usersCardsCountRoutes);

// Rutas - Desarrollo y testing
app.use('/api/seed', seedRoutes);
app.use('/api/test', testCryptoMateRoutes);
app.use('/api/test-cards', testCardsRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/clone', cloneRoutes);

// Rutas - Cronjobs
app.use('/api/cronjobs', cronjobsRoutes);

// Ruta de health check
app.get('/api/health', async (req, res) => {
  try {
    const { checkDatabaseHealth } = require('./config/database');
    const dbHealth = await checkDatabaseHealth();
    
    res.json({ 
      success: true, 
      message: 'Nano Backend is running',
      timestamp: new Date().toISOString(),
      databases: dbHealth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found' 
  });
});

// Iniciar servidor
const PORT = config.PORT;

const startServer = async () => {
  try {
    console.log('🔄 Starting server initialization...');
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`🔗 MongoDB URI: ${config.USERS_DB_URI}`);
    
    await connectDatabases();
    console.log('✅ Databases connected successfully');
    
    // Inicializar sistema de eventos
    EventService.initialize();
    
    app.listen(PORT, () => {
      console.log(`🚀 Nano Backend running on port ${PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log('✅ Server started successfully');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  }
};

startServer();

module.exports = app;
