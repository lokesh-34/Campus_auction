import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { standardLimiter } from './middleware/rateLimiter.js';
import { healthRouter } from './routes/health.js';

export const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Configured for flexible API responses & client proxy
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (
        origin === env.CLIENT_URL ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Standard body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limiting
app.use(standardLimiter);

// API Routes
app.use('/api/v1', healthRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to CampusBid API',
    docs: '/api/v1/health',
    version: '1.0.0',
  });
});

// Fallback handlers
app.use(notFound);
app.use(errorHandler);
