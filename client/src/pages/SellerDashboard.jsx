import React, { useState, useEffect, useMemo } from 'react';
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
  IndianRupee,
  PackageCheck,
  Zap,
  BarChart3,
  Award,
  Star,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Eye,
  Plus,
  Sparkles,
  Edit3,
  X,
  MapPin,
  Phone,
  Trash2,
  KeyRound,
  GraduationCap,
  QrCode,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { StudentReputationBadge } from '../components/StudentReputationBadge.jsx';
import { HandoverVerificationModal } from '../components/HandoverVerificationModal.jsx';

export function SellerDashboard() {
  const { mongoUser, refreshUser } = useAuth();
  const [allListings, setAllListings] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'active' | 'handovers' | 'completed'

  // Handover OTP / QR Verification Modal State
  const [verifyingSale, setVerifyingSale] = useState(null);
  const [initialOtp, setInitialOtp] = useState('');

  // Academic Profile Edit Modal State
  const [academicModalOpen, setAcademicModalOpen] = useState(false);
  const [academicForm, setAcademicForm] = useState({
    department: '',
    year: '',
    pickupPoint: '',
    phoneNumber: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit Starting Price Modal State
  const [editingListing, setEditingListing] = useState(null);
  const [editPriceRupees, setEditPriceRupees] = useState('');
  const [editIncrementRupees, setEditIncrementRupees] = useState('');
  const [editPickupPoint, setEditPickupPoint] = useState('');
  const [editSellerPhone, setEditSellerPhone] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Cancel Auction Modal State
  const [cancellingListing, setCancellingListing] = useState(null);
  const [cancelReason, setCancelReason] = useState('Listing error / incorrect specifications or pricing');
  const [cancelLoading, setCancelLoading] = useState(false);

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
      setAllListings(listingsData || []);
      setSales(salesData || []);

      // Check if arriving from buyer's dynamic QR code scan
      const searchParams = new URLSearchParams(window.location.search);
      const verifySaleId = searchParams.get('verifySale');
      const otpCode = searchParams.get('otp');
      if (verifySaleId && salesData) {
        const targetSale = salesData.find(
          (s) => s._id === verifySaleId && s.outcome === 'RESERVED'
        );
        if (targetSale) {
          setVerifyingSale(targetSale);
          if (otpCode) setInitialOtp(otpCode);
          setMsg('📲 Scanned Buyer QR Code! Review the details below and enter/confirm the handover code.');
        }
      }
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

  const handleOpenAcademicModal = () => {
    setAcademicForm({
      department: mongoUser?.department || 'Computer Science & Engineering',
      year: mongoUser?.year || '3rd Year',
      pickupPoint: mongoUser?.pickupPoint || 'Central Library Ground Floor',
      phoneNumber: mongoUser?.phoneNumber || '',
    });
    setAcademicModalOpen(true);
  };

  const handleSaveAcademicProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateProfile(academicForm);
      if (refreshUser) await refreshUser();
      setMsg('Student verification details updated successfully!');
      setAcademicModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to update student profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenEditModal = (item) => {
    setEditingListing(item);
    setEditPriceRupees(((item.startingPricePaise || item.currentPricePaise || 100) / 100).toString());
    setEditIncrementRupees(((item.minBidIncrementPaise || 5000) / 100).toString());
    setEditPickupPoint(item.pickupPoint || '');
    setEditSellerPhone(item.sellerPhone || '');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingListing) return;
    setEditLoading(true);
    try {
      const pricePaise = Math.round(Number(editPriceRupees) * 100);
      const incPaise = Math.round(Number(editIncrementRupees) * 100);
      if (isNaN(pricePaise) || pricePaise < 100) {
        alert('Starting price must be at least ₹1');
        return;
      }
      await api.updateListing(editingListing._id, {
        startingPricePaise: pricePaise,
        minBidIncrementPaise: incPaise,
        pickupPoint: editPickupPoint,
        sellerPhone: editSellerPhone,
      });
      setMsg(`Starting price for "${editingListing.title}" successfully updated to ₹${editPriceRupees}!`);
      setEditingListing(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update listing price');
    } finally {
      setEditLoading(false);
    }
  };

  const handleOpenCancelModal = (item) => {
    setCancellingListing(item);
    setCancelReason('Listing error / incorrect specifications or pricing');
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancellingListing) return;
    setCancelLoading(true);
    try {
      await api.cancelListing(cancellingListing._id, cancelReason);
      setMsg(`Auction for "${cancellingListing.title}" has been cancelled.`);
      setCancellingListing(null);
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to cancel auction');
    } finally {
      setCancelLoading(false);
    }
  };

  // Comprehensive analytics calculations
  const stats = useMemo(() => {
    const pendingApprovals = sales.filter((s) => s.outcome === 'PENDING_SELLER_APPROVAL');
    const reservedSales = sales.filter((s) => s.outcome === 'RESERVED');
    const completedSales = sales.filter((s) => s.outcome === 'SOLD');
    const cancelledSales = sales.filter((s) =>
      ['SELLER_CANCELLED', 'FAILED_PICKUP'].includes(s.outcome)
    );

    const activeAuctions = allListings.filter((l) =>
      ['ACTIVE', 'EXTENDED'].includes(l.status)
    );
    const closedAuctions = allListings.filter((l) => l.status === 'CLOSED');

    // 1. Total Realized Revenue (Rupees from completed sales)
    const realizedRevenuePaise = completedSales.reduce(
      (acc, s) => acc + (s.finalPricePaise || 0),
      0
    );

    // 2. Pending Inflow (Reserved handovers + pending approvals)
    const pendingRevenuePaise = reservedSales
      .concat(pendingApprovals)
      .reduce((acc, s) => acc + (s.finalPricePaise || 0), 0);

    // 3. Active Market Bid Volume
    const activeBidVolumePaise = activeAuctions.reduce(
      (acc, l) => acc + (l.currentPricePaise || 0),
      0
    );

    // 4. Total Items Sold
    const totalItemsSold = completedSales.length;

    // 5. Average Sale Price
    const averageSalePricePaise =
      totalItemsSold > 0 ? Math.round(realizedRevenuePaise / totalItemsSold) : 0;

    // 6. Value Surge: Profit created by auction competition above starting prices
    const valueSurgePaise = completedSales.reduce((acc, s) => {
      const starting = s.listingId?.startingPricePaise || 0;
      const finalPrice = s.finalPricePaise || 0;
      return acc + Math.max(0, finalPrice - starting);
    }, 0);

    // 7. Total Bids Attracted Across All Listings
    const totalBidsReceived = allListings.reduce((acc, l) => acc + (l.bidCount || 0), 0);

    // 8. Sell-Through Success Rate (%)
    const totalClosed = closedAuctions.length;
    const sellThroughRate =
      totalClosed > 0
        ? Math.min(100, Math.round((totalItemsSold / totalClosed) * 100))
        : allListings.length > 0
        ? 100
        : 0;

    // 9. Category Revenue Breakdown
    const categoryBreakdown = {};
    completedSales.forEach((s) => {
      const cat = s.listingId?.category || 'OTHER';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { count: 0, revenuePaise: 0 };
      }
      categoryBreakdown[cat].count += 1;
      categoryBreakdown[cat].revenuePaise += s.finalPricePaise || 0;
    });

    const categoryList = Object.entries(categoryBreakdown).map(([cat, data]) => ({
      category: cat,
      count: data.count,
      revenuePaise: data.revenuePaise,
      percentage: realizedRevenuePaise > 0
        ? Math.round((data.revenuePaise / realizedRevenuePaise) * 100)
        : 0,
    })).sort((a, b) => b.revenuePaise - a.revenuePaise);

    return {
      pendingApprovals,
      reservedSales,
      completedSales,
      cancelledSales,
      activeAuctions,
      closedAuctions,
      realizedRevenuePaise,
      pendingRevenuePaise,
      activeBidVolumePaise,
      totalItemsSold,
      averageSalePricePaise,
      valueSurgePaise,
      totalBidsReceived,
      sellThroughRate,
      categoryList,
    };
  }, [allListings, sales]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading seller analytics...</p>
      </div>
    );
  }

  const actionRequiredCount = stats.pendingApprovals.length + stats.reservedSales.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold uppercase mb-2 shadow-sm">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Seller Command & Telemetry Center</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Seller Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
            Real-time income telemetry, sales conversion rates, campus handover tracking, and auction lifecycle management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/create-listing"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Item</span>
          </Link>

          {/* Seller Reputation Pill & Academic Profile */}
          <div className="flex items-center gap-3 p-2 pr-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white font-black flex items-center justify-center text-sm shadow">
              {mongoUser?.displayName?.[0]?.toUpperCase() || 'S'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-slate-900 dark:text-slate-100 leading-none">
                  {mongoUser?.displayName || 'Campus Student'}
                </span>
                <StudentReputationBadge user={mongoUser} compact />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{mongoUser?.department || 'Engineering'} • {mongoUser?.year || '3rd Year'}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleOpenAcademicModal}
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Action Message Feedback */}
      {msg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{msg}</span>
          </div>
          <button onClick={() => setMsg('')} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 4 PRIMARY EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Realized Income */}
        <div className="glass-panel p-5 rounded-3xl border border-emerald-200/90 shadow-md bg-gradient-to-br from-emerald-50/50 via-white to-white space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Realized Income
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 tracking-tight block">
              {formatPaiseToRupees(stats.realizedRevenuePaise)}
            </span>
            <p className="text-[11px] text-emerald-700 font-bold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{stats.totalItemsSold} completed {stats.totalItemsSold === 1 ? 'sale' : 'sales'} finalized</span>
            </p>
          </div>
        </div>

        {/* Card 2: Total Items Sold & Success Rate */}
        <div className="glass-panel p-5 rounded-3xl border border-blue-200/90 shadow-md bg-gradient-to-br from-blue-50/50 via-white to-white space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Items Sold
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-sm">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {stats.totalItemsSold}
              </span>
              <span className="text-xs font-bold text-slate-400">items</span>
            </div>
            <p className="text-[11px] text-blue-700 font-bold mt-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>{stats.sellThroughRate}% sell-through success rate</span>
            </p>
          </div>
        </div>

        {/* Card 3: Pending Inflow (Reserved / Awaiting Handover) */}
        <div className="glass-panel p-5 rounded-3xl border border-amber-200/90 shadow-md bg-gradient-to-br from-amber-50/50 via-white to-white space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pending Inflow (In Handover)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 tracking-tight block">
              {formatPaiseToRupees(stats.pendingRevenuePaise)}
            </span>
            <p className="text-[11px] text-amber-700 font-bold mt-1 flex items-center gap-1">
              <Handshake className="w-3.5 h-3.5" />
              <span>{actionRequiredCount} item(s) pending approval or meetup</span>
            </p>
          </div>
        </div>

        {/* Card 4: Active Market Pipeline */}
        <div className="glass-panel p-5 rounded-3xl border border-purple-200/90 shadow-md bg-gradient-to-br from-purple-50/50 via-white to-white space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Live Auction Pipeline
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 tracking-tight block">
              {formatPaiseToRupees(stats.activeBidVolumePaise)}
            </span>
            <p className="text-[11px] text-purple-700 font-bold mt-1 flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{stats.activeAuctions.length} live item(s) • {stats.totalBidsReceived} total bids</span>
            </p>
          </div>
        </div>
      </div>

      {/* SECONDARY VALUE STRIP: SURGE PROFIT & AVERAGE PRICE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Average Winning Price
            </span>
            <span className="text-lg font-black text-slate-800">
              {stats.averageSalePricePaise > 0 ? formatPaiseToRupees(stats.averageSalePricePaise) : '₹0'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Per completed item</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Auction Value Surge (Profit)
            </span>
            <span className="text-lg font-black text-emerald-600">
              +{formatPaiseToRupees(stats.valueSurgePaise)}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">
            Above Starting Price
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Auction Listings
            </span>
            <span className="text-lg font-black text-slate-800">
              {allListings.length} Listed
            </span>
          </div>
          <span className="text-[11px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md">
            {stats.activeAuctions.length} Live Now
          </span>
        </div>
      </div>

      {/* CATEGORY REVENUE BREAKDOWN (If seller has completed sales) */}
      {stats.categoryList.length > 0 && (
        <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-sm">Realized Income by Campus Category</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Based on {stats.totalItemsSold} sold listing(s)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            {stats.categoryList.map((item) => (
              <div key={item.category} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>{item.category}</span>
                  <span className="text-emerald-700">{formatPaiseToRupees(item.revenuePaise)}</span>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, item.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                  <span>{item.count} item(s) sold</span>
                  <span>{item.percentage}% of revenue</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>All Sections</span>
        </button>

        <button
          onClick={() => setActiveTab('action')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'action'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Action Required ({actionRequiredCount})</span>
          {actionRequiredCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'active'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Active Auctions ({stats.activeAuctions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PackageCheck className="w-3.5 h-3.5" />
          <span>Completed Sales ({stats.completedSales.length})</span>
        </button>
      </div>

      {/* SECTION 1: Action Required (Pending Approvals) */}
      {(activeTab === 'overview' || activeTab === 'action') && stats.pendingApprovals.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-amber-300 dark:border-amber-800 shadow-xl space-y-4 bg-amber-50/20 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Action Required: Approve Winning Auction Prices ({stats.pendingApprovals.length})
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            These campus auctions have closed with winning bids. Please confirm whether you accept the final price so the buyer can inspect and pick up the item.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {stats.pendingApprovals.map((sale) => (
              <div key={sale._id} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] uppercase tracking-wide">
                      Awaiting Your Approval
                    </span>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-1.5">{sale.listingId?.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Winner: <strong className="text-slate-700 dark:text-slate-300">{sale.winnerId?.displayName || 'Campus Student'}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Winning Price</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatPaiseToRupees(sale.finalPricePaise)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleReject(sale._id)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    Decline Price
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleApprove(sale._id)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : 'Approve & Reserve'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Reserved Handovers (Active Pickup Coordination & Dynamic OTP Verification) */}
      {(activeTab === 'overview' || activeTab === 'action') && stats.reservedSales.length > 0 && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Handshake className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Active Campus Handovers ({stats.reservedSales.length} Reserved)
              </h2>
            </div>
            <span className="text-[11px] font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/60 px-3 py-1 rounded-full border border-brand-200 dark:border-brand-800 self-start sm:self-auto flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Protected by Dynamic OTP & Karma Scoring</span>
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Meet the winning student at the agreed public campus spot. Inspect the item together, collect payment, then enter the 6-digit handover code shown on their phone screen (or scan their dynamic QR code) to atomically complete the transaction.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {stats.reservedSales.map((sale) => (
              <div
                key={sale._id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 hover:border-brand-300 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {sale.listingId?.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-slate-600 dark:text-slate-400">Buyer:</span>
                      <strong className="text-xs text-slate-800 dark:text-slate-200">
                        {sale.winnerId?.displayName || 'Campus Student'}
                      </strong>
                      <StudentReputationBadge user={sale.winnerId} compact />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Agreed Price</span>
                    <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                      {formatPaiseToRupees(sale.finalPricePaise)}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-[11px] text-slate-600 dark:text-slate-300 space-y-2 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Campus Pickup Spot:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>{sale.listingId?.pickupPoint || 'Central Campus Library / Common Room'}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-500">Security Protocol:</span>
                    <span className="font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Dynamic 6-Digit Buyer OTP</span>
                    </span>
                  </div>
                  {sale.winnerId?.phoneNumber && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Buyer Phone:</span>
                      <a
                        href={`tel:${sale.winnerId.phoneNumber}`}
                        className="font-bold text-brand-600 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{sale.winnerId.phoneNumber}</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setVerifyingSale(sale);
                      setInitialOtp('');
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Verify In-Person Handover (Enter OTP / Scan)</span>
                  </button>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-1">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>+10 Karma upon verification</span>
                    </span>
                    <span>Zero accidental clicks</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Active Listings Grid */}
      {(activeTab === 'overview' || activeTab === 'active') && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Your Live Auctions ({stats.activeAuctions.length})
              </h2>
            </div>
            <Link
              to="/create-listing"
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>List Another Item</span>
            </Link>
          </div>

          {stats.activeAuctions.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <p className="text-xs text-slate-500 font-medium">You currently have no active listings running.</p>
              <Link to="/create-listing" className="inline-block text-xs font-bold text-brand-600 hover:text-brand-700">
                + Create your first campus auction now
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {stats.activeAuctions.map((item) => (
                <div
                  key={item._id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 hover:border-brand-300 dark:hover:border-brand-700 transition shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                        {item.category}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {item.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">{item.title}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {item.bidCount} {item.bidCount === 1 ? 'bid' : 'bids'} received
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">
                          {item.bidCount > 0 ? 'Current High Bid' : 'Starting Price'}
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                          {formatPaiseToRupees(item.currentPricePaise)}
                        </span>
                      </div>
                      <Link
                        to={`/auctions/${item._id}`}
                        className="px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center gap-1"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {item.bidCount === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1"
                          title="Edit starting price before bidding starts"
                        >
                          <Edit3 className="w-3 h-3 text-slate-500" />
                          <span>Edit Price</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 py-1 flex-1">
                          Price locked (bids active)
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenCancelModal(item)}
                        className="py-1.5 px-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center justify-center gap-1"
                        title="Cancel this auction if a mistake was made"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: Completed Sales History Ledger */}
      {(activeTab === 'overview' || activeTab === 'completed') && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Completed Sales Ledger ({stats.completedSales.length})
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Total Realized: {formatPaiseToRupees(stats.realizedRevenuePaise)}
            </span>
          </div>

          {stats.completedSales.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 italic text-center">
              No completed sales yet. As campus handovers finish, transaction details will be logged here.
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.completedSales.map((s) => (
                <div
                  key={s._id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-emerald-300 dark:hover:border-emerald-700 transition"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                        {s.listingId?.title || 'Campus Auction'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        HANDOVER COMPLETE
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Purchased by <strong className="text-slate-700 dark:text-slate-300">{s.winnerId?.displayName || 'Fellow Student'}</strong> • {new Date(s.updatedAt || s.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Final Settled Price</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                        {formatPaiseToRupees(s.finalPricePaise)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Starting Price Modal (Available before bids start) */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Edit Starting Price
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              No bids have been placed on <strong className="text-slate-800 dark:text-slate-200">{editingListing.title}</strong> yet. You can adjust the starting price, increment, and campus pickup details.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Starting Price (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={editPriceRupees}
                    onChange={(e) => setEditPriceRupees(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Minimum Bid Increment (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={editIncrementRupees}
                    onChange={(e) => setEditIncrementRupees(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Campus Pickup Point
                </label>
                <input
                  type="text"
                  value={editPickupPoint}
                  onChange={(e) => setEditPickupPoint(e.target.value)}
                  placeholder="e.g. Central Library / Hostel 4 Common Room"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Seller Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={editSellerPhone}
                  onChange={(e) => setEditSellerPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Auction Modal */}
      {cancellingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-4 h-4" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Cancel Auction
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancellingListing(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to cancel the auction for <strong className="text-slate-800 dark:text-slate-200">{cancellingListing.title}</strong>?
              {cancellingListing.bidCount > 0 && ' Active bidders will be notified that this auction has been closed.'}
            </p>

            <form onSubmit={handleConfirmCancel} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows="2"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Made mistake in listing details, item damaged, or incorrect price set"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancellingListing(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover Dynamic OTP / QR Verification Modal */}
      {verifyingSale && (
        <HandoverVerificationModal
          sale={verifyingSale}
          initialOtp={initialOtp}
          onClose={() => {
            setVerifyingSale(null);
            setInitialOtp('');
          }}
          onSuccess={() => {
            setVerifyingSale(null);
            setInitialOtp('');
            setMsg('🎉 Handover confirmed! Item marked as SOLD and +10 Karma points added to your student profile.');
            loadData();
          }}
        />
      )}

      {/* Campus Academic Profile & Verification Modal */}
      {academicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-panel w-full max-w-md p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-brand-600">
                <GraduationCap className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Campus Student Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAcademicModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Your academic department, year, and pickup location build trust with peer buyers and sellers on campus.
            </p>

            <form onSubmit={handleSaveAcademicProfile} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department / Academic Branch
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science & Engineering"
                  value={academicForm.department}
                  onChange={(e) => setAcademicForm({ ...academicForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Year
                </label>
                <select
                  value={academicForm.year}
                  onChange={(e) => setAcademicForm({ ...academicForm, year: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="1st Year">1st Year (Freshman)</option>
                  <option value="2nd Year">2nd Year (Sophomore)</option>
                  <option value="3rd Year">3rd Year (Junior)</option>
                  <option value="4th Year">4th Year (Senior / Final Year)</option>
                  <option value="Postgraduate / PhD">Postgraduate / PhD / Researcher</option>
                  <option value="Faculty / Staff">Faculty / Campus Staff</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Default Campus Handover Spot
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central Library Ground Floor, Hostel 4 Lobby"
                  value={academicForm.pickupPoint}
                  onChange={(e) => setAcademicForm({ ...academicForm, pickupPoint: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number (Visible only to confirmed buyer/seller)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={academicForm.phoneNumber}
                  onChange={(e) => setAcademicForm({ ...academicForm, phoneNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAcademicModalOpen(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
