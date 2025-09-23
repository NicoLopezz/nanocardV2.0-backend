#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { connectDatabases } = require('../config/database');
const { getTransactionModel } = require('../models/Transaction');
const { getReconciliationModel } = require('../models/Reconciliation');
const { getReconciliationTransactionModel } = require('../models/ReconciliationTransaction');
const { getReconciliationCardModel } = require('../models/ReconciliationCard');

async function createBackup(env) {
  try {
    console.log(`🔌 Conectando a bases de datos de ${env}...`);
    await connectDatabases();
    
    const Transaction = getTransactionModel();
    const Reconciliation = getReconciliationModel();
    const ReconciliationTransaction = getReconciliationTransactionModel();
    const ReconciliationCard = getReconciliationCardModel();
    
    // Crear directorio de backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, '..', 'backups', `${env}_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    
    console.log(`📁 Creando backup en: ${backupDir}`);
    
    // Backup de transacciones
    const transactions = await Transaction.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'transactions.json'),
      JSON.stringify(transactions, null, 2)
    );
    console.log(`💾 Backup transacciones: ${transactions.length} documentos`);
    
    // Backup de conciliaciones
    const reconciliations = await Reconciliation.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'reconciliations.json'),
      JSON.stringify(reconciliations, null, 2)
    );
    console.log(`💾 Backup conciliaciones: ${reconciliations.length} documentos`);
    
    // Backup de transacciones de conciliaciones
    const reconciliationTransactions = await ReconciliationTransaction.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'reconciliation_transactions.json'),
      JSON.stringify(reconciliationTransactions, null, 2)
    );
    console.log(`💾 Backup transacciones de conciliaciones: ${reconciliationTransactions.length} documentos`);
    
    // Backup de tarjetas de conciliaciones
    const reconciliationCards = await ReconciliationCard.find({}).lean();
    fs.writeFileSync(
      path.join(backupDir, 'reconciliation_cards.json'),
      JSON.stringify(reconciliationCards, null, 2)
    );
    console.log(`💾 Backup tarjetas de conciliaciones: ${reconciliationCards.length} documentos`);
    
    // Crear archivo de metadatos
    const metadata = {
      environment: env,
      timestamp: new Date().toISOString(),
      counts: {
        transactions: transactions.length,
        reconciliations: reconciliations.length,
        reconciliationTransactions: reconciliationTransactions.length,
        reconciliationCards: reconciliationCards.length
      }
    };
    
    fs.writeFileSync(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    console.log(`\n✅ Backup completado exitosamente`);
    console.log(`📁 Ubicación: ${backupDir}`);
    
    return backupDir;
    
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    throw error;
  }
}

async function main() {
  const env = process.env.NODE_ENV || 'development';
  console.log(`🌍 Creando backup de entorno: ${env.toUpperCase()}`);
  
  try {
    await createBackup(env);
  } catch (error) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createBackup };
