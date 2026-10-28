import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp = null;
let isMockAuth = env.FIREBASE_AUTH_MOCK || env.NODE_ENV === 'test';

function initFirebase() {
  if (firebaseApp) return firebaseApp;

  // Try locating google-key.json or service account file
  const candidatePaths = [
    env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(process.cwd(), 'google-key.json'),
    path.resolve(process.cwd(), '../google-key.json'),
    path.resolve(__dirname, '../../../google-key.json'),
    path.resolve(__dirname, '../../google-key.json'),
  ].filter(Boolean);

  let keyFilePath = null;
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      keyFilePath = p;
      break;
    }
  }

  try {
    if (keyFilePath) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log(`✅ Firebase Admin initialized using service account: ${path.basename(keyFilePath)}`);
      isMockAuth = false;
      return firebaseApp;
    }

    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized from environment variables');
      isMockAuth = false;
      return firebaseApp;
    }
  } catch (err) {
    console.warn(`⚠️ Failed to initialize Firebase Admin with credentials (${err.message}). Falling back to mock auth mode.`);
  }

  console.log('ℹ️ Firebase Auth running in MOCK mode (dev/test)');
  isMockAuth = true;
  return null;
}

initFirebase();

/**
 * Verify Firebase ID token.
 * In mock mode or for mock tokens (e.g. 'mock:uid_123:email@example.com'), safely decodes without external call.
 * @param {string} token
 * @returns {Promise<{ uid: string, email?: string, name?: string }>}
 */
export async function verifyFirebaseToken(token) {
  if (!token) {
    throw new Error('No authentication token provided');
  }

  // Handle mock tokens for dev and testing
  if (token.startsWith('mock:')) {
    const parts = token.split(':');
    const uid = parts[1] || 'mock_uid_123';
    const email = parts[2] || `${uid}@campus.edu`;
    const name = parts[3] || 'Campus User';
    return { uid, email, name };
  }

  if (isMockAuth || !firebaseApp) {
    // If running in mock auth mode, accept decoded dummy
    return {
      uid: `mock_${token.substring(0, 10)}`,
      email: 'mockuser@campus.edu',
      name: 'Mock Campus User',
    };
  }

  // Real Firebase Admin verification
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.display_name || decoded.email?.split('@')[0],
    };
  } catch (error) {
    throw new Error(`Invalid or expired Firebase token: ${error.message}`);
  }
}

export { admin };
