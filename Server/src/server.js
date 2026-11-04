require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const partyRoutes = require('./routes/party.routes');
const app = express();
const inwardRoutes = require('./routes/inward.routes');

app.use('/api/inward', inwardRoutes);
app.use('/api/parties', partyRoutes);

// 1. DATABASE CONNECTION
connectDB();

// 2. BULLETPROOF CORS (MUST BE VERY FIRST MIDDLEWARE)
const corsOptions = {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
  app.use(cors(corsOptions));

// 3. BODY PARSERS
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 4. NETWORK LOGGER
app.use((req, res, next) => {
  console.log(`[NETWORK] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

// 5. ROUTES
app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'active', message: 'SK Packaging ERP API is running' });
});

// 6. ERROR HANDLER
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

// 7. START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🚀 ERP Server running on port ${PORT}`);
  console.log(`=========================================\n`);
});