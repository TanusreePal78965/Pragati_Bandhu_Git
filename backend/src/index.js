require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Future Route Mounts:
// app.use('/api/shops', require('./routes/shops'));
// app.use('/api/products', require('./routes/products'));
// app.use('/api/sales', require('./routes/sales'));
// app.use('/api/suggestions', require('./routes/suggestions'));
// app.use('/api/alerts', require('./routes/alerts'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pragati Bandhu Backend running on http://0.0.0.0:${PORT}`);
});
