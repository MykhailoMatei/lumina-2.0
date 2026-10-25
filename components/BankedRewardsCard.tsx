import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Gift, Sparkles, Check, Play, Clock, Coffee, 
  Gamepad2, Film, BookOpen, Headphones, ChevronRight,
  Info, ArrowUpRight, Flame
} from 'lucide-react';
import { Habit } from '../types';

interface BankedRewardsCardProps {
  onOpenHabitModal?: () => void;
  className?: string;
}

export const BankedRewardsCard: React.FC<BankedRewardsCardProps> = ({ 
  onOpenHabitModal,
  className = '' 
}) => {
  const { habits, redeemHabitReward, themeClasses } = useApp();
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [customDeductAmount, setCustomDeductAmount] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  // Filter habits that have rewards configured
  const rewardedHabits = habits.filter(h => h.reward && (h.reward.amount > 0 || (h.reward.bankedBalance || 0) > 0));

  // Calculate totals
  const totalBankedCount = rewardedHabits.reduce((acc, h) => acc + (h.reward?.bankedBalance || 0), 0);

  const getRewardIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('game') || lower.includes('gaming')) return Gamepad2;
    if (lower.includes('film') || lower.includes('movie') || lower.includes('netflix') || lower.includes('tv') || lower.includes('show') || lower.includes('episode')) return Film;
    if (lower.includes('read') || lower.includes('book')) return BookOpen;
    if (lower.includes('podcast') || lower.includes('music') || lower.includes('walk')) return Headphones;
    if (lower.includes('coffee') || lower.includes('tea') || lower.includes('treat') || lower.includes('snack')) return Coffee;
    return Gift;
  };

  const handleQuickRedeem = (habit: Habit, amount: number) => {
    redeemHabitReward(habit.id, amount);
  };

  const handleCustomRedeem = (habit: Habit) => {
    const num = parseFloat(customDeductAmount);
    if (!isNaN(num) && num > 0) {
      redeemHabitReward(habit.id, num);
      setCustomDeductAmount('');
      setSelectedHabitId(null);
    }
  };

  return (
    <div className={`bg-white dark:bg-slate-800/90 rounded-[2.25rem] p-5 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${themeClasses.secondary} ${themeClasses.text} flex items-center justify-center shadow-inner shrink-0`}>
            <Gift size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                Guilt-Free Rewards
              </h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-full">
                Premack Principle
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Personal treats earned through your daily discipline
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
          title="What is Temptation Bundling?"
        >
          <Info size={16} />
        </button>
      </div>

      {/* Premack Principle Micro-Explainer (collapsible) */}
      {showExplanation && (
        <div className="mb-4 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-white">
            <Sparkles size={14} className="text-amber-500" />
            <span>Temptation Bundling & The Premack Principle</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Pair an activity you need to do with a reward you love (e.g. <em>read 20 pages → earn 30 min of gaming</em>). 
            Completing the habit automatically banks your reward balance. Spend it whenever you are ready, 100% guilt-free!
          </p>
        </div>
      )}

      {/* If no habits configured with rewards */}
      {rewardedHabits.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/80">
          <div className="w-10 h-10 mx-auto mb-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            No rewards paired yet
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1 mb-3">
            Pair your habits with a personal treat (like 30 min of gaming after 20 pages of reading).
          </p>
          {onOpenHabitModal && (
            <button
              type="button"
              onClick={onOpenHabitModal}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white ${themeClasses.primary} shadow-sm hover:opacity-90 transition-opacity`}
            >
              <span>Pair a Habit & Reward</span>
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      ) : (
        /* List of Rewarded Habits & Their Banked Balances */
        <div className="space-y-3">
          {rewardedHabits.map(habit => {
            const reward = habit.reward!;
            const Icon = getRewardIcon(reward.title);
            const balance = reward.bankedBalance || 0;
            const hasBalance = balance > 0;
            const isEditingCustom = selectedHabitId === habit.id;

            // Suggested quick spend increments based on unit
            const isMinutes = reward.unit.toLowerCase().includes('min');
            const quickIncrements = isMinutes
              ? [15, 30].filter(inc => inc <= balance)
              : [1, 2].filter(inc => inc <= balance);

            return (
              <div 
                key={habit.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                  hasBalance 
                    ? 'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-700' 
                    : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      hasBalance 
                        ? `${themeClasses.secondary} ${themeClasses.text}` 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white truncate">
                          {reward.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-normal">
                          · from "{habit.title}"
                        </span>
                      </div>

                      {/* Rule */}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Each completion earns{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          +{reward.amount} {reward.unit}
                        </span>
                        {habit.targetAmount && habit.targetUnit && (
                          <span> (for {habit.targetAmount} {habit.targetUnit})</span>
                        )}
                      </p>

                      {/* Lifetime stat summary */}
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5">
                        <span>Total earned: {reward.totalEarned || 0} {reward.unit}</span>
                        <span>•</span>
                        <span>Enjoyed: {reward.totalRedeemed || 0} {reward.unit}</span>
                      </div>
                    </div>
                  </div>

                  {/* Banked Counter Badge */}
                  <div className="text-right shrink-0">
                    <div className={`inline-flex flex-col items-end px-3 py-1.5 rounded-xl border ${
                      hasBalance
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      <span className="text-base sm:text-lg font-bold leading-none">
                        {balance}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5">
                        {reward.unit} ready
                      </span>
                    </div>
                  </div>
                </div>

                {/* Redemption Actions */}
                {hasBalance && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Play size={10} className="text-emerald-500 fill-emerald-500" />
                      Enjoy treat:
                    </span>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {quickIncrements.map(inc => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => handleQuickRedeem(habit, inc)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-2xs"
                        >
                          Use {inc}{reward.unit}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleQuickRedeem(habit, balance)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-white ${themeClasses.primary} hover:opacity-90 transition-opacity shadow-2xs`}
                      >
                        Use All ({balance}{reward.unit})
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingCustom) {
                            setSelectedHabitId(null);
                          } else {
                            setSelectedHabitId(habit.id);
                            setCustomDeductAmount('');
                          }
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                      >
                        {isEditingCustom ? 'Cancel' : 'Custom...'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Custom Amount Form */}
                {isEditingCustom && hasBalance && (
                  <div className="mt-2.5 p-2 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 animate-in fade-in duration-150">
                    <span className="text-xs text-slate-500 pl-1">Deduct:</span>
                    <input
                      type="number"
                      min="1"
                      max={balance}
                      value={customDeductAmount}
                      onChange={e => setCustomDeductAmount(e.target.value)}
                      placeholder={`Max ${balance}`}
                      className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-400">{reward.unit}</span>
                    <button
                      type="button"
                      onClick={() => handleCustomRedeem(habit)}
                      disabled={!customDeductAmount || parseFloat(customDeductAmount) <= 0}
                      className={`ml-auto px-3 py-1 rounded-lg text-xs font-semibold text-white ${themeClasses.primary} disabled:opacity-40 transition-opacity`}
                    >
                      Redeem
                    </button>
                  </div>
                )}

                {!hasBalance && (
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                    <Clock size={11} className="text-slate-300 dark:text-slate-600" />
                    <span>Check off "{habit.title}" to bank your next +{reward.amount} {reward.unit}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
