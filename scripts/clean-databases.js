#!/usr/bin/env node

const readline = require('readline');
const { connectDatabases } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');
const { getReconciliationModel } = require('../models/Reconciliation');
const { getReconciliationTransactionModel } = require('../models/ReconciliationTransaction');
const { getReconciliationCardModel } = require('../models/ReconciliationCard');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function confirmAction(env) {
  console.log(`\n🚨 ADVERTENCIA CRÍTICA 🚨`);
  console.log(`Estás a punto de LIMPIAR la base de datos de ${env.toUpperCase()}`);
  console.log(`Esta acción es IRREVERSIBLE y puede causar PÉRDIDA DE DATOS`);
  console.log(`\nBases de datos que se limpiarán:`);
  console.log(`- nano_transactions_${env}`);
  console.log(`- nano_reconciliations_${env}`);
  
  if (env === 'prod') {
    console.log(`\n🔥 ALERTA: Estás en PRODUCCIÓN 🔥`);
    console.log(`Esta acción afectará a USUARIOS REALES`);
  }
  
  const confirm1 = await askQuestion(`\n¿Estás SEGURO que quieres continuar? (escribe "CONFIRMO"): `);
  
  if (confirm1 !== 'CONFIRMO') {
    console.log('❌ Operación cancelada por seguridad');
    process.exit(0);
  }
  
  const confirm2 = await askQuestion(`\nÚltima oportunidad. Escribe "ELIMINAR" para confirmar: `);
  
  if (confirm2 !== 'ELIMINAR') {
    console.log('❌ Operación cancelada por seguridad');
    process.exit(0);
  }
}

async function cleanDatabases(env) {
  try {
    console.log(`🔌 Conectando a bases de datos de ${env}...`);
    await connectDatabases();
    
    const Transaction = getTransactionModel();
    const Reconciliation = getReconciliationModel();
    const ReconciliationTransaction = getReconciliationTransactionModel();
    const ReconciliationCard = getReconciliationCardModel();
    
    // Contar documentos antes de eliminar
    const transactionCount = await Transaction.countDocuments();
    const reconciliationCount = await Reconciliation.countDocuments();
    const reconciliationTransactionCount = await ReconciliationTransaction.countDocuments();
    const reconciliationCardCount = await ReconciliationCard.countDocuments();
    
    console.log(`\n📊 Documentos encontrados:`);
    console.log(`- Transacciones: ${transactionCount}`);
    console.log(`- Conciliaciones: ${reconciliationCount}`);
    console.log(`- Transacciones de conciliaciones: ${reconciliationTransactionCount}`);
    console.log(`- Tarjetas de conciliaciones: ${reconciliationCardCount}`);
    
    if (transactionCount === 0 && reconciliationCount === 0) {
      console.log('✅ Las bases de datos ya están limpias');
      process.exit(0);
    }
    
    // Eliminar documentos
    console.log(`\n🗑️ Eliminando documentos...`);
    
    const deletedTransactions = await Transaction.deleteMany({});
    console.log(`🗑️ Transacciones eliminadas: ${deletedTransactions.deletedCount}`);
    
    const deletedReconciliations = await Reconciliation.deleteMany({});
    console.log(`🗑️ Conciliaciones eliminadas: ${deletedReconciliations.deletedCount}`);
    
    const deletedReconciliationTransactions = await ReconciliationTransaction.deleteMany({});
    console.log(`🗑️ Transacciones de conciliaciones eliminadas: ${deletedReconciliationTransactions.deletedCount}`);
    
    const deletedReconciliationCards = await ReconciliationCard.deleteMany({});
    console.log(`🗑️ Tarjetas de conciliaciones eliminadas: ${deletedReconciliationCards.deletedCount}`);
    
    console.log(`\n✅ Bases de datos de ${env} limpiadas exitosamente`);
    
  } catch (error) {
    console.error('❌ Error limpiando bases de datos:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function main() {
  const env = process.env.NODE_ENV || 'development';
  
  console.log(`🌍 Entorno detectado: ${env.toUpperCase()}`);
  
  // Validación adicional de seguridad
  if (env === 'prod' && process.env.FORCE_PRODUCTION_CLEAN !== 'true') {
    console.log('🔥 SEGURIDAD: Para limpiar producción, debes establecer FORCE_PRODUCTION_CLEAN=true');
    console.log('Ejemplo: NODE_ENV=prod FORCE_PRODUCTION_CLEAN=true node scripts/clean-databases.js');
    process.exit(1);
  }
  
  await confirmAction(env);
  await cleanDatabases(env);
}

main().catch(console.error);
