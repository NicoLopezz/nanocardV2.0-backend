const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { connectDatabases } = require('./config/database-mock');
const config = require('./config/environment');

// Importar rutas
const transactionRoutes = require('./routes/transactions');
const cryptomateRoutes = require('./routes/cryptomate');
const seedRoutes = require('./routes/seed');
const testCryptoMateRoutes = require('./routes/test-cryptomate');
const testCardsRoutes = require('./routes/test-cards');
const realCryptoMateRoutes = require('./routes/real-cryptomate');
const cardsStatsRoutes = require('./routes/cards-stats');
const cardStatsRoutes = require('./routes/card-stats');
const cleanupRoutes = require('./routes/cleanup');
const authRoutes = require('./routes/auth');
const cloneRoutes = require('./routes/clone');
const adminRoutes = require('./routes/admin');

const app = express();

// Trust proxy for Render
app.set('trust proxy', 1);

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

// Rutas
app.use('/api/transactions', transactionRoutes);
app.use('/api/cryptomate', cryptomateRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/test', testCryptoMateRoutes);
app.use('/api/test-cards', testCardsRoutes);
app.use('/api/real-cryptomate', realCryptoMateRoutes);
app.use('/api/cards', cardsStatsRoutes);
app.use('/api/card-stats', cardStatsRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/clone', cloneRoutes);
app.use('/api/admin', adminRoutes);

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
    // Skip database connection for now to avoid SSL issues
    console.log('⚠️  Skipping database connection to avoid SSL issues');
    console.log('✅ Mock databases initialized');
    
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
