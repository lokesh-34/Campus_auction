import mongoose from 'mongoose';
import { env } from './env.js';
import { seedDemoData } from './seedData.js';

let isReplicaSet = false;
let memoryServerInstance = null;

/**
 * Connect to MongoDB and detect replica set support.
 * In development, if connecting to localhost fails (e.g. ECONNREFUSED), automatically launches
 * a local in-memory MongoDB replica set with transactions enabled and seeds demo data!
 * @param {string} [uri]
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri = env.MONGODB_URI) {
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
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
        '⚠️ MongoDB is running in STANDALONE mode without a replica set. To enable multi-document transactions locally, start mongod with --replSet rs0 and run rs.initiate().'
      );
    }

    if (env.NODE_ENV === 'development') {
      await seedDemoData();
    }

    return conn;
  } catch (err) {
    // If local development and connection refused, auto-start in-memory replica set
    if (env.NODE_ENV === 'development' && (err.name === 'MongooseServerSelectionError' || err.message.includes('ECONNREFUSED'))) {
      console.log('💡 No active local MongoDB daemon found on port 27017.');
      console.log('🚀 Automatically starting embedded in-memory MongoDB Replica Set for development...');
      try {
        const { MongoMemoryReplSet } = await import('mongodb-memory-server');
        memoryServerInstance = await MongoMemoryReplSet.create({
          replSet: { count: 1, name: 'rs0' },
        });

        const memUri = memoryServerInstance.getUri();
        const conn = await mongoose.connect(memUri);
        isReplicaSet = true;

        console.log(`✨ Local in-memory MongoDB Replica Set active at: ${memUri}`);
        console.log('✅ Multi-document transactions fully enabled.');

        // Seed initial campus items for exploration
        await seedDemoData();

        return conn;
      } catch (memErr) {
        console.error('Failed to start in-memory MongoDB:', memErr.message);
        throw err;
      }
    }

    console.error('❌ Failed to connect to MongoDB:', err.message);
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
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
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
