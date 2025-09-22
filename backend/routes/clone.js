const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const config = require('../config/environment');

// Función para clonar datos de dev a prod usando los modelos existentes
const cloneDevToProd = async () => {
  try {
    console.log('🚀 Starting clone from DEV to PROD...');

    // Cambiar temporalmente a dev para leer los datos
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    // Importar modelos con configuración de dev
    const { getUserModel } = require('../models/User');
    const { getCardModel } = require('../models/Card');
    const { getTransactionModel } = require('../models/Transaction');
    
    // Obtener datos de dev
    const User = getUserModel();
    const Card = getCardModel();
    const Transaction = getTransactionModel();
    
    console.log('📊 Fetching data from DEV...');
    const users = await User.find({});
    const cards = await Card.find({});
    const transactions = await Transaction.find({});
    
    console.log(`📋 Found in DEV: ${users.length} users, ${cards.length} cards, ${transactions.length} transactions`);
    
    // Cambiar a prod para escribir los datos
    process.env.NODE_ENV = 'production';
    
    // Limpiar y reconectar para prod
    const { databases } = require('../config/database');
    
    // Limpiar bases de datos de producción
    console.log('🧹 Cleaning production databases...');
    await User.deleteMany({});
    await Card.deleteMany({});
    await Transaction.deleteMany({});
    console.log('✅ Production databases cleaned');
    
    // Insertar datos en prod
    console.log('👥 Cloning users...');
    if (users.length > 0) {
      await User.insertMany(users);
      console.log(`✅ Cloned ${users.length} users`);
    }
    
    console.log('💳 Cloning cards...');
    if (cards.length > 0) {
      await Card.insertMany(cards);
      console.log(`✅ Cloned ${cards.length} cards`);
    }
    
    console.log('💰 Cloning transactions...');
    if (transactions.length > 0) {
      await Transaction.insertMany(transactions);
      console.log(`✅ Cloned ${transactions.length} transactions`);
    }
    
    // Restaurar el environment original
    process.env.NODE_ENV = originalEnv;
    
    console.log('🎉 Clone completed successfully!');
    
    return {
      success: true,
      message: 'Clone completed successfully',
      summary: {
        users: users.length,
        cards: cards.length,
        transactions: transactions.length
      }
    };

  } catch (error) {
    console.error('❌ Error during clone:', error);
    throw error;
  }
};

// Endpoint para clonar datos de dev a prod
router.post('/dev-to-prod', async (req, res) => {
  try {
    const result = await cloneDevToProd();
    res.json(result);
  } catch (error) {
    console.error('❌ Error in clone endpoint:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Clone failed', 
      message: error.message 
    });
  }
});

module.exports = router;