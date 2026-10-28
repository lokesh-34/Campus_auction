import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Timer,
  ShieldCheck,
  Zap,
  TrendingUp,
  Heart,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  User,
  Star,
  Award,
  Sparkles,
  MapPin,
  Phone,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees, rupeesToPaise } from '../utils/formatCurrency.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSocket } from '../contexts/SocketContext.jsx';

export function AuctionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, mongoUser } = useAuth();
  const { socket, joinAuction, leaveAuction } = useSocket();

  const [listing, setListing] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [minNextBidPaise, setMinNextBidPaise] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Bidding form state
  const [bidAmountRupees, setBidAmountRupees] = useState('');
  const [biddingLoading, setBiddingLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');

  // AutoBid state
  const [showAutoBidModal, setShowAutoBidModal] = useState(false);
  const [autoBidCeilingRupees, setAutoBidCeilingRupees] = useState('');
  const [myAutoBid, setMyAutoBid] = useState(null);

  // Watchlist state
  const [isWatched, setIsWatched] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionFeedback, setQuestionFeedback] = useState(null);
  const [sellerAnswerText, setSellerAnswerText] = useState({});

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });

  useEffect(() => {
    loadAuctionDetails();
    joinAuction(id);

    return () => {
      leaveAuction(id);
    };
  }, [id]);

  useEffect(() => {
    if (!socket) return;

    const handleBidUpdate = (data) => {
      if (data.listingId?.toString() === id) {
        setListing((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentPricePaise: data.currentPricePaise,
            leadingBidderId: data.leadingBidderId,
            bidCount: data.bidCount,
            closingAt: data.closingAt,
            status: data.status,
          };
        });

        // Add to recent history
        if (data.lastBid) {
          setBidHistory((prev) => [
            {
              id: Date.now().toString(),
              amountPaise: data.lastBid.amountPaise,
              source: data.lastBid.source,
              createdAt: data.lastBid.createdAt,
              bidderName: data.leadingBidderId === mongoUser?.id ? 'You' : 'Campus Bidder',
            },
            ...prev,
          ]);
        }

        setMinNextBidPaise(data.currentPricePaise + (listing?.minBidIncrementPaise || 5000));
      }
    };

    const handleClosedUpdate = (data) => {
      if (data.listingId?.toString() === id) {
        setListing((prev) => (prev ? { ...prev, status: 'CLOSED' } : prev));
      }
    };

    socket.on('auction:bid', handleBidUpdate);
    socket.on('auction:closed', handleClosedUpdate);

    return () => {
      socket.off('auction:bid', handleBidUpdate);
      socket.off('auction:closed', handleClosedUpdate);
    };
  }, [socket, id, mongoUser?.id, listing?.minBidIncrementPaise]);

  // Live timer countdown
  useEffect(() => {
    if (!listing) return;

    function updateTimer() {
      const ms = new Date(listing.closingAt).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
        return;
      }
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      setTimeLeft({ days, hours, minutes, seconds, totalMs: ms });
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [listing?.closingAt]);

  async function loadAuctionDetails() {
    setLoading(true);
    try {
      const data = await api.getListing(id);
      setListing(data.listing);
      setBidHistory(data.bidHistory || []);
      setMinNextBidPaise(data.minNextBidPaise);
      setBidAmountRupees((data.minNextBidPaise / 100).toString());

      // Questions
      const qData = await api.getQuestions(id);
      setQuestions(qData || []);

      // If authenticated, check watchlist and myAutoBid
      if (isAuthenticated) {
        api.getWatchlist().then((items) => {
          setIsWatched(items.some((it) => it._id === id));
        }).catch(() => {});

        api.getMyAutoBid(id).then((ab) => {
          if (ab && ab.enabled) {
            setMyAutoBid(ab);
            setAutoBidCeilingRupees((ab.maxAmountPaise / 100).toString());
          } else {
            setMyAutoBid(null);
          }
        }).catch(() => setMyAutoBid(null));
      }
    } catch (err) {
      setError(err.message || 'Auction details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  const handleManualBidSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      return navigate('/login', { state: { from: { pathname: `/auctions/${id}` } } });
    }

    if (isHighestBidder) {
      return setBidError('You are already the highest bidder for this auction.');
    }

    setBidError('');
    setBidSuccess('');
    setBiddingLoading(true);

    const amountPaise = rupeesToPaise(bidAmountRupees);
    if (amountPaise < minNextBidPaise) {
      setBiddingLoading(false);
      return setBidError(`Bid must be at least ${formatPaiseToRupees(minNextBidPaise)}.`);
    }

    try {
      const res = await api.placeBid(id, amountPaise);
      setBidSuccess(`🎉 Bid of ${formatPaiseToRupees(amountPaise)} successfully accepted!`);
      const nextMin = res.listing.currentPricePaise + (listing.minBidIncrementPaise || 5000);
      setMinNextBidPaise(nextMin);
      setBidAmountRupees((nextMin / 100).toString());

      // Update listing in state immediately so isHighestBidder takes effect right away
      setListing((prev) => ({
        ...prev,
        ...res.listing,
        currentPricePaise: res.listing.currentPricePaise,
        leadingBidderId: res.listing.leadingBidderId || (mongoUser?.id || mongoUser?._id),
        bidCount: res.listing.bidCount,
        closingAt: res.listing.closingAt,
        status: res.listing.status,
      }));

      // Prepend the new bid to local history
      setBidHistory((prev) => [
        {
          id: res.acceptedBid?.id || Date.now().toString(),
          amountPaise: res.acceptedBid?.amountPaise || amountPaise,
          source: 'MANUAL',
          createdAt: res.acceptedBid?.createdAt || new Date().toISOString(),
          bidderName: 'You',
        },
        ...prev,
      ]);
    } catch (err) {
      setBidError(err.message || 'Failed to place bid.');
    } finally {
      setBiddingLoading(false);
    }
  };

  const handleSetAutoBid = async (e) => {
    e.preventDefault();
    setBidError('');
    const maxPaise = rupeesToPaise(autoBidCeilingRupees);
    if (maxPaise < minNextBidPaise) {
      return setBidError(`Proxy maximum must be at least ${formatPaiseToRupees(minNextBidPaise)}.`);
    }

    try {
      const res = await api.setAutoBid(id, maxPaise);
      setMyAutoBid(res.autobid);
      setShowAutoBidModal(false);
      setBidSuccess(`🛡️ Automatic proxy bidding configured up to ${formatPaiseToRupees(maxPaise)}!`);
      if (res.currentPricePaise) {
        setListing((prev) => ({
          ...prev,
          currentPricePaise: res.currentPricePaise,
          leadingBidderId: res.leadingBidderId,
        }));
      }
    } catch (err) {
      setBidError(err.message || 'Failed to configure AutoBid.');
    }
  };

  const handleDisableAutoBid = async () => {
    try {
      await api.disableAutoBid(id);
      setMyAutoBid(null);
      setAutoBidCeilingRupees('');
      setShowAutoBidModal(false);
      setBidSuccess('AutoBid proxy has been disabled for this listing.');
    } catch (err) {
      setBidError(err.message || 'Failed to disable AutoBid.');
    }
  };

  const handleToggleWatchlist = async () => {
    if (!isAuthenticated) return navigate('/login');
    try {
      const res = await api.toggleWatchlist(id);
      setIsWatched(res.isWatched);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;
    setQuestionLoading(true);
    setQuestionFeedback(null);
    try {
      const q = await api.askQuestion(id, newQuestionText.trim());
      setQuestions((prev) => [q, ...prev]);
      setNewQuestionText('');
      if (q.isAutoAnswered) {
        setQuestionFeedback({
          type: 'AUTO_ANSWER',
          message: '⚡ Instant Answer Found! The seller already answered this question previously on this auction.',
        });
      } else {
        setQuestionFeedback({
          type: 'OPEN',
          message: '✓ Question submitted! The seller has been notified.',
        });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setQuestionLoading(false);
    }
  };

  const handleAnswerQuestion = async (questionId) => {
    const text = sellerAnswerText[questionId];
    if (!text?.trim()) return;
    try {
      const updated = await api.answerQuestion(questionId, text.trim());
      setQuestions((prev) => prev.map((q) => (q._id === questionId ? updated : q)));
      setSellerAnswerText((prev) => ({ ...prev, [questionId]: '' }));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading auction details & live bidding engine...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{error || 'Auction not found'}</h2>
        <Link to="/marketplace" className="inline-block px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const currentUserId = mongoUser?.id?.toString() || mongoUser?._id?.toString();
  const sellerId =
    typeof listing.sellerId === 'object' && listing.sellerId !== null
      ? (listing.sellerId._id || listing.sellerId.id)?.toString()
      : listing.sellerId?.toString();
  const leadingBidderId =
    typeof listing.leadingBidderId === 'object' && listing.leadingBidderId !== null
      ? (listing.leadingBidderId._id || listing.leadingBidderId.id)?.toString()
      : listing.leadingBidderId?.toString();

  const isSeller = Boolean(currentUserId && sellerId && currentUserId === sellerId);
  const isLeader = Boolean(currentUserId && leadingBidderId && currentUserId === leadingBidderId);

  // Check if top bid in bidHistory was placed by the current user
  const topBid = bidHistory?.[0];
  const isTopBidder = Boolean(
    topBid && (
      topBid.bidderName === 'You' ||
      (currentUserId && (
        topBid.bidderId?._id?.toString() === currentUserId ||
        topBid.bidderId?.id?.toString() === currentUserId ||
        topBid.bidderId?.toString() === currentUserId
      ))
    )
  );

  const isHighestBidder = isLeader || isTopBidder;
  const isClosed = listing.status === 'CLOSED' || timeLeft.totalMs <= 0;
  const isExtended = listing.status === 'EXTENDED';

  const images = listing.images?.length > 0 ? listing.images : [{ secureUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80' }];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb & Status banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Link to="/marketplace" className="hover:text-brand-600">Marketplace</Link>
          <span>/</span>
          <span className="text-slate-800 font-bold uppercase">{listing.category}</span>
          <span>/</span>
          <span className="text-slate-400 truncate max-w-xs">{listing.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {myAutoBid && myAutoBid.enabled && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-800 shadow-sm animate-pulse">
              <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600" />
              <span>AutoBid Active: Up to {formatPaiseToRupees(myAutoBid.maxAmountPaise)}</span>
            </div>
          )}
          {isExtended && (
            <div className="badge-sniping text-xs px-3 py-1">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Anti-Sniping 60s Extension Activated!</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Gallery & Description (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Main Photo Card */}
          <div className="glass-panel p-2 rounded-3xl overflow-hidden border border-slate-200/90 shadow-lg">
            <div className="relative h-[340px] sm:h-[420px] rounded-2xl overflow-hidden bg-slate-100 flex items-center justify-center">
              <img
                src={images[selectedImageIndex]?.secureUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                <span className="badge-live shadow-md bg-white/95 backdrop-blur-md">
                  {listing.status}
                </span>
                {myAutoBid && myAutoBid.enabled && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-600 text-white shadow-md shadow-purple-500/20 backdrop-blur-md animate-pulse">
                    <Zap className="w-3.5 h-3.5 fill-white" />
                    <span>AutoBid Active: Up to {formatPaiseToRupees(myAutoBid.maxAmountPaise)}</span>
                  </span>
                )}
              </div>
              <div className="absolute top-4 right-4">
                <button
                  onClick={handleToggleWatchlist}
                  className={`p-2.5 rounded-full backdrop-blur-md transition shadow-md ${
                    isWatched ? 'bg-rose-500 text-white' : 'bg-slate-900/70 text-white hover:bg-rose-500'
                  }`}
                  title="Watchlist"
                >
                  <Heart className="w-4 h-4 fill-current" />
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-2.5 p-3 overflow-x-auto">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                      selectedImageIndex === idx ? 'border-brand-600 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img.secureUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description & Condition card */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">About this Item</h2>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                Condition: {listing.condition}
              </span>
              <span className="px-3 py-1 rounded-lg bg-brand-50 text-brand-700 font-bold uppercase">
                {listing.category}
              </span>
              <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Campus Handover
              </span>
              {listing.pickupPoint && (
                <span className="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Pickup: {listing.pickupPoint}
                </span>
              )}
            </div>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* Questions & Answers Component */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Questions & Answers</h3>
                <p className="text-xs text-slate-500">Ask the seller about dimensions, wear, or inspection</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {questions.length}
              </span>
            </div>

            {/* Feedback Alert */}
            {questionFeedback && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
                  questionFeedback.type === 'AUTO_ANSWER'
                    ? 'bg-purple-50 border border-purple-200 text-purple-900 shadow-sm'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {questionFeedback.type === 'AUTO_ANSWER' ? (
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{questionFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuestionFeedback(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Ask input */}
            {isAuthenticated ? (
              <form onSubmit={handleAskQuestion} className="flex gap-2">
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Ask a question about this item (e.g. brakes, frame size, notes)..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={questionLoading || !newQuestionText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm disabled:opacity-50"
                >
                  {questionLoading ? 'Checking...' : 'Ask'}
                </button>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                <span>Sign in to ask the seller a question.</span>
                <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">
                  Sign In
                </Link>
              </div>
            )}

            {/* Questions list */}
            <div className="space-y-4">
              {questions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No questions yet. Be the first to ask!</p>
              ) : (
                questions.map((q) => (
                  <div key={q._id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-800">Q: {q.questionText}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Asked by {q.authorId?.displayName || 'Fellow Student'}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {q.answerText ? (
                      <div
                        className={`p-3.5 rounded-xl text-xs mt-2 space-y-1.5 ${
                          q.isAutoAnswered
                            ? 'bg-purple-50/90 border border-purple-200/90 text-purple-950'
                            : 'bg-emerald-50/70 border border-emerald-100 text-emerald-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-[11px]">
                            {q.isAutoAnswered ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-extrabold text-[10px] uppercase tracking-wide">
                                <Sparkles className="w-3 h-3 text-purple-600" />
                                Answered previously by the seller
                              </span>
                            ) : (
                              <span className="text-emerald-800 font-bold">Seller Response:</span>
                            )}
                          </div>
                          {q.isAutoAnswered && (
                            <span className="text-[10px] text-purple-600/80 font-semibold">
                              Instant Auto-Match
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed font-medium">{q.answerText}</p>
                        {q.isAutoAnswered && (
                          <p className="text-[10px] text-purple-500 italic pt-0.5">
                            * Verbatim seller answer automatically surfaced from a prior question on this auction.
                          </p>
                        )}
                      </div>
                    ) : isSeller ? (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={sellerAnswerText[q._id] || ''}
                          onChange={(e) => setSellerAnswerText({ ...sellerAnswerText, [q._id]: e.target.value })}
                          placeholder="Write your answer..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <button
                          onClick={() => handleAnswerQuestion(q._id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                        >
                          Answer
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">Awaiting seller response...</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Bidding Engine & Live Timers (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Live Countdown Clock Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-brand-600" />
                {isClosed ? 'Auction Concluded' : 'Bidding Closes In'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Closes: {new Date(listing.closingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Big Countdown Digits */}
            {!isClosed ? (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 rounded-2xl bg-slate-900 text-white">
                  <span className="block text-2xl font-black">{timeLeft.days}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Days</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-900 text-white">
                  <span className="block text-2xl font-black">{timeLeft.hours}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Hours</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-900 text-white">
                  <span className="block text-2xl font-black">{timeLeft.minutes}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Mins</span>
                </div>
                <div className="p-3 rounded-2xl bg-brand-600 text-white animate-pulse">
                  <span className="block text-2xl font-black">{timeLeft.seconds}</span>
                  <span className="text-[10px] text-brand-200 font-bold uppercase">Secs</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-100 text-center font-bold text-sm text-slate-700">
                This auction is officially closed. Final outcome is recorded in sale lifecycle.
              </div>
            )}

            {/* Price section */}
            <div className="pt-4 border-t border-slate-100 flex items-end justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Current Winning Bid
                </span>
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {formatPaiseToRupees(listing.currentPricePaise)}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  Starting Price: {formatPaiseToRupees(listing.startingPricePaise)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Total Activity
                </span>
                <span className="text-base font-extrabold text-brand-600">
                  {listing.bidCount} {listing.bidCount === 1 ? 'Bid' : 'Bids'}
                </span>
              </div>
            </div>

            {/* Active AutoBid Banner */}
            {myAutoBid && myAutoBid.enabled && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-purple-50/80 to-indigo-50 border border-purple-200 text-purple-950 text-xs flex items-start justify-between gap-3 shadow-sm animate-in fade-in duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-purple-500/20">
                    <Zap className="w-4 h-4 fill-white animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-purple-950">
                        AutoBid Active for this Item
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-200 text-purple-900 uppercase tracking-wider">
                        Proxy Defending
                      </span>
                    </div>
                    <p className="text-purple-800 leading-relaxed text-xs">
                      Proxy automatic bidding is actively defending your lead up to{' '}
                      <strong className="text-purple-950 font-black">
                        {formatPaiseToRupees(myAutoBid.maxAmountPaise)}
                      </strong>
                      . It will automatically match competitor bids by the minimum increment.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAutoBidModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-purple-300 hover:bg-purple-100 text-purple-800 font-bold text-xs shadow-sm transition whitespace-nowrap shrink-0"
                >
                  Manage / Cancel
                </button>
              </div>
            )}

            {/* Highest Bidder status alert */}
            {isHighestBidder && (
              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs space-y-2.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-sm text-emerald-950">
                      {isClosed ? '🎉 Congratulations! You won this auction!' : 'You are currently the highest bidder!'}
                    </p>
                    <p className="text-emerald-800 mt-0.5 leading-relaxed">
                      {isClosed
                        ? `Your bid of ${formatPaiseToRupees(listing.currentPricePaise)} was the highest bid when the deadline ended. Coordinate your campus handover using the seller pickup point and contact phone number below.`
                        : `Your bid of ${formatPaiseToRupees(listing.currentPricePaise)} is currently the winning bid. The bid button is disabled to prevent you from outbidding yourself.`}
                    </p>
                  </div>
                </div>

                {isClosed && (listing.pickupPoint || listing.sellerPhone) && (
                  <div className="pt-2 border-t border-emerald-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {listing.pickupPoint && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-emerald-200">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Pickup Point</span>
                          <span className="font-bold text-slate-800">{listing.pickupPoint}</span>
                        </div>
                      </div>
                    )}
                    {listing.sellerPhone && (
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/80 border border-emerald-200">
                        <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Seller Phone</span>
                          <a href={`tel:${listing.sellerPhone}`} className="font-bold text-emerald-700 hover:underline">
                            {listing.sellerPhone}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bid Alert Messages */}
            {bidError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bidError}</span>
              </div>
            )}

            {bidSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bidSuccess}</span>
              </div>
            )}

            {/* Bidding Controls Form */}
            {!isClosed && !isSeller && (
              <form onSubmit={handleManualBidSubmit} className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                    <span>Your Bid Amount</span>
                    <span className="text-brand-600 font-semibold">
                      Min next bid: {formatPaiseToRupees(minNextBidPaise)}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-3 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="1"
                      required
                      disabled={isHighestBidder || biddingLoading}
                      value={bidAmountRupees}
                      onChange={(e) => setBidAmountRupees(e.target.value)}
                      className={`w-full pl-8 pr-4 py-2.5 rounded-xl border text-base font-black transition ${
                        isHighestBidder
                          ? 'bg-slate-100/80 border-slate-200 text-slate-400 cursor-not-allowed select-none'
                          : 'border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500'
                      }`}
                    />
                  </div>

                  {isHighestBidder && (
                    <p className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />
                      <span>You hold the highest bid on this item. Bidding is disabled to protect your lead.</span>
                    </p>
                  )}

                  {/* Quick increment buttons */}
                  <div className="flex gap-2 mt-2">
                    {[50, 100, 250].map((inc) => (
                      <button
                        type="button"
                        key={inc}
                        disabled={isHighestBidder}
                        onClick={() =>
                          setBidAmountRupees(((minNextBidPaise + inc * 100) / 100).toString())
                        }
                        className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +₹{inc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={biddingLoading || isHighestBidder}
                    className={
                      isHighestBidder
                        ? 'flex-1 py-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-800 font-extrabold text-sm shadow-sm cursor-not-allowed flex items-center justify-center gap-2 transition'
                        : 'flex-1 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2'
                    }
                  >
                    {isHighestBidder ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Highest Bidder (Winning)</span>
                      </>
                    ) : (
                      <>
                        <span>{biddingLoading ? 'Placing Bid...' : 'Place Bid Now'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAutoBidModal(true)}
                    className={`px-4 py-3.5 rounded-xl border font-bold text-xs transition flex items-center gap-1.5 shrink-0 ${
                      myAutoBid && myAutoBid.enabled
                        ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-sm hover:bg-purple-200 ring-2 ring-purple-400/40'
                        : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                    }`}
                    title="Automatic Proxy Bidding"
                  >
                    <Zap className={`w-3.5 h-3.5 ${myAutoBid && myAutoBid.enabled ? 'text-purple-700 fill-purple-700 animate-pulse' : 'text-brand-600'}`} />
                    <span>
                      {myAutoBid && myAutoBid.enabled
                        ? `AutoBid Active (₹${myAutoBid.maxAmountPaise / 100})`
                        : 'AutoBid'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {isSeller && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                You are the seller of this item. Sellers are protected from bidding on their own listings.
              </div>
            )}
          </div>

          {/* Seller Card */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seller Profile</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-black uppercase shadow-sm">
                {listing.sellerId?.displayName?.[0] || 'S'}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{listing.sellerId?.displayName || 'Campus Student'}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {listing.sellerId?.stats?.averageRating || '5.0'}
                  </span>
                  <span>•</span>
                  <span>{listing.sellerId?.stats?.completedSales || 0} completed campus sales</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Bid History Ledger */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Bid Ledger</h3>
              <span className="text-[11px] text-slate-400 font-semibold">{bidHistory.length} total</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {bidHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No bids placed yet. First bid starts at {formatPaiseToRupees(listing.startingPricePaise)}.</p>
              ) : (
                bidHistory.map((b, i) => (
                  <div
                    key={b.id || i}
                    className={`p-3 rounded-xl flex items-center justify-between text-xs transition ${
                      i === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50/70 border border-slate-100'
                    }`}
                  >
                    <div>
                      <span className="font-black text-slate-900 block text-sm">
                        {formatPaiseToRupees(b.amountPaise)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {b.bidderName || 'Campus Bidder'} • {new Date(b.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        b.source === 'AUTO' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {b.source}
                      </span>
                      {i === 0 && (
                        <span className="block text-[10px] font-bold text-emerald-600 mt-0.5">
                          Leading
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AutoBid Configuration Modal */}
      {showAutoBidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="max-w-md w-full glass-panel p-6 sm:p-8 rounded-3xl shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Automatic Proxy Bidding</h3>
              </div>
              <button
                onClick={() => setShowAutoBidModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Set your private maximum ceiling. The system will automatically place minimum incremental bids to keep you in the lead, but will <strong>never exceed</strong> your ceiling.
            </p>

            {myAutoBid && myAutoBid.enabled && (
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600 animate-pulse" />
                    Currently Active AutoBid:
                  </span>
                  <span className="font-black text-sm text-purple-950">
                    {formatPaiseToRupees(myAutoBid.maxAmountPaise)}
                  </span>
                </div>
                <p className="text-[11px] text-purple-700 leading-relaxed">
                  Your proxy auto-bidder will defend your lead up to this ceiling. You can update your ceiling below, or cancel it anytime.
                </p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Your maximum ceiling is 100% private and never visible to other bidders or the seller.</span>
            </div>

            <form onSubmit={handleSetAutoBid} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {myAutoBid && myAutoBid.enabled ? 'New Private Maximum Ceiling (₹)' : 'Private Maximum Ceiling (₹)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    required
                    value={autoBidCeilingRupees}
                    onChange={(e) => setAutoBidCeilingRupees(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAutoBidModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                >
                  Close
                </button>
                {myAutoBid && myAutoBid.enabled && (
                  <button
                    type="button"
                    onClick={handleDisableAutoBid}
                    className="px-3 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition whitespace-nowrap"
                  >
                    Disable AutoBid
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition"
                >
                  {myAutoBid && myAutoBid.enabled ? 'Update Ceiling' : 'Enable Proxy AutoBid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
