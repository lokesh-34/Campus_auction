import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  Clock,
  Handshake,
  AlertCircle,
  Package,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';

export function SellerDashboard() {
  const [activeListings, setActiveListings] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [listingsData, salesData] = await Promise.all([
        api.getMyListings(),
        api.getMySales('seller'),
      ]);
      setActiveListings(listingsData || []);
      setSales(salesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (saleId) => {
    setActionLoading(true);
    setMsg('');
    try {
      await api.approveSale(saleId);
      setMsg('Winning bid approved! The item is now reserved for campus handover.');
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (saleId) => {
    if (!confirm('Are you sure you want to decline this final price?')) return;
    setActionLoading(true);
    try {
      await api.rejectSale(saleId);
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmHandover = async (saleId) => {
    setActionLoading(true);
    try {
      await api.confirmHandover(saleId);
      setMsg('You confirmed the handover! Once the buyer confirms, the transaction is complete.');
      await loadData();
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
        <p className="text-xs font-semibold text-slate-500">Loading seller dashboard...</p>
      </div>
    );
  }

  const pendingApprovals = sales.filter((s) => s.outcome === 'PENDING_SELLER_APPROVAL');
  const reservedSales = sales.filter((s) => s.outcome === 'RESERVED');
  const completedSales = sales.filter((s) => s.outcome === 'SOLD');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase mb-2">
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Seller Management</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Seller Dashboard</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review closing outcomes, approve winning prices, and coordinate in-person campus handovers.
        </p>
      </div>

      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Action Required: Pending Approval */}
      {pendingApprovals.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-amber-300 shadow-xl space-y-4 bg-amber-50/20">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
            <h2 className="text-lg font-bold text-slate-900">Action Required: Approve Winning Bids</h2>
          </div>
          <p className="text-xs text-slate-600">
            These auctions have concluded with winning student bids. Please approve or decline the final price to arrange pickup.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {pendingApprovals.map((sale) => (
              <div key={sale._id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{sale.listingId?.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Winner: {sale.winnerId?.displayName}</p>
                  </div>
                  <span className="text-lg font-black text-emerald-600 whitespace-nowrap">
                    {formatPaiseToRupees(sale.finalPricePaise)}
                  </span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleReject(sale._id)}
                    className="flex-1 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
                  >
                    Decline
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleApprove(sale._id)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
                  >
                    Approve Price
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reserved Handovers */}
      {reservedSales.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-md space-y-4">
          <div className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-900">Active Campus Handovers (Reserved)</h2>
          </div>
          <p className="text-xs text-slate-600">
            Arrange a meetup spot on campus (hostel common room, library, or canteen) with the buyer. Confirm once the item is inspected and handed over.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {reservedSales.map((sale) => {
              const sellerConfirmed = Boolean(sale.handoverConfirmedSellerAt);
              return (
                <div key={sale._id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{sale.listingId?.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Buyer: {sale.winnerId?.displayName}</p>
                    </div>
                    <span className="text-lg font-black text-slate-900">
                      {formatPaiseToRupees(sale.finalPricePaise)}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1">
                    <p>Status: <span className="font-bold text-brand-700">Reserved for Buyer</span></p>
                    <p>Seller Confirmation: <span className={sellerConfirmed ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>{sellerConfirmed ? 'Confirmed ✓' : 'Pending'}</span></p>
                  </div>

                  {!sellerConfirmed ? (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleConfirmHandover(sale._id)}
                      className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
                    >
                      Confirm In-Person Handover
                    </button>
                  ) : (
                    <p className="text-center text-xs text-emerald-600 font-bold py-1">
                      Awaiting buyer confirmation to finalize...
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Listings Grid */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-slate-900">Your Active Auctions ({activeListings.length})</h2>
          </div>
          <Link to="/create-listing" className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700">
            + Sell Another
          </Link>
        </div>

        {activeListings.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 italic">You have no active listings right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {activeListings.map((item) => (
              <div key={item._id} className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-1">
                    <span>{item.category}</span>
                    <span className="text-emerald-600 font-bold">{item.status}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title}</h3>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current Price</span>
                    <span className="text-base font-black text-slate-900">{formatPaiseToRupees(item.currentPricePaise)}</span>
                  </div>
                  <Link
                    to={`/auctions/${item._id}`}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Sales */}
      {completedSales.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-200/90 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Completed Sales History ({completedSales.length})</h3>
          <div className="space-y-2">
            {completedSales.map((s) => (
              <div key={s._id} className="p-3 rounded-xl bg-white border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{s.listingId?.title}</p>
                  <p className="text-[11px] text-slate-400">Sold to {s.winnerId?.displayName}</p>
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
