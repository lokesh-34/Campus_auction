import { Listing, User } from '../models/index.js';

export async function syncUser(req, res, next) {
  try {
    const user = req.user;
    if (req.body.displayName) {
      user.displayName = req.body.displayName;
    }
    if (req.body.profileImage) {
      user.profileImage = req.body.profileImage;
    }
    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        profileImage: user.profileImage,
        notificationPreferences: user.notificationPreferences,
        stats: user.stats,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUser(req, res, next) {
  try {
    const user = req.user;
    res.json({
      success: true,
      data: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        profileImage: user.profileImage,
        role: user.role,
        notificationPreferences: user.notificationPreferences,
        stats: user.stats,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const user = req.user;
    const { displayName, profileImage, notificationPreferences } = req.body;

    if (displayName) user.displayName = displayName;
    if (profileImage) user.profileImage = profileImage;
    if (notificationPreferences) {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        displayName: user.displayName,
        profileImage: user.profileImage,
        notificationPreferences: user.notificationPreferences,
        stats: user.stats,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPublicProfile(req, res, next) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { message: 'User not found', code: 'NOT_FOUND' },
      });
    }

    // Active listings by this seller
    const activeListings = await Listing.find({
      sellerId: user._id,
      status: { $in: ['ACTIVE', 'EXTENDED'] },
    }).select('title category currentPricePaise startingPricePaise closingAt images bidCount');

    res.json({
      success: true,
      data: {
        profile: user.toPublicProfile(),
        activeListings,
      },
    });
  } catch (err) {
    next(err);
  }
}
