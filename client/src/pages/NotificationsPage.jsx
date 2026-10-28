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
  Send,
} from 'lucide-react';
import { api } from '../services/api.js';

export function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // In-line reply state for questions
  const [replyTexts, setReplyTexts] = useState({});
  const [replyLoading, setReplyLoading] = useState({});
  const [replySuccess, setReplySuccess] = useState({});
  const [replyError, setReplyError] = useState({});

  useEffect(() => {
    loadNotifications();
  }, []);

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
