import express from 'express';
import cors from 'cors';
import { initDB } from './config/db.js';
import ticketsRouter from './routes/tickets.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', ticketsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Initialize database and start server
const startServer = async () => {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Parking Lot Backend running on port ${PORT}`);
  });
};

startServer();
