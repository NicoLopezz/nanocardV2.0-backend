const express = require('express');
const router = express.Router();

// Importar rutas específicas
const realRoutes = require('./real');
const debugRoutes = require('./debug');

// Usar las rutas
router.use('/real-mercury', realRoutes);
router.use('/debug-mercury', debugRoutes);

module.exports = router;