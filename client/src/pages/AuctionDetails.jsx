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
        });

        api.getMyAutoBid(id).then((ab) => {
          if (ab) setMyAutoBid(ab);
        });
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
      setMinNextBidPaise(res.listing.currentPricePaise + (listing.minBidIncrementPaise || 5000));
      setBidAmountRupees(((res.listing.currentPricePaise + (listing.minBidIncrementPaise || 5000)) / 100).toString());
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
    } catch (err) {
      setBidError(err.message || 'Failed to configure AutoBid.');
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
    try {
      const q = await api.askQuestion(id, newQuestionText.trim());
      setQuestions((prev) => [q, ...prev]);
      setNewQuestionText('');
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

  const isSeller = mongoUser && listing.sellerId?._id?.toString() === mongoUser.id?.toString();
  const isLeader = mongoUser && listing.leadingBidderId?.toString() === mongoUser.id?.toString();
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

        {isExtended && (
          <div className="badge-sniping text-xs px-3 py-1">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>Anti-Sniping 60s Extension Activated!</span>
          </div>
        )}
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
              <div className="absolute top-4 left-4">
                <span className="badge-live shadow-md bg-white/95 backdrop-blur-md">
                  {listing.status}
                </span>
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

            {/* Ask input */}
            {isAuthenticated ? (
              <form onSubmit={handleAskQuestion} className="flex gap-2">
                <input
                  type="text"
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Ask a question about this item..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={questionLoading || !newQuestionText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm disabled:opacity-50"
                >
                  Ask
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
                      <p className="font-bold text-slate-800">Q: {q.questionText}</p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {q.answerText ? (
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-emerald-900 mt-2">
                        <p className="font-semibold text-[11px] text-emerald-800 mb-0.5">Seller Response:</p>
                        <p className="text-xs">{q.answerText}</p>
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

            {/* Leader status alert */}
            {isLeader && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>You are currently the leading bidder on this auction!</span>
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
                      value={bidAmountRupees}
                      onChange={(e) => setBidAmountRupees(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Quick increment buttons */}
                  <div className="flex gap-2 mt-2">
                    {[50, 100, 250].map((inc) => (
                      <button
                        type="button"
                        key={inc}
                        onClick={() =>
                          setBidAmountRupees(((minNextBidPaise + inc * 100) / 100).toString())
                        }
                        className="flex-1 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                      >
                        +₹{inc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={biddingLoading}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{biddingLoading ? 'Placing Bid...' : 'Place Bid Now'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAutoBidModal(true)}
                    className="px-4 py-3.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition flex items-center gap-1.5 shrink-0"
                    title="Automatic Proxy Bidding"
                  >
                    <Lock className="w-3.5 h-3.5 text-brand-600" />
                    <span>AutoBid</span>
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

            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Your maximum ceiling is 100% private and never visible to other bidders or the seller.</span>
            </div>

            <form onSubmit={handleSetAutoBid} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Private Maximum Ceiling (₹)
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
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md"
                >
                  Enable Proxy AutoBid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
