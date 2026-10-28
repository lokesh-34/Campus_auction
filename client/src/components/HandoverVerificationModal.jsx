import React, { useState, useRef, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  MapPin,
  Lock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatPaiseToRupees } from '../utils/formatCurrency.js';

export function HandoverVerificationModal({ sale, initialOtp = '', onClose, onSuccess }) {
  const [digits, setDigits] = useState(() => {
    if (initialOtp && initialOtp.length === 6) {
      return initialOtp.split('');
    }
    return ['', '', '', '', '', ''];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (initialOtp && initialOtp.length === 6) {
      setDigits(initialOtp.split(''));
    }
  }, [initialOtp]);

  useEffect(() => {
    // Focus first input box on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleDigitChange = (index, value) => {
    // Handle paste of whole 6-digit code
    if (value.length > 1) {
      const clean = value.replace(/\D/g, '').slice(0, 6);
      if (clean.length > 0) {
        const nextDigits = [...digits];
        for (let i = 0; i < 6; i++) {
          nextDigits[i] = clean[i] || '';
        }
        setDigits(nextDigits);
        const focusIdx = Math.min(clean.length, 5);
        if (inputRefs.current[focusIdx]) {
          inputRefs.current[focusIdx].focus();
        }
        return;
      }
    }

    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    setDigits(nextDigits);
    setError('');

    // Auto-advance to next input
    if (digit && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const otp = digits.join('').trim();
    if (otp.length !== 6) {
      return setError('Please enter all 6 digits of the handover code.');
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.verifyHandoverOtp(sale._id, otp);
      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.data || sale);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Verification failed. Please double-check the OTP.');
    } finally {
      setLoading(false);
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Verify Physical Handover
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Ask the buyer to show their CampusBid screen and enter the 6-digit OTP to atomically confirm the transaction.
          </p>
        </div>

        {/* Item Summary Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
          <div className="truncate pr-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Item</span>
            <strong className="text-slate-900 dark:text-white font-extrabold truncate block">
              {sale.listingId?.title || 'Campus Auction Item'}
            </strong>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Final Price</span>
            <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
              {formatPaiseToRupees(sale.finalPricePaise)}
            </strong>
          </div>
        </div>

        {success ? (
          <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
            <h3 className="font-black text-emerald-900 dark:text-emerald-200 text-sm">
              Handover Verified!
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Transaction completed & +10 Karma points earned!</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 6-Digit PIN Inputs */}
            <div>
              <label className="block text-center text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                Buyer's 6-Digit Handover OTP
              </label>
              <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={idx === 0 ? 6 : 1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={loading}
                    className="w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-black rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-200 focus:outline-none transition shadow-sm"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                type="submit"
                disabled={!isComplete || loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying OTP...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Confirm Possession & Complete (+10 Karma)</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-400">
                Entering this OTP legally and atomically transfers item possession and concludes the auction.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
