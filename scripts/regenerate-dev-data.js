const mongoose = require('mongoose');
const { connectDatabases } = require('../config/database');
const { getCardModel } = require('../models/Card');
const { getUserModel } = require('../models/User');
const { getTransactionModel } = require('../models/Transaction');
const { getHistoryModel } = require('../models/History');

// Datos de ejemplo para desarrollo
const sampleUsers = [
  {
    _id: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
    username: 'darola',
    email: 'darola@nanocard.xyz',
    role: 'admin',
    profile: {
      firstName: 'Darola',
      lastName: 'Card',
      phone: '+1234567890'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo',
    username: 'corinna',
    email: 'corinna@nanocard.xyz',
    role: 'standard',
    profile: {
      firstName: 'CORINNA',
      lastName: 'SCHWAGER ENDRES',
      phone: '+1234567891'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const sampleCards = [
  {
    _id: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo',
    userId: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo',
    name: 'CORINNA SCHWAGER ENDRES',
    last4: '0517',
    status: 'active',
    deposited: 0,
    refunded: 0,
    posted: 0,
    available: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const sampleTransactions = [
  {
    _id: '4c2c2375-c021-4043-92e7-85d89a3c6368',
    userId: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo',
    cardId: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo',
    userName: 'CORINNA SCHWAGER ENDRES',
    cardName: 'CORINNA SCHWAGER ENDRES',
    name: 'DEPOSIT',
    amount: 25,
    date: '15/9/2025',
    time: '07:19 p. m.',
    status: 'SUCCESS',
    operation: 'WALLET_DEPOSIT',
    credit: true,
    comentario: 'REVISA ESTO',
    version: 1,
    isDeleted: false,
    history: [{
      version: 1,
      action: 'created',
      timestamp: new Date(),
      modifiedBy: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo',
      reason: 'Initial transaction',
      changes: []
    }],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Función para regenerar datos
const regenerateDevData = async () => {
  try {
    console.log('🚀 Conectando a bases de datos...');
    await connectDatabases();
    console.log('✅ Conexiones establecidas\n');

    // Regenerar usuarios
    console.log('👥 Regenerando usuarios...');
    const User = getUserModel();
    for (const userData of sampleUsers) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Usuario creado: ${user.username}`);
    }

    // Regenerar tarjetas
    console.log('\n💳 Regenerando tarjetas...');
    const Card = getCardModel();
    for (const cardData of sampleCards) {
      const card = new Card(cardData);
      await card.save();
      console.log(`✅ Tarjeta creada: ${card.name} (${card.last4})`);
    }

    // Regenerar transacciones
    console.log('\n💰 Regenerando transacciones...');
    const Transaction = getTransactionModel();
    for (const transactionData of sampleTransactions) {
      const transaction = new Transaction(transactionData);
      await transaction.save();
      console.log(`✅ Transacción creada: ${transaction.name} - $${transaction.amount}`);
    }

    // Crear historial inicial
    console.log('\n📊 Creando historial inicial...');
    const History = getHistoryModel();
    
    // Historial de login
    const loginHistory = new History({
      _id: require('uuid').v4(),
      eventType: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      userId: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      userName: 'Darola Card',
      userRole: 'admin',
      action: 'authenticated',
      changes: [],
      metadata: { cardId: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo', cardName: 'CORINNA SCHWAGER ENDRES', last4: '0517' },
      requestInfo: { method: 'POST', endpoint: '/api/auth/login', statusCode: 200 },
      severity: 'low',
      category: 'authentication',
      description: 'User vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9 logged in successfully',
      timestamp: new Date()
    });
    await loginHistory.save();

    // Historial de transacción
    const transactionHistory = new History({
      _id: require('uuid').v4(),
      eventType: 'TRANSACTION_UPDATED',
      entityType: 'Transaction',
      entityId: '4c2c2375-c021-4043-92e7-85d89a3c6368',
      userId: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      userName: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      userRole: 'admin',
      action: 'updated',
      changes: [{
        field: 'amount',
        oldValue: 10,
        newValue: 25
      }],
      metadata: {
        transactionAmount: 25,
        transactionStatus: 'SUCCESS',
        cardLast4: '95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo'
      },
      requestInfo: { method: 'PUT', endpoint: '/api/cards/card/95KjXY5X3B8oUiTNPq3qB4uY70qtRpwo/transactions/4c2c2375-c021-4043-92e7-85d89a3c6368', statusCode: 200 },
      severity: 'medium',
      category: 'data_operation',
      description: 'Transaction DEPOSIT updated by vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      timestamp: new Date()
    });
    await transactionHistory.save();

    console.log('✅ Historial inicial creado');

    console.log('\n🎉 ¡Datos de desarrollo regenerados exitosamente!');
    console.log('📊 Resumen:');
    console.log(`   👥 Usuarios: ${sampleUsers.length}`);
    console.log(`   💳 Tarjetas: ${sampleCards.length}`);
    console.log(`   💰 Transacciones: ${sampleTransactions.length}`);
    console.log(`   📊 Eventos de historial: 2`);

  } catch (error) {
    console.error('❌ Error regenerando datos:', error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  regenerateDevData();
}

module.exports = { regenerateDevData };
