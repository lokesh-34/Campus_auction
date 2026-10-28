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
  Package,
  X,
  MapPin,
  Phone,
  Check,
  Inbox,
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

  if (['NEW_QUESTION', 'SALE_APPROVAL', 'AUCTION_CLOSED_SELLER'].includes(type)) {
    return 'SELLING';
  }

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

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationsPage() {
  const { mongoUser } = useAuth();
  const currentUserId = mongoUser?._id || mongoUser?.id;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState(getDesktopNotificationPermission());
  const [testSent, setTestSent] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL'); // 'ALL' | 'UNREAD' | 'SELLING' | 'BUYING'

  // Inline reply state for questions
  const [replyTexts, setReplyTexts] = useState({});
  const [replyLoading, setReplyLoading] = useState({});
  const [replySuccess, setReplySuccess] = useState({});
  const [replyError, setReplyError] = useState({});

  // Inline approval state for sale confirmations
  const [approvalStatus, setApprovalStatus] = useState({});
  const [actionLoading, setActionLoading] = useState({});

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

  const unreadNotifications = useMemo(
    () => categorized.filter((n) => !n.isRead),
    [categorized]
  );

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
    if (activeCategory === 'UNREAD') return unreadNotifications;
    if (activeCategory === 'SELLING') return sellingNotifications;
    if (activeCategory === 'BUYING') return buyingNotifications;
    return categorized;
  }, [activeCategory, categorized, unreadNotifications, sellingNotifications, buyingNotifications]);

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

  const handleApproveSaleFromNotif = async (n) => {
    const saleId = n.saleId?._id || n.saleId || n.data?.saleId;
    if (!saleId) {
      return alert('Sale ID not found on this notification. Please open Seller Dashboard.');
    }
    setActionLoading((prev) => ({ ...prev, [n._id]: true }));
    try {
      await api.approveSale(saleId);
      setApprovalStatus((prev) => ({
        ...prev,
        [n._id]: 'Winning bid approved! The item is reserved for campus handover.',
      }));
      if (!n.isRead) {
        handleMarkRead(n._id);
      }
    } catch (err) {
      alert(err.message || 'Failed to approve winning bid');
    } finally {
      setActionLoading((prev) => ({ ...prev, [n._id]: false }));
    }
  };

  const handleRejectSaleFromNotif = async (n) => {
    if (!confirm('Are you sure you want to decline this final price?')) return;
    const saleId = n.saleId?._id || n.saleId || n.data?.saleId;
    if (!saleId) {
      return alert('Sale ID not found on this notification. Please open Seller Dashboard.');
    }
    setActionLoading((prev) => ({ ...prev, [n._id]: true }));
    try {
      await api.rejectSale(saleId);
      setApprovalStatus((prev) => ({
        ...prev,
        [n._id]: 'Final price declined. The sale has been marked as rejected.',
      }));
      if (!n.isRead) {
        handleMarkRead(n._id);
      }
    } catch (err) {
      alert(err.message || 'Failed to decline price');
    } finally {
      setActionLoading((prev) => ({ ...prev, [n._id]: false }));
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
      case 'SALE_APPROVAL':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'HANDOVER_CONFIRMED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'SAVED_SEARCH_MATCH':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'NEW_QUESTION':
        return <MessageCircle className="w-4 h-4 text-sky-500" />;
      case 'QUESTION_ANSWERED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'CLOSING_SOON':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-brand-600" />;
    }
  };

  const getIconBg = (type) => {
    switch (type) {
      case 'OUTBID':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60';
      case 'AUCTION_WON':
      case 'SALE_APPROVAL':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60';
      case 'NEW_QUESTION':
        return 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900/60';
      case 'QUESTION_ANSWERED':
      case 'HANDOVER_CONFIRMED':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60';
      case 'CLOSING_SOON':
        return 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/60';
      case 'SAVED_SEARCH_MATCH':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60';
      default:
        return 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-900/60';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-brand-600 text-white text-xs font-black shadow-sm">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Stay on top of bids, auction wins, buyer questions, and campus handovers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {desktopPermission === 'granted' && (
            <button
              onClick={handleTestNotification}
              title="Desktop alerts are active. Click to test sound and popup."
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{testSent ? 'Alert Sent! ✓' : 'Test Alert'}</span>
            </button>
          )}

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
            >
              <CheckCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Notification Integration Strip (Compact & Clean) */}
      {desktopPermission !== 'granted' && isDesktopNotificationSupported() && !bannerDismissed && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-indigo-50/50 dark:from-purple-950/30 dark:via-slate-900 dark:to-indigo-950/30 border border-purple-200/80 dark:border-purple-900/60 flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                Enable Instant Desktop Alerts
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Never miss an outbid or auction closure when this tab is in the background.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {desktopPermission === 'default' ? (
              <button
                onClick={handleEnableDesktop}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Enable</span>
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                Blocked in browser
              </span>
            )}
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CATEGORIZATION TABS: ALL | UNREAD | SELLING | BUYING */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeCategory === 'ALL'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>All</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold">
              {notifications.length}
            </span>
          </button>

          <button
            onClick={() => setActiveCategory('UNREAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeCategory === 'UNREAD'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-brand-600 text-white font-extrabold">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveCategory('SELLING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeCategory === 'SELLING'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Tag className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Selling</span>
            {sellingUnreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveCategory('BUYING')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeCategory === 'BUYING'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <ShoppingBag className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>Buying</span>
            {buyingUnreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </button>
        </div>

        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
          Showing {displayedNotifications.length} update{displayedNotifications.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* NOTIFICATIONS FEED */}
      {displayedNotifications.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-3xl space-y-3 border border-slate-200/80 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            {activeCategory === 'SELLING' ? (
              <Package className="w-6 h-6 text-emerald-600" />
            ) : activeCategory === 'BUYING' ? (
              <ShoppingBag className="w-6 h-6 text-indigo-600" />
            ) : (
              <Inbox className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {activeCategory === 'UNREAD'
              ? "You're all caught up!"
              : activeCategory === 'SELLING'
              ? 'No selling notifications yet'
              : activeCategory === 'BUYING'
              ? 'No buying notifications yet'
              : 'No notifications yet'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            {activeCategory === 'UNREAD'
              ? 'There are no unread notifications right now. Enjoy your day!'
              : activeCategory === 'SELLING'
              ? 'When buyers ask questions on your items or win your auctions, updates will appear here.'
              : activeCategory === 'BUYING'
              ? 'When you place bids, get outbid, or receive seller answers, updates will appear here.'
              : 'You will receive instant alerts here when you place bids, get outbid, or participate in campus auctions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedNotifications.map((n) => {
            const isUnread = !n.isRead;
            return (
              <div
                key={n._id}
                onClick={() => isUnread && handleMarkRead(n._id)}
                className={`p-4 sm:p-5 rounded-2xl transition duration-200 border relative ${
                  isUnread
                    ? 'bg-white dark:bg-slate-900 border-l-4 border-l-brand-600 dark:border-l-brand-500 border-slate-200 dark:border-slate-800 shadow-md ring-1 ring-brand-500/10'
                    : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Category / Event Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(n.type)}`}>
                    {getIcon(n.type)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Top Meta Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                            n.category === 'SELLING'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800'
                          }`}
                        >
                          {n.category === 'SELLING' ? 'Selling Activity' : 'Buying Activity'}
                        </span>

                        {isUnread && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-600 dark:bg-brand-400 animate-pulse" />
                            <span>New</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                          {formatTimeAgo(n.createdAt)}
                        </span>
                        {isUnread && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkRead(n._id);
                            }}
                            title="Mark as read"
                            className="p-1 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notification Message */}
                    <p
                      className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                        isUnread
                          ? 'font-bold text-slate-900 dark:text-slate-100'
                          : 'text-slate-600 dark:text-slate-300 font-medium'
                      }`}
                    >
                      {n.message}
                    </p>

                    {/* Handover & Pickup Details Callout Card (Neat Compact Strip) */}
                    {(n.type === 'AUCTION_WON' || n.type === 'RESERVATION_ACTIVE') &&
                      (n.data?.pickupPoint || n.data?.sellerPhone) && (
                        <div
                          className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center gap-3 text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {n.data?.pickupPoint && (
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Pickup:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {n.data.pickupPoint}
                              </span>
                            </div>
                          )}
                          {n.data?.sellerPhone && (
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                              <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Seller Phone:</span>
                              <a
                                href={`tel:${n.data.sellerPhone}`}
                                className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                {n.data.sellerPhone}
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                    {/* Inline Quick Action for SALE_APPROVAL */}
                    {n.type === 'SALE_APPROVAL' && (
                      <div
                        className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {approvalStatus[n._id] ? (
                          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{approvalStatus[n._id]}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={actionLoading[n._id]}
                              onClick={() => handleRejectSaleFromNotif(n)}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                            >
                              Decline Price
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading[n._id]}
                              onClick={() => handleApproveSaleFromNotif(n)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{actionLoading[n._id] ? 'Updating...' : 'Approve & Reserve'}</span>
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs ml-auto">
                          {n.listingId && (
                            <Link
                              to={`/auctions/${n.listingId._id || n.listingId}`}
                              className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                            >
                              <span>View Auction</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                          <Link
                            to="/seller-dashboard"
                            className="font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
                          >
                            Seller Dashboard ↗
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Inline Quick Reply for Questions */}
                    {n.type === 'NEW_QUESTION' && (
                      <div
                        className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {replySuccess[n._id] ? (
                          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Replied: &quot;{replySuccess[n._id]}&quot;</span>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              Published ✓
                            </span>
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDirectReply(n);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={replyTexts[n._id] || ''}
                              onChange={(e) =>
                                setReplyTexts({ ...replyTexts, [n._id]: e.target.value })
                              }
                              placeholder="Type reply to student..."
                              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
                            />
                            <button
                              type="submit"
                              disabled={replyLoading[n._id] || !replyTexts[n._id]?.trim()}
                              className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 shrink-0 flex items-center gap-1"
                            >
                              <span>{replyLoading[n._id] ? 'Sending...' : 'Reply'}</span>
                              <Send className="w-3 h-3" />
                            </button>
                          </form>
                        )}
                        {replyError[n._id] && (
                          <p className="text-[11px] text-rose-600 font-semibold">{replyError[n._id]}</p>
                        )}
                      </div>
                    )}

                    {/* Bottom Action Link for other notification types */}
                    {n.listingId && n.type !== 'SALE_APPROVAL' && (
                      <div className="pt-1 flex items-center gap-3">
                        <Link
                          to={`/auctions/${n.listingId._id || n.listingId}`}
                          className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 hover:underline"
                        >
                          <span>View Auction</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
