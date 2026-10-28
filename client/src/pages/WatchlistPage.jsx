import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2, ArrowRight, Timer, Gavel } from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';

export function WatchlistPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  async function loadWatchlist() {
    setLoading(true);
    try {
      const data = await api.getWatchlist();
      setWatchlist(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleRemove = async (listingId) => {
    try {
      await api.toggleWatchlist(listingId);
      setWatchlist((prev) => prev.filter((it) => it._id !== listingId));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading your watchlist...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold uppercase mb-2">
          <Heart className="w-3.5 h-3.5 fill-current" />
          <span>Saved Auctions</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Your Watchlist</h1>
        <p className="text-xs text-slate-500 mt-1">
          Keep track of bidding activity, closing countdowns, and price updates on your saved campus items.
        </p>
      </div>

      {watchlist.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Your watchlist is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click the heart icon on any auction card to bookmark it and receive notifications before closing.
          </p>
          <Link
            to="/marketplace"
            className="inline-block px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs shadow-sm hover:bg-brand-700 transition"
          >
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {watchlist.map((item) => (
            <div
              key={item._id}
              className="glass-panel rounded-2xl overflow-hidden border border-slate-200/90 hover:shadow-lg transition flex flex-col justify-between"
            >
              <div className="relative h-44 bg-slate-100 overflow-hidden">
                <img
                  src={item.images?.[0]?.secureUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemove(item._id)}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-slate-900/70 text-white hover:bg-rose-600 transition"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-brand-600 uppercase">{item.category}</span>
                  <h4 className="font-bold text-slate-900 text-sm line-clamp-1 mt-0.5">{item.title}</h4>
                  <p className="text-[11px] text-slate-400">By {item.sellerId?.displayName || 'Campus Senior'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Current Price</span>
                    <span className="text-base font-black text-slate-900">
                      {formatPaiseToRupees(item.currentPricePaise)}
                    </span>
                  </div>

                  <Link
                    to={`/auctions/${item._id}`}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                  >
                    View Bid
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
