import express from 'express';
import mongoose from 'mongoose';
import { isReplicaSetSupported } from '../config/db.js';

export const healthRouter = express.Router();

healthRouter.get('/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  const replicaSetAvailable = isReplicaSetSupported();

  const status = isConnected ? 'healthy' : 'degraded';

  res.status(isConnected ? 200 : 503).json({
    success: true,
    data: {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        connected: isConnected,
        replicaSet: replicaSetAvailable,
        transactionsSupported: replicaSetAvailable,
      },
    },
    error: null,
  });
});
