const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDatabases } = require('./config/database');
const config = require('./config/environment');
const timingMiddleware = require('./middleware/timing');

// Importar rutas - APIs externas
const cryptomateRoutes = require('./routes/api/cryptomate/index');
const realCryptoMateRoutes = require('./routes/api/cryptomate/real');

// Importar rutas - APIs internas
const transactionRoutes = require('./routes/internal/transactions');
const cardsStatsRoutes = require('./routes/internal/cards');
const authRoutes = require('./routes/internal/auth');
const adminRoutes = require('./routes/internal/admin');
const historyRoutes = require('./routes/internal/history');
const reconciliationRoutes = require('./routes/internal/reconciliations');
const consolidationRoutes = require('./routes/internal/consolidations');
const kpisRoutes = require('./routes/internal/kpis');

// Importar rutas - Desarrollo y testing
const seedRoutes = require('./routes/dev/seed');
const testCryptoMateRoutes = require('./routes/dev/test/test-cryptomate');
const testCardsRoutes = require('./routes/dev/test/test-cards');
const cleanupRoutes = require('./routes/dev/cleanup');
const cloneRoutes = require('./routes/dev/clone');

const app = express();

// Trust proxy for Render
app.set('trust proxy', 1);

// Middleware de timing
app.use(timingMiddleware);

// Middleware de seguridad
app.use(helmet());

// Configuración CORS para permitir ngrok, desarrollo y producción
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://nanocardv2-0.onrender.com',
    'https://nanocard.xyz',
    'https://db274cdf56ad.ngrok-free.app',
    'https://5036d6c8de2c.ngrok-free.app',
    'https://c4d5c7832130.ngrok-free.app',
    'https://611bf1db9a8b.ngrok-free.app',
    /^https:\/\/.*\.ngrok-free\.app$/,
    /^https:\/\/.*\.ngrok\.io$/,
    /^https:\/\/.*\.ngrok\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 requests por IP
});
app.use(limiter);

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas - APIs externas
app.use('/api/cryptomate', cryptomateRoutes);
app.use('/api/real-cryptomate', realCryptoMateRoutes);

// Rutas - APIs internas
app.use('/api/transactions', transactionRoutes);
app.use('/api/cards', cardsStatsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reconciliations', reconciliationRoutes);
app.use('/consolidations', consolidationRoutes);
app.use('/api/kpis', kpisRoutes);

// Rutas - Desarrollo y testing
app.use('/api/seed', seedRoutes);
app.use('/api/test', testCryptoMateRoutes);
app.use('/api/test-cards', testCardsRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/clone', cloneRoutes);

// Ruta de health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Nano Backend is running',
    timestamp: new Date().toISOString()
  });
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
