import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { standardLimiter } from './middleware/rateLimiter.js';

// Route imports
import { healthRouter } from './routes/health.js';
import { userRouter } from './routes/userRoutes.js';
import { listingRouter } from './routes/listingRoutes.js';
import { bidRouter } from './routes/bidRoutes.js';
import { saleRouter } from './routes/saleRoutes.js';
import { communityRouter } from './routes/communityRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { uploadRouter } from './routes/uploadRoutes.js';

import { swaggerSpec, swaggerUi } from './config/swagger.js';

export const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
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

// OpenAPI Swagger UI Interactive Testing & Spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'CampusBid API Docs & Testing Explorer',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
    },
  })
);

// Register API Routes
app.use('/api/v1', healthRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/listings', listingRouter);
app.use('/api/v1', bidRouter);
app.use('/api/v1/sales', saleRouter);
app.use('/api/v1', communityRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/uploads', uploadRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'CampusBid API',
    description: 'Campus Auction Marketplace Authoritative Backend',
    version: '1.0.0',
    health: '/api/v1/health',
    docs: '/api-docs',
    openApiSpec: '/api-docs.json',
  });
});

// Fallback handlers
app.use(notFound);
app.use(errorHandler);
