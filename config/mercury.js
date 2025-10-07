module.exports = {
  api: {
    baseUrl: process.env.MERCURY_API_BASE_URL || 'https://api.mercury.com/api/v1',
    token: process.env.MERCURY_API_TOKEN,
    accountId: process.env.MERCURY_ACCOUNT_ID || '0d2807aa-0d89-11ef-aa9b-67de6c000595'
  }
};

console.log('🔧 Mercury Config:', {
  baseUrl: process.env.MERCURY_API_BASE_URL || 'https://api.mercury.com/api/v1',
  accountId: process.env.MERCURY_ACCOUNT_ID || '0d2807aa-0d89-11ef-aa9b-67de6c000595',
  hasToken: !!process.env.MERCURY_API_TOKEN
});
