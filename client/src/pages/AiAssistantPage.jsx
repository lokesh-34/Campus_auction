import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Search,
  ArrowRight,
  Gavel,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  Bot,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const SUGGESTIONS = [
  'Find me a bicycle under ₹4,000 and auto bid it till 5000',
  'Find me a bicycle under ₹4,000',
  'Show scientific calculators for engineering exams',
  'Find textbook with lecture notes',
  'Hostel study chair or desk',
];

export function AiAssistantPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');

  // Confirmation gated proposal state
  const [proposalModal, setProposalModal] = useState(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalSuccess, setProposalSuccess] = useState('');
  const [proposalError, setProposalError] = useState('');

  const { isAuthenticated } = useAuth();

  const handleSearch = async (queryString) => {
    const q = queryString || query;
    if (!q.trim()) return;

    setLoading(true);
    setError('');
    setProposalSuccess('');

    try {
      const data = await api.queryAi(q.trim());
      setResponse(data);
    } catch (err) {
      setError(err.message || 'AI assistant service temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const handleProposeAction = async (listing, actionType = 'MANUAL_BID', customAmount = null) => {
    setProposalError('');
    setProposalSuccess('');
    try {
      const proposedAmountRupees = customAmount || (listing.minNextBidPaise / 100);
      const prop = await api.proposeAiBid({
        listingId: listing.id,
        actionType,
        proposedAmountRupees,
      });
      setProposalModal(prop);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirmAction = async () => {
    if (!proposalModal) return;
    setProposalLoading(true);
    setProposalError('');

    try {
      if (proposalModal.actionType === 'AUTO_BID') {
        await api.setAutoBid(proposalModal.listingId, proposalModal.proposedAmountPaise);
        setProposalSuccess(`⚡ Proxy AutoBid up to ₹${proposalModal.proposedAmountRupees} officially activated on "${proposalModal.title}"!`);
      } else {
        await api.placeBid(proposalModal.listingId, proposalModal.proposedAmountPaise);
        setProposalSuccess(`🎉 Bid of ₹${proposalModal.proposedAmountRupees} officially placed on "${proposalModal.title}"!`);
      }
      setProposalModal(null);
    } catch (err) {
      setProposalError(err.message || 'Failed to submit action.');
    } finally {
      setProposalLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold uppercase shadow-sm">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Powered by Google Gemini 1.5 Flash</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          CampusBid AI Assistant
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
          Natural-language campus search, factual listing comparison, and confirmation-gated bidding actions backed by authoritative MongoDB records.
        </p>
      </div>

      {/* Query Bar */}
      <div className="glass-panel p-2.5 rounded-3xl shadow-xl border border-purple-200/80 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex items-center gap-2"
        >
          <Search className="w-5 h-5 text-purple-400 ml-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Find me a bicycle under ₹4,000 for commuting..."
            className="w-full bg-transparent border-0 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none py-2"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 shrink-0 flex items-center gap-2"
          >
            <span>{loading ? 'Thinking...' : 'Ask AI'}</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </form>

        {/* Suggestion Pills */}
        <div className="flex items-center gap-2 overflow-x-auto px-2 py-1 scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Try:
          </span>
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setQuery(s);
                handleSearch(s);
              }}
              className="px-3 py-1 rounded-xl bg-purple-50/80 hover:bg-purple-100 text-purple-700 text-[11px] font-semibold whitespace-nowrap transition border border-purple-100"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Proposal Success Feedback */}
      {proposalSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{proposalSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* AI Results */}
      {response && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Explanation Card */}
          <div className="glass-panel p-6 rounded-3xl border border-purple-200/90 shadow-md space-y-2 bg-gradient-to-br from-purple-50/40 to-white">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>Gemini Factual Response</span>
            </div>
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line font-medium">
              {response.explanation}
            </p>
          </div>

          {/* AI Action Proposal Card if action intent detected */}
          {response.suggestedAction && (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-white shadow-xl border border-purple-400/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs font-bold uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                  <span>Action Proposal Ready</span>
                </div>
                <span className="text-xs text-purple-300/80 font-medium">Confirmation-Gated</span>
              </div>

              <div>
                <h3 className="text-lg font-black text-white">
                  {response.suggestedAction.actionType === 'AUTO_BID'
                    ? `AutoBid Proposal: Up to ₹${response.suggestedAction.proposedAmountRupees}`
                    : `Bid Proposal: ₹${response.suggestedAction.proposedAmountRupees}`}
                </h3>
                <p className="text-xs text-purple-200 mt-1">
                  Target Listing: <strong className="text-white">{response.suggestedAction.title}</strong>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 text-xs">
                <div>
                  <span className="text-[10px] text-purple-200/70 block uppercase font-bold">Current Price</span>
                  <span className="text-sm font-extrabold text-white">₹{response.suggestedAction.currentPriceRupees}</span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-200/70 block uppercase font-bold">Next Minimum Bid</span>
                  <span className="text-sm font-extrabold text-white">₹{response.suggestedAction.minRequiredRupees}</span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-amber-300 block uppercase font-bold">
                    {response.suggestedAction.actionType === 'AUTO_BID' ? 'AutoBid Ceiling' : 'Proposed Bid'}
                  </span>
                  <span className="text-sm font-black text-amber-300">₹{response.suggestedAction.proposedAmountRupees}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-purple-200/80">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Requires explicit confirmation to ensure account safety</span>
                </div>

                <button
                  type="button"
                  onClick={() => setProposalModal(response.suggestedAction)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>
                    {response.suggestedAction.actionType === 'AUTO_BID'
                      ? `Review & Confirm AutoBid (₹${response.suggestedAction.proposedAmountRupees})`
                      : `Review & Confirm Bid (₹${response.suggestedAction.proposedAmountRupees})`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Matched Listings */}
          {response.listings?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider px-1">
                Authoritative Matching Auctions ({response.listings.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {response.listings.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl glass-panel border border-slate-200 hover:border-purple-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-purple-700 uppercase mb-1">
                        <span>{item.category}</span>
                        <span className="text-slate-500 font-semibold">{item.condition}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Seller: {item.seller}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Current Bid</span>
                        <span className="text-lg font-black text-slate-900">
                          {formatPaiseToRupees(item.currentPricePaise)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <Link
                          to={`/auctions/${item.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          Details
                        </Link>

                        {isAuthenticated && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleProposeAction(item, 'MANUAL_BID')}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm"
                            >
                              Bid
                            </button>
                            <button
                              type="button"
                              onClick={() => handleProposeAction(item, 'AUTO_BID', (item.minNextBidPaise / 100) + 500)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm flex items-center gap-1"
                            >
                              <Zap className="w-3 h-3 fill-slate-950" />
                              <span>AutoBid</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Gated Action Modal */}
      {proposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="max-w-md w-full glass-panel p-6 sm:p-8 rounded-3xl shadow-2xl border border-purple-200 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  proposalModal.actionType === 'AUTO_BID'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {proposalModal.actionType === 'AUTO_BID' ? (
                    <Zap className="w-4 h-4 fill-amber-700" />
                  ) : (
                    <Gavel className="w-4 h-4" />
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {proposalModal.actionType === 'AUTO_BID'
                    ? 'Confirm Proxy AutoBid Ceiling'
                    : 'Confirm Manual Auction Bid'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProposalModal(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>AI Safety Guardrail</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {proposalModal.actionType === 'AUTO_BID'
                  ? 'Our bidding engine will automatically place incremental bids on your behalf whenever someone else bids, up to your maximum ceiling. We will never exceed this ceiling.'
                  : 'The AI assistant cannot place bids without your explicit consent. A single authoritative bid will be submitted directly to MongoDB.'}
              </p>
            </div>

            {proposalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {proposalError}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-900 text-sm truncate">{proposalModal.title}</p>
              <div className="flex justify-between text-slate-600">
                <span>Current Price:</span>
                <span className="font-bold">₹{proposalModal.currentPriceRupees}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Required Next Minimum:</span>
                <span className="font-bold">₹{proposalModal.minRequiredRupees}</span>
              </div>
              <div className="flex justify-between text-purple-700 font-extrabold text-sm pt-2 border-t border-slate-200">
                <span>
                  {proposalModal.actionType === 'AUTO_BID' ? 'AutoBid Maximum Ceiling:' : 'Your Proposed Bid:'}
                </span>
                <span className="text-base text-purple-800">₹{proposalModal.proposedAmountRupees}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProposalModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={proposalLoading || !proposalModal.isEligible}
                onClick={handleConfirmAction}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  proposalModal.actionType === 'AUTO_BID'
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {proposalModal.actionType === 'AUTO_BID' ? (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-slate-950" />
                    <span>{proposalLoading ? 'Activating...' : 'Confirm & Activate AutoBid'}</span>
                  </>
                ) : (
                  <>
                    <Gavel className="w-3.5 h-3.5" />
                    <span>{proposalLoading ? 'Submitting...' : 'Confirm & Place Bid'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
