import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  sendTestDesktopNotification,
  isDesktopNotificationSupported,
} from '../services/desktopNotifications.js';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [desktopPermission, setDesktopPermission] = useState(getDesktopNotificationPermission());
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase mb-2">
            <Bell className="w-3.5 h-3.5" />
            <span>Activity Feed</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Notification Centre</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time updates on your bids, auction closures, handovers, and questions.
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

      {notifications.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center mx-auto">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No notifications yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You will receive instant alerts here when you place bids, get outbid, or win an auction.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
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
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                    {n.message}
                  </p>
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
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-brand-600"></span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
