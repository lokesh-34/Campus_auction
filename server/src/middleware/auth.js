import { verifyFirebaseToken } from '../config/firebase.js';
import { User } from '../models/index.js';

/**
 * Authentication middleware that verifies Firebase ID token and attaches MongoDB User.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        data: null,
        error: {
          message: 'Authentication required. Missing Bearer token.',
          code: 'UNAUTHORIZED',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyFirebaseToken(token);

    // Find or sync user in MongoDB
    let user = await User.findOne({ firebaseUid: decoded.uid });

    if (!user) {
      // Auto-provision initial profile if authenticating for the first time
      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email || `${decoded.uid}@campus.edu`,
        displayName: decoded.name || 'Campus Student',
        accountStatus: 'ACTIVE',
        stats: { completedSales: 0, ratingCount: 0, averageRating: 0 },
      });
    }

    if (user.accountStatus === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        data: null,
        error: {
          message: 'Your account has been suspended.',
          code: 'ACCOUNT_SUSPENDED',
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        message: error.message || 'Invalid or expired authentication credentials.',
        code: 'INVALID_TOKEN',
      },
    });
  }
}

/**
 * Optional authentication: attaches user if token provided, continues as guest if not.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = await verifyFirebaseToken(token);
      const user = await User.findOne({ firebaseUid: decoded.uid });
      if (user && user.accountStatus !== 'SUSPENDED') {
        req.user = user;
      }
    }
  } catch {
    // Ignore invalid optional tokens
  }
  next();
}
