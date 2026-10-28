import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Timer,
  Gavel,
  Bike,
  BookOpen,
  Laptop,
  Calculator,
  Compass,
  Armchair,
  Layers,
  Heart,
  ArrowUpDown,
  RefreshCw,
  ZoomIn,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ImagePreviewModal } from '../components/ImagePreviewModal.jsx';

const CATEGORIES = [
  { id: '', label: 'All Items', icon: Layers },
  { id: 'CYCLES', label: 'Cycles', icon: Bike },
  { id: 'TEXTBOOKS', label: 'Textbooks', icon: BookOpen },
  { id: 'ELECTRONICS', label: 'Electronics', icon: Laptop },
  { id: 'CALCULATORS', label: 'Calculators', icon: Calculator },
  { id: 'LAB_EQUIPMENT', label: 'Lab Equipment', icon: Compass },
  { id: 'FURNITURE', label: 'Dorm Furniture', icon: Armchair },
];

function CountdownBadge({ closingAt, status }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function calculate() {
      if (status === 'CLOSED' || status === 'CANCELLED') {
        setTimeLeft(status);
        return;
      }
      const ms = new Date(closingAt).getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft('Closed');
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
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
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
    <span className="badge-live shadow-sm bg-white/95 backdrop-blur-md">
      <Timer className="w-3 h-3 text-emerald-600" />
      <span>{timeLeft}</span>
    </span>
  );
}

export function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, mongoUser } = useAuth();

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filters state initialized from URL search params
  const category = searchParams.get('category') || '';
  const search = searchParams.get('q') || '';
  const condition = searchParams.get('condition') || '';
  const sortBy = searchParams.get('sortBy') || 'closingSoon';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState(search);
  const [watchlistIds, setWatchlistIds] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);

  useEffect(() => {
    fetchListings();
  }, [category, search, condition, sortBy, page, mongoUser]);

  useEffect(() => {
    if (isAuthenticated) {
      api.getWatchlist()
        .then((items) => setWatchlistIds(items.map((it) => it._id)))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  async function fetchListings() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getListings({
        category: category || undefined,
        q: search || undefined,
        condition: condition || undefined,
        sortBy,
        page,
        limit: 12,
        excludeOwn: true,
      });
      setListings(res.listings || []);
      setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Failed to load campus auctions.');
    } finally {
      setLoading(false);
    }
  }

  // Never list seller's own products for buying
  const displayListings = mongoUser
    ? listings.filter((item) => {
        const sellerId = item.sellerId?._id || item.sellerId;
        const currentUserId = mongoUser._id || mongoUser.id;
        return sellerId?.toString() !== currentUserId?.toString();
      })
    : listings;

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(next);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParam('q', searchInput.trim());
  };

  const handleToggleWatchlist = async (e, listingId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) return;
    try {
      const res = await api.toggleWatchlist(listingId);
      if (res.isWatched) {
        setWatchlistIds((prev) => [...prev, listingId]);
      } else {
        setWatchlistIds((prev) => prev.filter((id) => id !== listingId));
      }
    } catch (err) {
      console.error('Watchlist toggle error:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Campus Marketplace</h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse {pagination.total} live peer auctions ending across campus hostels and departments
          </p>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
          <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-2 border border-slate-300/80 shadow-sm">
            <Search className="w-4 h-4 text-slate-400 ml-2.5" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search cycles, books, Casio, monitors..."
              className="w-full bg-transparent border-0 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none py-1.5"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  updateParam('q', '');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs px-2"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => updateParam('category', cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-brand-500/20'
                  : 'glass-panel text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="glass-panel p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
            <Filter className="w-3.5 h-3.5 text-brand-600" />
            <span>Filters:</span>
          </div>

          {/* Condition selector */}
          <select
            value={condition}
            onChange={(e) => updateParam('condition', e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Conditions</option>
            <option value="NEW">Brand New</option>
            <option value="LIKE_NEW">Like New</option>
            <option value="GOOD">Good Condition</option>
            <option value="FAIR">Fair Condition</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500 font-medium text-xs">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => updateParam('sortBy', e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="closingSoon">Closing Soonest</option>
            <option value="priceAsc">Price: Low to High</option>
            <option value="priceDesc">Price: High to Low</option>
            <option value="newest">Newly Listed</option>
          </select>
        </div>
      </div>

      {/* Main Grid State */}
      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-500">Loading live campus auctions...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center glass-panel rounded-3xl space-y-3">
          <p className="text-rose-600 text-sm font-bold">{error}</p>
          <button
            onClick={fetchListings}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-sm"
          >
            Try Again
          </button>
        </div>
      ) : displayListings.length === 0 ? (
        <div className="p-16 text-center glass-panel rounded-3xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No active auctions match your search</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or clearing your category filters to discover more items.
          </p>
          <button
            onClick={() => {
              setSearchInput('');
              setSearchParams({});
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayListings.map((item) => {
            const isWatched = watchlistIds.includes(item._id);
            const mainImage =
              item.images?.[0]?.secureUrl ||
              'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80';

            return (
              <Link
                key={item._id}
                to={`/auctions/${item._id}`}
                className="group glass-panel rounded-2xl overflow-hidden border border-slate-200/90 hover:border-brand-300 hover:shadow-xl transition-all duration-300 flex flex-col"
              >
                {/* Image & Overlay badges */}
                <div className="relative h-48 overflow-hidden bg-slate-100">
                  <img
                    src={mainImage}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <CountdownBadge closingAt={item.closingAt} status={item.status} />
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {isAuthenticated && (
                      <button
                        onClick={(e) => handleToggleWatchlist(e, item._id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                          isWatched ? 'bg-rose-500 text-white' : 'bg-slate-900/60 text-white hover:bg-rose-500'
                        }`}
                        title={isWatched ? 'In Watchlist' : 'Add to Watchlist'}
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md uppercase">
                      {item.condition}
                    </span>
                  </div>

                  {/* Hover Quick Preview Pill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewItem(item);
                    }}
                    className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-xl bg-slate-900/85 hover:bg-brand-600 text-white text-[11px] font-bold backdrop-blur-md transition opacity-0 group-hover:opacity-100 shadow-md flex items-center gap-1"
                    title="Click to preview photos"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-brand-600 tracking-wider uppercase">
                      {item.category}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-brand-600 transition-colors mt-0.5">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                      By {item.sellerId?.displayName || 'Campus Senior'}
                    </p>
                  </div>

                  {/* Price & Bids bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                        Current Price ({item.bidCount} {item.bidCount === 1 ? 'bid' : 'bids'})
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        {formatPaiseToRupees(item.currentPricePaise)}
                      </span>
                    </div>

                    <span className="px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      Place Bid
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pt-6 border-t border-slate-200/80 flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => updateParam('page', p.toString())}
              className={`w-9 h-9 rounded-xl font-bold text-xs transition ${
                page === p
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                  : 'glass-panel text-slate-700 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewItem && (
        <ImagePreviewModal
          isOpen={Boolean(previewItem)}
          images={previewItem.images || []}
          title={previewItem.title}
          condition={previewItem.condition}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
}
