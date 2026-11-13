require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Import Routes
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

const app = express();

// 1. DATABASE CONNECTION
connectDB();

// 2. BULLETPROOF CORS
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// 3. BODY & COOKIE PARSERS (MUST BE BEFORE ROUTES)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Creates req.cookies

// 4. NETWORK LOGGER
app.use((req, res, next) => {
  console.log(`[NETWORK] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

// 5. ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/parties', partyRoutes);
app.use('/api/inward', inwardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/conversion', conversionRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/invoices', invoiceRoutes);

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
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`🚀 ERP Server running on port ${PORT}`);
  console.log(`=========================================\n`);
});