import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PackageCheck,
  Trophy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Handshake,
  Heart,
  MapPin,
  Phone,
  Gavel,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Zap,
  Timer,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useSocket } from '../contexts/SocketContext.jsx';

function ActiveBidCountdown({ closingAt, status }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function calculate() {
      if (status === 'CLOSED' || status === 'CANCELLED') {
        setTimeLeft(status);
        setIsUrgent(false);
        return;
      }
      const ms = new Date(closingAt).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft('Closing...');
        setIsUrgent(false);
        return;
      }
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));

      if (ms < 1000 * 60 * 2) {
        setIsUrgent(true);
        setTimeLeft(`${minutes * 60 + seconds}s left!`);
      } else if (days > 0) {
        setIsUrgent(false);
        setTimeLeft(`${days}d ${hours}h left`);
      } else if (hours > 0) {
        setIsUrgent(false);
        setTimeLeft(`${hours}h ${minutes}m left`);
      } else {
        setIsUrgent(false);
        setTimeLeft(`${minutes}m ${seconds}s left`);
      }
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [closingAt, status]);

  if (isUrgent) {
    return (
      <span className="badge-sniping shadow-sm">
        <Timer className="w-3.5 h-3.5 text-amber-600 animate-spin" />
        <span>{timeLeft}</span>
      </span>
    );
  }

  return (
    <span className="badge-live shadow-sm bg-white/95 dark:bg-slate-900/90 backdrop-blur-md">
      <Timer className="w-3 h-3 text-emerald-600" />
      <span>{timeLeft}</span>
    </span>
  );
}

export function BuyerDashboard() {
  const { mongoUser } = useAuth();
  const { socket, joinAuction, leaveAuction } = useSocket();

  const [sales, setSales] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [activeBids, setActiveBids] = useState([]);
  const [bidFilter, setBidFilter] = useState('ALL'); // 'ALL' | 'LEADING' | 'OUTBID'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBuyerData();
  }, []);

  // Join live socket rooms for active bid auctions to receive immediate price & leader updates
  useEffect(() => {
    if (!socket || !activeBids.length) return;

    activeBids.forEach((bid) => {
      joinAuction(bid._id);
    });

    return () => {
      activeBids.forEach((bid) => {
        leaveAuction(bid._id);
      });
    };
  }, [socket, activeBids.map((b) => b._id).join(',')]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleBidUpdate = (data) => {
      setActiveBids((prev) =>
        prev.map((item) => {
          if (item._id === data.listingId || item.listingId === data.listingId) {
            const currentUserId = mongoUser?.id || mongoUser?._id;
            const isLeading = Boolean(
              currentUserId && data.leadingBidderId?.toString() === currentUserId.toString()
            );
            return {
              ...item,
              currentPricePaise: data.currentPricePaise,
              bidCount: data.bidCount,
              closingAt: data.closingAt,
              status: data.status,
              isLeading,
              bidStatus: isLeading ? 'LEADING' : 'OUTBID',
              minNextBidPaise: data.currentPricePaise + (item.minBidIncrementPaise || 5000),
            };
          }
          return item;
        })
      );
    };

    const handleClosedUpdate = (data) => {
      // When an auction closes, refresh to move it to won or completed
      loadBuyerData(false);
    };

    const handleNotification = (notif) => {
      if (notif.type === 'OUTBID' || notif.type === 'AUCTION_WON') {
        loadBuyerData(false);
      }
    };

    socket.on('auction:bid', handleBidUpdate);
    socket.on('auction:closed', handleClosedUpdate);
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('auction:bid', handleBidUpdate);
      socket.off('auction:closed', handleClosedUpdate);
      socket.off('notification:new', handleNotification);
    };
  }, [socket, mongoUser]);

  async function loadBuyerData(showLoading = true) {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const [salesData, watchData, activeBidsData] = await Promise.all([
        api.getMySales('buyer'),
        api.getWatchlist(),
        api.getMyActiveBids(),
      ]);
      setSales(salesData || []);
      setWatchlist(watchData || []);
      setActiveBids(activeBidsData || []);
    } catch (err) {
      console.error('Failed to load buyer data:', err);
    } finally {
      if (showLoading) setLoading(false);
      setRefreshing(false);
    }
  }

  const handleConfirmHandover = async (saleId) => {
    setActionLoading(true);
    setMsg('');
    try {
      await api.confirmHandover(saleId);
      setMsg('You confirmed the handover! Once the seller also confirms, the purchase is officially complete.');
      await loadBuyerData(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading buyer dashboard...</p>
      </div>
    );
  }

  const wonPending = sales.filter((s) => s.outcome === 'PENDING_SELLER_APPROVAL');
  const wonReserved = sales.filter((s) => s.outcome === 'RESERVED');
  const completedPurchases = sales.filter((s) => s.outcome === 'SOLD');

  const leadingBidsCount = activeBids.filter((b) => b.isLeading).length;
  const outbidCount = activeBids.filter((b) => !b.isLeading).length;

  const filteredActiveBids = activeBids.filter((item) => {
    if (bidFilter === 'LEADING') return item.isLeading;
    if (bidFilter === 'OUTBID') return !item.isLeading;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-bold uppercase mb-2">
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Buyer Center</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Buyer Dashboard</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track active bids in real-time, arrange campus handovers, and manage watched listings.
          </p>
        </div>

        <button
          onClick={() => loadBuyerData(false)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Quick Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Bids</span>
            <Gavel className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{activeBids.length}</p>
        </div>

        <div className="glass-panel p-4 rounded-3xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Leading</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-1">{leadingBidsCount}</p>
        </div>

        <div className="glass-panel p-4 rounded-3xl border border-rose-200/80 dark:border-rose-800/40 bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Outbid</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-1">{outbidCount}</p>
        </div>

        <div className="glass-panel p-4 rounded-3xl border border-brand-200/80 dark:border-brand-800/40 bg-brand-50/20">
          <div className="flex items-center justify-between text-brand-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Won / Bought</span>
            <Trophy className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-brand-600 mt-1">
            {wonReserved.length + wonPending.length + completedPurchases.length}
          </p>
        </div>
      </div>

      {/* Campus Handover Section (Action Required) */}
      {wonReserved.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-emerald-400 dark:border-emerald-600 shadow-xl space-y-4 bg-emerald-50/20">
          <div className="flex items-center gap-2">
            <Handshake className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Items Ready for Campus Handover ({wonReserved.length})
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            The seller has approved your winning bid! Meet the seller on campus to inspect the item, then click confirm below to finalize.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {wonReserved.map((sale) => {
              const buyerConfirmed = Boolean(sale.handoverConfirmedBuyerAt);
              return (
                <div key={sale._id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{sale.listingId?.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Sold by: {sale.sellerId?.displayName}</p>
                    </div>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {formatPaiseToRupees(sale.finalPricePaise)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      Pickup Deadline:{' '}
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {new Date(sale.reservationExpiresAt).toLocaleString()}
                      </span>
                    </p>
                    <p>
                      Your Status:{' '}
                      <span className={buyerConfirmed ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                        {buyerConfirmed ? 'Confirmed ✓' : 'Inspection Pending'}
                      </span>
                    </p>
                    {sale.pickupPoint && (
                      <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span>Pickup Point: <strong className="text-slate-900 dark:text-white">{sale.pickupPoint}</strong></span>
                      </p>
                    )}
                    {sale.sellerPhone && (
                      <p className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Seller Phone:{' '}
                          <a href={`tel:${sale.sellerPhone}`} className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                            {sale.sellerPhone}
                          </a>
                        </span>
                      </p>
                    )}
                  </div>

                  {!buyerConfirmed ? (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleConfirmHandover(sale._id)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                    >
                      Confirm In-Person Handover
                    </button>
                  ) : (
                    <p className="text-center text-xs text-emerald-600 font-bold py-1">
                      Confirmed! Awaiting seller confirmation...
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACTIVE BIDS SECTION */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Active Bids ({activeBids.length})</h2>
                {outbidCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
                    {outbidCount} Outbid
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ongoing auctions where you have placed bids. Live prices and status update in real-time.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          {activeBids.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto text-xs font-bold">
              <button
                onClick={() => setBidFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl transition ${
                  bidFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                All ({activeBids.length})
              </button>
              <button
                onClick={() => setBidFilter('LEADING')}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  bidFilter === 'LEADING'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Winning ({leadingBidsCount})</span>
              </button>
              <button
                onClick={() => setBidFilter('OUTBID')}
                className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                  bidFilter === 'OUTBID'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-rose-500" />
                <span>Outbid ({outbidCount})</span>
              </button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {activeBids.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shadow-sm">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">No Active Bids</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                You are not currently bidding on any active auctions. Explore textbooks, cycles, and electronics in the marketplace.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition shadow-sm"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Browse Live Auctions</span>
              </Link>
            </div>
          </div>
        ) : filteredActiveBids.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-2xl">
            No bids matching the selected filter ({bidFilter.toLowerCase()}).
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredActiveBids.map((item) => (
              <div
                key={item._id}
                className={`p-5 rounded-3xl border transition-all duration-200 bg-white dark:bg-slate-900 flex flex-col justify-between gap-4 ${
                  item.isLeading
                    ? 'border-emerald-300 dark:border-emerald-800/60 shadow-sm hover:shadow-md'
                    : 'border-rose-300 dark:border-rose-800/60 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Header: Category, Countdown, and Status Badge */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {item.category}
                    </span>
                    <ActiveBidCountdown closingAt={item.closingAt} status={item.status} />
                  </div>

                  {item.isLeading ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Winning</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Outbid</span>
                    </span>
                  )}
                </div>

                {/* Content: Thumbnail, Title, Seller */}
                <div className="flex gap-3.5">
                  {item.images?.[0]?.secureUrl ? (
                    <img
                      src={item.images[0].secureUrl}
                      alt={item.title}
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-400">
                      <Gavel className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/auctions/${item._id}`}
                      className="font-bold text-slate-900 dark:text-white text-sm hover:text-brand-600 dark:hover:text-brand-400 transition line-clamp-2"
                    >
                      {item.title}
                    </Link>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      Seller: {item.seller?.displayName || 'Campus Student'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-slate-500">
                        {item.bidCount} {item.bidCount === 1 ? 'bid' : 'bids'} total
                      </span>
                      {item.hasAutoBid && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 bg-brand-50 dark:bg-brand-950/50 dark:text-brand-300 px-2 py-0.5 rounded-md">
                          <Zap className="w-3 h-3 text-brand-600" />
                          AutoBid: up to {formatPaiseToRupees(item.autoBidMaxPaise)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price Breakdown Banner */}
                <div
                  className={`p-3 rounded-2xl text-xs flex items-center justify-between ${
                    item.isLeading
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30'
                      : 'bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Your Highest Bid</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                      {formatPaiseToRupees(item.myHighestBidPaise)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Current High Bid</span>
                    <span
                      className={`font-black text-sm ${
                        item.isLeading
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {formatPaiseToRupees(item.currentPricePaise)}
                    </span>
                  </div>
                </div>

                {/* Footer Action Button */}
                <div>
                  {item.isLeading ? (
                    <Link
                      to={`/auctions/${item._id}`}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <span>View Auction</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <Link
                      to={`/auctions/${item._id}`}
                      className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Outbid! Raise Bid (Min: {formatPaiseToRupees(item.minNextBidPaise)})</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Awaiting Seller Approval */}
      {wonPending.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Auctions Won (Awaiting Seller Approval)</h3>
          </div>
          <div className="space-y-2">
            {wonPending.map((sale) => (
              <div
                key={sale._id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{sale.listingId?.title}</p>
                  <p className="text-slate-400 text-[11px]">Seller: {sale.sellerId?.displayName}</p>
                  {(sale.pickupPoint || sale.sellerPhone) && (
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap">
                      {sale.pickupPoint && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-brand-600" />
                          <span>{sale.pickupPoint}</span>
                        </span>
                      )}
                      {sale.sellerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <a href={`tel:${sale.sellerPhone}`} className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline">
                            {sale.sellerPhone}
                          </a>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900 dark:text-white text-sm block">
                    {formatPaiseToRupees(sale.finalPricePaise)}
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Pending Approval</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist Quick View */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-current" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your Watchlist ({watchlist.length})</h2>
          </div>
          <Link to="/marketplace" className="text-xs font-bold text-brand-600 hover:text-brand-700">
            Browse More Auctions
          </Link>
        </div>

        {watchlist.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 italic">You have no saved auctions in your watchlist.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((item) => (
              <Link
                key={item._id}
                to={`/auctions/${item._id}`}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <span className="text-[10px] font-bold text-brand-600 uppercase">{item.category}</span>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 mt-0.5">{item.title}</h4>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current Bid</span>
                    <span className="font-black text-slate-900 dark:text-white">{formatPaiseToRupees(item.currentPricePaise)}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-bold text-[11px]">
                    View Bid
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Completed Purchases */}
      {completedPurchases.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Completed Purchases ({completedPurchases.length})
          </h3>
          <div className="space-y-2">
            {completedPurchases.map((s) => (
              <div
                key={s._id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">{s.listingId?.title}</p>
                  <p className="text-[11px] text-slate-400">Purchased from {s.sellerId?.displayName}</p>
                </div>
                <span className="font-black text-emerald-600 text-sm">{formatPaiseToRupees(s.finalPricePaise)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
