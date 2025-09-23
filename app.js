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
app.use(cors());

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
    await connectDatabases();
    app.listen(PORT, () => {
      console.log(`🚀 Nano Backend running on port ${PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
