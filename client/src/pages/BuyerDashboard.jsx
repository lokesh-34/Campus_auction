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
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';

export function BuyerDashboard() {
  const [sales, setSales] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBuyerData();
  }, []);

  async function loadBuyerData() {
    setLoading(true);
    try {
      const [salesData, watchData] = await Promise.all([
        api.getMySales('buyer'),
        api.getWatchlist(),
      ]);
      setSales(salesData || []);
      setWatchlist(watchData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleConfirmHandover = async (saleId) => {
    setActionLoading(true);
    setMsg('');
    try {
      await api.confirmHandover(saleId);
      setMsg('You confirmed the handover! Once the seller also confirms, the purchase is officially complete.');
      await loadBuyerData();
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase mb-2">
          <PackageCheck className="w-3.5 h-3.5" />
          <span>Buyer Center</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Buyer Dashboard</h1>
        <p className="text-xs text-slate-500 mt-1">
          Track won auctions, arrange campus handovers, and manage watched listings.
        </p>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Won Auctions & Campus Handover */}
      {wonReserved.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-emerald-400 shadow-xl space-y-4 bg-emerald-50/20">
          <div className="flex items-center gap-2">
            <Handshake className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Items Ready for Campus Handover ({wonReserved.length})</h2>
          </div>
          <p className="text-xs text-slate-600">
            The seller has approved your winning bid! Meet the seller on campus to inspect the item, then click confirm below to finalize.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {wonReserved.map((sale) => {
              const buyerConfirmed = Boolean(sale.handoverConfirmedBuyerAt);
              return (
                <div key={sale._id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{sale.listingId?.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Sold by: {sale.sellerId?.displayName}</p>
                    </div>
                    <span className="text-lg font-black text-slate-900">
                      {formatPaiseToRupees(sale.finalPricePaise)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1">
                    <p>Pickup Deadline: <span className="font-bold text-slate-800">{new Date(sale.reservationExpiresAt).toLocaleString()}</span></p>
                    <p>Your Status: <span className={buyerConfirmed ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{buyerConfirmed ? 'Confirmed ✓' : 'Inspection Pending'}</span></p>
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

      {/* Awaiting Seller Approval */}
      {wonPending.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900">Auctions Won (Awaiting Seller Approval)</h3>
          </div>
          <div className="space-y-2">
            {wonPending.map((sale) => (
              <div key={sale._id} className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{sale.listingId?.title}</p>
                  <p className="text-slate-400 text-[11px]">Seller: {sale.sellerId?.displayName}</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-slate-900 text-sm block">{formatPaiseToRupees(sale.finalPricePaise)}</span>
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Pending Approval</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist Quick View */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-current" />
            <h2 className="text-lg font-bold text-slate-900">Your Watchlist ({watchlist.length})</h2>
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
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-brand-300 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <span className="text-[10px] font-bold text-brand-600 uppercase">{item.category}</span>
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-1 mt-0.5">{item.title}</h4>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current Bid</span>
                    <span className="font-black text-slate-900">{formatPaiseToRupees(item.currentPricePaise)}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 font-bold text-[11px]">
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
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Completed Purchases ({completedPurchases.length})</h3>
          <div className="space-y-2">
            {completedPurchases.map((s) => (
              <div key={s._id} className="p-3 rounded-xl bg-white border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{s.listingId?.title}</p>
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
