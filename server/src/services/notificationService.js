import { Notification, User } from '../models/index.js';
import { emitUserUpdate } from '../sockets/socketManager.js';

/**
 * Dispatches a persistent, deduplicated notification to a user.
 * @param {Object} params
 * @param {string} params.recipientId
 * @param {string} params.type
 * @param {string} [params.listingId]
 * @param {string} [params.saleId]
 * @param {string} params.message
 * @param {Object} [params.data]
 * @param {string} params.eventKey - Unique deduplication key
 */
export async function createNotification({
  recipientId,
  type,
  listingId = null,
  saleId = null,
  message,
  data = {},
  eventKey,
}) {
  try {
    // Check recipient's notification preferences
    const recipient = await User.findById(recipientId);
    if (!recipient) return null;

    const prefs = recipient.notificationPreferences || {};
    if (type === 'OUTBID' && prefs.outbid === false) return null;
    if (type === 'CLOSING_SOON' && prefs.closingSoon === false) return null;
    if (
      ['SALE_APPROVAL', 'SALE_REJECTED', 'HANDOVER_CONFIRMED', 'SALE_CANCELLED'].includes(type) &&
      prefs.saleUpdates === false
    ) {
      return null;
    }

    // Try upserting / creating with eventKey deduplication
    const notification = await Notification.findOneAndUpdate(
      { recipientId, eventKey },
      {
        $setOnInsert: {
          recipientId,
          type,
          listingId,
          saleId,
          message,
          data,
          eventKey,
          isRead: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Emit live socket event to user room
    emitUserUpdate(recipientId.toString(), 'notification:new', {
      id: notification._id,
      type: notification.type,
      message: notification.message,
      listingId: notification.listingId,
      saleId: notification.saleId,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    // Duplicate key error (11000) is safely ignored for deduplication
    if (error.code === 11000) {
      return null;
    }
    console.error('Error creating notification:', error);
    return null;
  }
}
