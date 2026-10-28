/**
 * Plays a pleasant, subtle two-tone audio chime using the Web Audio API.
 * Does not require external audio assets.
 */
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (D5 - 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Second tone (A5 - 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.4);
  } catch (err) {
    // Gracefully handle browser autoplay policies
  }
}

/**
 * Checks if the browser supports desktop notifications.
 * @returns {boolean}
 */
export function isDesktopNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Returns the current notification permission state: 'default' | 'granted' | 'denied'.
 * @returns {string}
 */
export function getDesktopNotificationPermission() {
  if (!isDesktopNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests desktop notification permission from the user.
 * @returns {Promise<string>} 'granted' | 'denied' | 'default'
 */
export async function requestDesktopNotificationPermission() {
  if (!isDesktopNotificationSupported()) {
    throw new Error('Desktop notifications are not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Sends a desktop notification to the operating system.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.body
 * @param {string} [options.type]
 * @param {string} [options.listingId]
 * @param {string} [options.saleId]
 * @param {string} [options.tag]
 * @param {boolean} [options.playSound]
 */
export function showDesktopNotification({
  title,
  body,
  type = 'GENERAL',
  listingId = null,
  saleId = null,
  tag = null,
  playSound = true,
}) {
  if (!isDesktopNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  if (playSound) {
    playNotificationChime();
  }

  // Determine contextual title if not explicitly provided
  let notifTitle = title;
  if (!notifTitle) {
    switch (type) {
      case 'OUTBID':
        notifTitle = '⚠️ CampusBid: You have been outbid!';
        break;
      case 'AUCTION_WON':
        notifTitle = '🏆 CampusBid: You won the auction!';
        break;
      case 'HANDOVER_CONFIRMED':
        notifTitle = '🤝 CampusBid: Handover Confirmed!';
        break;
      case 'NEW_QUESTION':
        notifTitle = '💬 CampusBid: New question from buyer';
        break;
      case 'QUESTION_ANSWERED':
        notifTitle = '💡 CampusBid: Seller answered your question';
        break;
      case 'SAVED_SEARCH_MATCH':
        notifTitle = '✨ CampusBid: New matching item listed';
        break;
      case 'SALE_APPROVAL':
        notifTitle = '🎉 CampusBid: Winning bid approved!';
        break;
      default:
        notifTitle = '🔔 CampusBid Alert';
        break;
    }
  }

  try {
    const notification = new Notification(notifTitle, {
      body: body || 'You have a new campus auction update.',
      icon: '/favicon.ico',
      tag: tag || `campusbid_${Date.now()}`,
      badge: '/favicon.ico',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (listingId) {
        window.location.href = `/auctions/${listingId}`;
      } else if (saleId) {
        window.location.href = `/dashboard/buyer`;
      } else {
        window.location.href = `/notifications`;
      }
    };

    return notification;
  } catch (err) {
    console.warn('Failed to display desktop notification:', err);
    return null;
  }
}

/**
 * Triggers a test desktop notification so the user can verify their OS alerts.
 */
export function sendTestDesktopNotification() {
  return showDesktopNotification({
    title: '🔔 CampusBid Notifications Active',
    body: 'Great! Desktop notifications are working. You will receive live alerts for outbids, winning auctions, and seller replies.',
    tag: 'test_notification',
    playSound: true,
  });
}
