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
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const SUGGESTIONS = [
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

  const handleProposeBid = async (listing) => {
    setProposalError('');
    setProposalSuccess('');
    try {
      const prop = await api.proposeAiBid({
        listingId: listing.id,
        actionType: 'MANUAL_BID',
        proposedAmountRupees: listing.minNextBidPaise / 100,
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
      await api.placeBid(proposalModal.listingId, proposalModal.proposedAmountPaise);
      setProposalSuccess(`🎉 Bid of ₹${proposalModal.proposedAmountRupees} officially placed on "${proposalModal.title}"!`);
      setProposalModal(null);
    } catch (err) {
      setProposalError(err.message || 'Failed to submit bid.');
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

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/auctions/${item.id}`}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          Details
                        </Link>

                        {isAuthenticated && (
                          <button
                            onClick={() => handleProposeBid(item)}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm"
                          >
                            Propose Bid
                          </button>
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

      {/* Confirmation Gated Bid Modal */}
      {proposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="max-w-md w-full glass-panel p-6 sm:p-8 rounded-3xl shadow-2xl border border-purple-200 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Gavel className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Explicit User Confirmation Required</h3>
              </div>
              <button
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
                The AI assistant <strong>cannot</strong> place bids automatically without your explicit consent. Please review and confirm the proposed bid amount below.
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
                <span>Your Proposed Bid:</span>
                <span>₹{proposalModal.proposedAmountRupees}</span>
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
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
              >
                {proposalLoading ? 'Submitting...' : 'Confirm & Place Bid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
