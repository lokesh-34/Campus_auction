import mongoose from 'mongoose';
import { env } from './env.js';

let isReplicaSet = false;

/**
 * Connect to MongoDB and detect replica set support.
 * @param {string} [uri]
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri = env.MONGODB_URI) {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`✅ Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);

    // Detect replica set support
    try {
      const adminDb = conn.connection.db?.admin();
      if (adminDb) {
        const hello = await adminDb.command({ hello: 1 });
        isReplicaSet = Boolean(hello.setName || hello.hosts);
      }
    } catch {
      isReplicaSet = false;
    }

    if (isReplicaSet) {
      console.log('✅ MongoDB Replica Set detected: Multi-document transactions enabled.');
    } else {
      console.warn(
        '⚠️ MongoDB is running in STANDALONE mode without a replica set. Multi-document transactions will fail safely if requested. To enable transactions locally, start mongod with --replSet rs0 and run rs.initiate().'
      );
    }

    return conn;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err);
    throw err;
  }
}

/**
 * Check whether replica set transactions are supported in current connection
 * @returns {boolean}
 */
export function isReplicaSetSupported() {
  return isReplicaSet;
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDB() {
  await mongoose.disconnect();
}

/**
 * Execute transactional work with fail-safe replica set check.
 * If the current MongoDB deployment lacks replica set support, fails safely with an explicit error
 * rather than silently performing non-atomic mutations.
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(work) {
  if (!isReplicaSet && process.env.NODE_ENV !== 'test') {
    throw new Error(
      'Transaction unavailable: MongoDB requires a replica set for multi-document atomic transactions. Standalone mongod is not supported.'
    );
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
