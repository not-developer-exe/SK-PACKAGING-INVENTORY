require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const partyRoutes = require('./routes/party.routes');
const inwardRoutes = require('./routes/inward.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const productionRoutes = require('./routes/production.routes');
const conversionRoutes = require('./routes/conversion.routes');
const ledgerRoutes = require('./routes/ledger.routes');
const dispatchRoutes = require('./routes/dispatch.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const wasteRoutes = require('./routes/waste.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const controlRoutes = require('./routes/control.routes');
const usersRoutes = require('./routes/users.routes');

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.info('[API] ' + req.method + ' ' + req.path);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/inward', inwardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/controls', controlRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/conversion', conversionRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/invoices', invoiceRoutes);

app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'degraded',
    database: databaseReady ? 'connected' : 'disconnected'
  });
});

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'API route not found' });
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  if (res.headersSent) return next(err);
  const status = err.statusCode || (err.message === 'Origin not allowed by CORS' ? 403 : 500);
  res.status(status).json({
    status: 'error',
    message: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : (err.message || 'Internal server error')
  });
});

const PORT = Number(process.env.PORT) || 5001;

async function startServer() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  await connectDB();
  const server = app.listen(PORT, () => console.info('SK Packaging ERP API listening on port ' + PORT));
  const shutdown = (signal) => {
    console.info(signal + ' received; shutting down gracefully');
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start API:', error.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };
