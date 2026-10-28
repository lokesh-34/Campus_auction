import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Trophy,
  AlertTriangle,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  Send,
  ShoppingBag,
  Tag,
  Filter,
  Package,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  sendTestDesktopNotification,
  isDesktopNotificationSupported,
} from '../services/desktopNotifications.js';

/**
 * Classifies a notification as either 'SELLING' or 'BUYING'.
 */
export function categorizeNotification(n, currentUserId) {
  const type = n.type;

  // 1. Explicit Selling updates:
  // - A buyer asked a question on your listing (NEW_QUESTION)
  // - An auction closed with a winning bid requiring your approval (SALE_APPROVAL)
  // - Your auction concluded (AUCTION_CLOSED_SELLER)
  if (['NEW_QUESTION', 'SALE_APPROVAL', 'AUCTION_CLOSED_SELLER'].includes(type)) {
    return 'SELLING';
  }

  // 2. Explicit Buying updates:
  // - You placed a bid and got outbid (OUTBID)
  // - You won an auction (AUCTION_WON)
  // - An auction you watch/bid on is closing soon (CLOSING_SOON)
  // - A seller answered your question (QUESTION_ANSWERED)
  // - A saved search matched a new listing (SAVED_SEARCH_MATCH)
  // - A seller declined the winning price (SALE_REJECTED)
  if ([
    'OUTBID',
    'AUCTION_WON',
    'CLOSING_SOON',
    'QUESTION_ANSWERED',
    'SAVED_SEARCH_MATCH',
    'SALE_REJECTED',
  ].includes(type)) {
    return 'BUYING';
  }

  // 3. Handover & settlement notifications
  if (
    n.eventKey?.includes('sold_seller') ||
    n.message?.toLowerCase().includes('completed sales count') ||
    n.message?.toLowerCase().includes('approve winning')
  ) {
    return 'SELLING';
  }

  if (currentUserId && n.listingId?.sellerId) {
    const sId = n.listingId.sellerId._id || n.listingId.sellerId;
    if (sId.toString() === currentUserId.toString()) {
      return 'SELLING';
    }
    return 'BUYING';
  }

  // 4. Message content heuristics
  const msgLower = (n.message || '').toLowerCase();
  if (
    msgLower.includes('new question on') ||
    msgLower.includes('approve') ||
    msgLower.includes('your item') ||
    msgLower.includes('your listing')
  ) {
    return 'SELLING';
  }

  return 'BUYING';
}

export function NotificationsPage() {
  const { mongoUser } = useAuth();
  const currentUserId = mongoUser?._id || mongoUser?.id;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState(getDesktopNotificationPermission());
  const [testSent, setTestSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'SELLING' | 'BUYING'

  // In-line reply state for questions
  const [replyTexts, setReplyTexts] = useState({});
  const [replyLoading, setReplyLoading] = useState({});
  const [replySuccess, setReplySuccess] = useState({});
  const [replyError, setReplyError] = useState({});

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await api.getNotifications(1);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Categorize all notifications
  const categorized = useMemo(() => {
    return notifications.map((n) => ({
      ...n,
      category: categorizeNotification(n, currentUserId),
    }));
  }, [notifications, currentUserId]);

  const sellingNotifications = useMemo(
    () => categorized.filter((n) => n.category === 'SELLING'),
    [categorized]
  );

  const buyingNotifications = useMemo(
    () => categorized.filter((n) => n.category === 'BUYING'),
    [categorized]
  );

  const sellingUnreadCount = useMemo(
    () => sellingNotifications.filter((n) => !n.isRead).length,
    [sellingNotifications]
  );

  const buyingUnreadCount = useMemo(
    () => buyingNotifications.filter((n) => !n.isRead).length,
    [buyingNotifications]
  );

  const displayedNotifications = useMemo(() => {
    if (activeCategory === 'SELLING') return sellingNotifications;
    if (activeCategory === 'BUYING') return buyingNotifications;
    return categorized;
  }, [activeCategory, categorized, sellingNotifications, buyingNotifications]);

  const handleDirectReply = async (n) => {
    const text = replyTexts[n._id]?.trim();
    if (!text) return;

    setReplyLoading((prev) => ({ ...prev, [n._id]: true }));
    setReplyError((prev) => ({ ...prev, [n._id]: '' }));

    try {
      let qId = n.data?.questionId;

      if (!qId && n.eventKey && n.eventKey.startsWith('question_')) {
        qId = n.eventKey.replace('question_', '');
      }

      const listingId = n.listingId?._id || n.listingId;

      // Fallback: If qId is missing, query open questions on this listing
      if (!qId && listingId) {
        const listingQuestions = await api.getQuestions(listingId);
        const extracted = n.message.match(/:\s*"([^"]+)"/);
        const searchTxt = extracted ? extracted[1].trim() : '';
        const found = listingQuestions.find(
          (q) => q.status === 'OPEN' && (searchTxt ? q.questionText.includes(searchTxt) : true)
        ) || listingQuestions.find((q) => q.status === 'OPEN');

        if (found) {
          qId = found._id;
        }
      }

      if (!qId) {
        throw new Error('Could not identify question ID. Please view the auction to answer.');
      }

      await api.answerQuestion(qId, text);

      setReplySuccess((prev) => ({ ...prev, [n._id]: text }));
      setReplyTexts((prev) => ({ ...prev, [n._id]: '' }));

      // Automatically mark notification as read
      if (!n.isRead) {
        handleMarkRead(n._id);
      }
    } catch (err) {
      setReplyError((prev) => ({
        ...prev,
        [n._id]: err.message || 'Failed to submit reply.',
      }));
    } finally {
      setReplyLoading((prev) => ({ ...prev, [n._id]: false }));
    }
  };

  const handleEnableDesktop = async () => {
    try {
      const perm = await requestDesktopNotificationPermission();
      setDesktopPermission(perm);
      if (perm === 'granted') {
        sendTestDesktopNotification();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestNotification = () => {
    sendTestDesktopNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'OUTBID':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'AUCTION_WON':
        return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'HANDOVER_CONFIRMED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'SAVED_SEARCH_MATCH':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'NEW_QUESTION':
      case 'QUESTION_ANSWERED':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-brand-600" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase mb-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Activity Feed</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Notification Centre</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time updates on your bids, auction closures, handovers, and buyer questions.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition shadow-sm self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All as Read ({unreadCount})</span>
          </button>
        )}
      </div>

      {/* Desktop Notification Integration Card */}
      <div className="glass-panel p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-white">
        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
            desktopPermission === 'granted'
              ? 'bg-emerald-100 text-emerald-700'
              : desktopPermission === 'denied'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-purple-100 text-purple-700'
          }`}>
            {desktopPermission === 'granted' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : desktopPermission === 'denied' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            ) : (
              <Bell className="w-5 h-5 text-purple-600 animate-bounce" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-sm">Desktop OS Notifications</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                desktopPermission === 'granted'
                  ? 'bg-emerald-100 text-emerald-800'
                  : desktopPermission === 'denied'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {desktopPermission === 'granted'
                  ? 'Active'
                  : desktopPermission === 'denied'
                  ? 'Blocked'
                  : 'Not Enabled'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-lg">
              {desktopPermission === 'granted'
                ? 'Live alerts are enabled on your computer. You will receive native popups and sound chimes when someone outbids you, when an auction closes, or when a seller replies.'
                : desktopPermission === 'denied'
                ? 'Notifications are blocked in your browser settings. To enable, click the tune/lock icon in your browser URL address bar and allow Notifications.'
                : 'Never miss an auction win or outbid! Enable native desktop alerts to receive updates even when this tab is in the background.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {desktopPermission === 'granted' ? (
            <button
              onClick={handleTestNotification}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>{testSent ? 'Alert Sent! ✓' : 'Send Test Alert'}</span>
            </button>
          ) : desktopPermission === 'default' ? (
            <button
              onClick={handleEnableDesktop}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <Bell className="w-4 h-4" />
              <span>Enable Desktop Alerts</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* CATEGORIZATION TABS: ALL | SELLING | BUYING */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveCategory('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeCategory === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>All Notifications</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeCategory === 'ALL' ? 'bg-slate-700 text-slate-100' : 'bg-slate-200 text-slate-700'
          }`}>
            {notifications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveCategory('SELLING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeCategory === 'SELLING'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Selling Related</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeCategory === 'SELLING' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {sellingNotifications.length}
          </span>
          {sellingUnreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveCategory('BUYING')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeCategory === 'BUYING'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Buying Related</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
            activeCategory === 'BUYING' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {buyingNotifications.length}
          </span>
          {buyingUnreadCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* NOTIFICATIONS FEED */}
      {displayedNotifications.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            {activeCategory === 'SELLING' ? (
              <Package className="w-6 h-6 text-emerald-600" />
            ) : activeCategory === 'BUYING' ? (
              <ShoppingBag className="w-6 h-6 text-indigo-600" />
            ) : (
              <Bell className="w-6 h-6 text-slate-500" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {activeCategory === 'SELLING'
              ? 'No selling notifications yet'
              : activeCategory === 'BUYING'
              ? 'No buying notifications yet'
              : 'No notifications yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeCategory === 'SELLING'
              ? 'When buyers ask questions on your items or win your auctions, updates will appear here.'
              : activeCategory === 'BUYING'
              ? 'When you place bids, get outbid, or receive seller answers, updates will appear here.'
              : 'You will receive instant alerts here when you place bids, get outbid, or participate in campus auctions.'}
          </p>
          {activeCategory === 'SELLING' ? (
            <Link
              to="/create-listing"
              className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm"
            >
              + Post an Item to Sell
            </Link>
          ) : activeCategory === 'BUYING' ? (
            <Link
              to="/marketplace"
              className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm"
            >
              Browse Campus Marketplace
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedNotifications.map((n) => (
            <div
              key={n._id}
              onClick={() => !n.isRead && handleMarkRead(n._id)}
              className={`p-4 sm:p-5 rounded-2xl glass-panel border transition cursor-pointer flex items-start gap-4 ${
                !n.isRead ? 'border-brand-300 bg-brand-50/20 shadow-md' : 'border-slate-200/80 hover:bg-slate-50/50'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm shrink-0">
                {getIcon(n.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                        n.category === 'SELLING'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {n.category === 'SELLING' ? 'Selling Activity' : 'Buying Activity'}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-brand-600" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                      {n.message}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  {n.listingId && (
                    <Link
                      to={`/auctions/${n.listingId._id || n.listingId}`}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <span>View Auction</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {/* Inline Quick Reply for Questions */}
                {n.type === 'NEW_QUESTION' && (
                  <div
                    className="mt-3 pt-3 border-t border-slate-200/80 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {replySuccess[n._id] ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Replied: &quot;{replySuccess[n._id]}&quot;</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-md">
                          Answer Published ✓
                        </span>
                      </div>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDirectReply(n);
                        }}
                        className="space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={replyTexts[n._id] || ''}
                            onChange={(e) =>
                              setReplyTexts({ ...replyTexts, [n._id]: e.target.value })
                            }
                            placeholder="Give reply here itself to the buyer..."
                            className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white shadow-sm font-medium"
                          />
                          <button
                            type="submit"
                            disabled={replyLoading[n._id] || !replyTexts[n._id]?.trim()}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                          >
                            <span>{replyLoading[n._id] ? 'Sending...' : 'Reply'}</span>
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {replyError[n._id] && (
                          <p className="text-[11px] text-rose-600 font-semibold">{replyError[n._id]}</p>
                        )}
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
