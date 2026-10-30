import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { chatRouter } from './routes/chat.js';
import { query } from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad y parsing
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Limitador de tasa de peticiones (Rate Limit: 60 peticiones por minuto por IP)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    error: 'Demasiadas solicitudes desde esta IP, por favor intenta de nuevo en un minuto.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Rutas de API
app.use('/api', chatRouter);

/**
 * GET /api/health
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'offline_or_fallback';
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: dbStatus,
    version: '1.0.0'
  });
});

export const server = app.listen(PORT, () => {
  console.log(`[Server] Inmobiliaria Chatbot API corriendo en http://localhost:${PORT}`);
  console.log(`[Server] Health check disponible en http://localhost:${PORT}/api/health`);
});

export default app;
