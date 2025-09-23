# Environment Variables

## 🔐 Required Environment Variables

### Database
- `MONGODB_URI` - MongoDB connection string

### Server
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production/test)

### JWT
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_EXPIRE` - JWT expiration time

### CryptoMate API (REQUIRED)
- `CRYPTOMATE_API_KEY` - Your CryptoMate API key
- `CRYPTOMATE_SESSION_ID` - Your CryptoMate session ID

### Mercury API (Optional)
- `MERCURY_API_KEY` - Mercury API key
- `MERCURY_AUTH_TOKEN` - Mercury auth token

### Email (Optional)
- `EMAIL` - Email address for notifications
- `EMAIL_PASSWORD` - Email password

## ⚠️ Security Notice

**NEVER commit API keys to version control!**

The application will fail to start if required environment variables are missing.

## 📝 Setup Instructions

1. Copy your environment variables to your deployment platform (Render, Heroku, etc.)
2. For local development, create a `.env` file (not committed to git)
3. Ensure all required variables are set before starting the application

## 🚨 Missing Variables

If `CRYPTOMATE_API_KEY` or `CRYPTOMATE_SESSION_ID` are not set, the application will throw an error:

```
Error: CRYPTOMATE_API_KEY and CRYPTOMATE_SESSION_ID must be set in environment variables
```
