import React from 'react';
import {
  ShieldCheck,
  Award,
  Sparkles,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export function getTrustTierInfo(tier = 'VERIFIED_STUDENT') {
  switch (tier) {
    case 'ELITE_SELLER':
      return {
        label: 'Elite Campus Trader',
        color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700',
        icon: Award,
        desc: '10+ successful handovers with ≥95% completion rate',
      };
    case 'TRUSTED_SELLER':
      return {
        label: 'Trusted Campus Seller',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
        icon: ShieldCheck,
        desc: '3+ handovers with zero unresolved disputes',
      };
    case 'VERIFIED_STUDENT':
    default:
      return {
        label: 'Verified Student',
        color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700',
        icon: GraduationCap,
        desc: 'Active student with verified campus email',
      };
    case 'NEW_TRADER':
      return {
        label: 'New Student Trader',
        color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: CheckCircle2,
        desc: 'New campus member setting up their profile',
      };
  }
}

/**
 * Reusable student trust, verification, and karma badge
 */
export function StudentReputationBadge({
  user,
  showAcademic = true,
  showHandoverRate = true,
  showKarma = true,
  compact = false,
  className = '',
}) {
  if (!user) return null;

  const stats = user.stats || {};
  const completedSales = stats.completedSales || 0;
  const handoverRate = stats.handoverRate ?? 100;
  const karmaScore = stats.karmaScore ?? 100;
  const trustTier = stats.trustTier || (completedSales >= 1 ? 'VERIFIED_STUDENT' : 'NEW_TRADER');
  const tierInfo = getTrustTierInfo(trustTier);
  const TierIcon = tierInfo.icon;

  const department = user.department || 'Computer Science & Engineering';
  const year = user.year || '3rd Year';

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${tierInfo.color}`}
          title={tierInfo.desc}
        >
          <TierIcon className="w-3 h-3" />
          <span>{tierInfo.label}</span>
        </span>

        {showHandoverRate && (
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            {handoverRate}% Handover ({completedSales} sold)
          </span>
        )}

        {showKarma && (
          <span className="text-[10px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
            <span>{karmaScore} Karma</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 ${className}`}>
      {/* Top Header: Verification Badge & Trust Tier */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-xs dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800">
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>Verified Institute Student</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${tierInfo.color}`}
            title={tierInfo.desc}
          >
            <TierIcon className="w-3 h-3" />
            <span>{tierInfo.label}</span>
          </span>
        </div>

        {showKarma && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100/80 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-black"
            title="Karma is earned via completed in-person handovers (+10) and penalized for cancellations or ghosting (-25)."
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{karmaScore} Karma</span>
          </div>
        )}
      </div>

      {/* Academic Details */}
      {showAcademic && (
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
          <strong className="text-slate-900 dark:text-white font-semibold">{department}</strong> • {year}
        </p>
      )}

      {/* Handover & Completion Rate Strip */}
      {showHandoverRate && (
        <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200/70 dark:border-slate-800/80">
          <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{handoverRate}% Handover Rate</span>
            <span className="text-slate-400 font-normal">({completedSales} items sold)</span>
          </span>

          {stats.ghostingPenalties > 0 ? (
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200">
              {stats.ghostingPenalties} ghosting penalty
            </span>
          ) : (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Zero Disputes
            </span>
          )}
        </div>
      )}
    </div>
  );
}
