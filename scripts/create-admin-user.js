const { connectDatabases } = require('../config/database');
const { getUserModel } = require('../models/User');
const { getCardModel } = require('../models/Card');

const createAdminUser = async () => {
  try {
    console.log('🚀 Connecting to databases...');
    await connectDatabases();
    console.log('✅ Connected to databases\n');

    const User = getUserModel();
    const Card = getCardModel();

    // Crear usuario admin
    const adminUser = new User({
      _id: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      username: 'darola',
      email: 'darola@nanocard.xyz',
      role: 'admin',
      profile: {
        firstName: 'Darola',
        lastName: 'Admin',
        phone: '+1234567890'
      },
      stats: {
        totalTransactions: 0,
        totalDeposited: 0,
        totalPosted: 0,
        totalPending: 0,
        totalAvailable: 0,
        lastLogin: new Date(),
        loginCount: 0
      }
    });

    await adminUser.save();
    console.log('✅ Admin user created: darola');

    // Crear tarjeta para el admin
    const adminCard = new Card({
      _id: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      userId: 'vYghJnzi2y8qkSN2Kcvx4S5WycEVjcb9',
      name: 'Darola Admin',
      last4: '0517',
      status: 'active',
      deposited: 0,
      refunded: 0,
      posted: 0,
      available: 0,
      limits: {
        daily: null,
        weekly: null,
        monthly: 10000,
        perTransaction: null
      }
    });

    await adminCard.save();
    console.log('✅ Admin card created: Darola Admin (0517)');

    console.log('\n🎉 Admin user and card created successfully!');
    console.log('📊 Login credentials:');
    console.log('   - Name: Darola Admin');
    console.log('   - Last4: 0517');
    console.log('   - Role: admin');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };
