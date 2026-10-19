'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  ShieldCheck,
  TrendingDown,
  Calendar,
  Sparkles,
  Calculator,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Smartphone,
  Command,
} from 'lucide-react';

interface GuideStep {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  description: string;
  details: string[];
  tip?: string;
  previewCard?: {
    metricLabel: string;
    metricValue: string;
    metricSubtext: string;
    metricStatus: 'safe' | 'danger' | 'info';
  };
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'safe-spend',
    badge: 'Core Engine',
    title: 'Safe Daily Spend',
    subtitle: 'Your calm, zero-guilt daily allowance number',
    icon: ShieldCheck,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80',
    description:
      'Instead of stressing about complex monthly budgets, Parity boils your finances down to one actionable number: how much you can comfortably spend today.',
    details: [
      'Sets aside your room rent, Wi-Fi bills, and emergency reserve first.',
      'Divides remaining cash evenly across days left until your next allowance.',
      'If you spend less today, tomorrow’s safe daily spend automatically increases!',
    ],
    tip: 'No guilt for spending: if it fits within your daily number, enjoy it guilt-free.',
    previewCard: {
      metricLabel: 'Safe Daily Spend',
      metricValue: '₹285 / day',
      metricSubtext: '14 days left until next allowance',
      metricStatus: 'safe',
    },
  },
  {
    id: 'forecast',
    badge: 'Early Warning',
    title: 'Run-Out Forecast',
    subtitle: 'Predicting your financial runway before you run dry',
    icon: TrendingDown,
    iconColor: 'text-indigo-500',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80',
    description:
      'Parity monitors your real spending velocity day-by-day and calculates the exact date your money will run out if you continue your current pace.',
    details: [
      'Color-coded status (Safe, Tight, or Danger) keeps you aware at a glance.',
      'Flags unusual capital spikes (like textbooks or doctor visits) so they don’t distort your daily living rate.',
      'Alerts you well in advance if your runway falls short of payout day.',
    ],
    tip: 'Check your status before making weekend plans or impulse purchases.',
    previewCard: {
      metricLabel: 'Run-Out Forecast',
      metricValue: 'Nov 1 (Survives)',
      metricSubtext: 'Spending rate: ₹210/day (Below safe pace)',
      metricStatus: 'safe',
    },
  },
  {
    id: 'bills',
    badge: 'Commitments',
    title: 'Fixed Bills Shield',
    subtitle: 'Ring-fencing rent and recharge so they are never spent',
    icon: Calendar,
    iconColor: 'text-sky-500',
    iconBg: 'bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80',
    description:
      'Never get caught unable to pay room rent or hostel Wi-Fi. Parity locks your upcoming bills into a dedicated pool.',
    details: [
      'Add monthly obligations like Room Rent, Wi-Fi, Mess charges, or Gym dues.',
      'Parity automatically reserves the funds so your safe spend is never artificially inflated.',
      'One-tap "Mark Paid" when the bill is settled, keeping an audit trail.',
    ],
    tip: 'Add all fixed bills during onboarding so your safe daily spend is 100% accurate.',
    previewCard: {
      metricLabel: 'Committed Bills',
      metricValue: '₹3,000 Reserved',
      metricSubtext: 'Rent (₹2,500) due Nov 5 • Wi-Fi (₹500) due Nov 10',
      metricStatus: 'info',
    },
  },
  {
    id: 'ai-chat',
    badge: 'Natural Language',
    title: 'AI Assistant & Quick Log',
    subtitle: 'Log expenses in 2 seconds like texting a friend (Ctrl+K)',
    icon: Sparkles,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80',
    description:
      'No tedious multi-field forms. Just open chat and type naturally, or ask financial questions about your cashflow.',
    details: [
      'Type "spent 120 on auto rickshaw" or "chai and sandwich 85" to log instantly.',
      'Ask "Can I afford a ₹1,500 pair of shoes?" for instant runway impact.',
      'Works 100% offline with smart heuristics even if network or API is down.',
    ],
    tip: 'Shortcut: Press Ctrl+K (or Cmd+K) anywhere on desktop to toggle chat instantly.',
    previewCard: {
      metricLabel: 'Ask Parity AI',
      metricValue: '"Spent 150 on burger"',
      metricSubtext: 'Logged under Food & Chai • Safe spend adjusted to ₹275',
      metricStatus: 'info',
    },
  },
  {
    id: 'simulator',
    badge: 'Decision Tool',
    title: 'What-If Simulator',
    subtitle: 'Test big purchases before spending a single rupee',
    icon: Calculator,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80',
    description:
      'Planning a weekend road trip, buying concert tickets, or replacing tech? Test the decision risk-free.',
    details: [
      'Enter any prospective amount to simulate its direct impact.',
      'Instantly shows how your Safe Daily Spend and Run-Out Date would change.',
      'Gives a clear verdict: Safe, Feasible with caution, or Dangerous.',
    ],
    tip: 'Use the simulator before buying clothes or ordering expensive meals with friends.',
    previewCard: {
      metricLabel: 'Simulation: ₹1,200 Outing',
      metricValue: '-₹42 / day',
      metricSubtext: 'Safe daily spend drops from ₹285 to ₹243 (Survives)',
      metricStatus: 'safe',
    },
  },
  {
    id: 'rollover',
    badge: 'Monthly Lifecycle',
    title: '1-Tap Month Rollover',
    subtitle: 'Smooth transition when your next allowance arrives',
    icon: RotateCw,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80',
    description:
      'When your allowance day arrives (e.g. 1st of the month), Parity seamlessly rolls your account into the new month.',
    details: [
      'Celebratory rollover prompt confirms your incoming allowance.',
      'Carries forward any leftover savings from last month into your new balance.',
      'Automatically resets recurring bills to unpaid for the new cycle.',
      'All your past transactions remain safely preserved in your ledger history.',
    ],
    tip: 'You can test future dates anytime via the "Simulated Date" picker in the header.',
    previewCard: {
      metricLabel: 'New Month Rollover',
      metricValue: '₹8,000 Deposit',
      metricSubtext: 'Past transactions preserved • Bills reset for new cycle',
      metricStatus: 'safe',
    },
  },
];

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartOnboarding?: () => void;
  isOnboarded?: boolean;
}

export function QuickGuideModal({
  isOpen,
  onClose,
  onStartOnboarding,
  isOnboarded = false,
}: QuickGuideModalProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = GUIDE_STEPS[activeStepIndex];
  const isFirst = activeStepIndex === 0;
  const isLast = activeStepIndex === GUIDE_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
      if (!isOnboarded && onStartOnboarding) {
        onStartOnboarding();
      }
    } else {
      setActiveStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setActiveStepIndex(prev => prev - 1);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How Parity Works"
      description="A quick 1-minute guide to mastering your student finances"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Step Indicator Tabs / Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {GUIDE_STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{idx + 1}.</span>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Feature Showcase Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${currentStep.iconBg} shrink-0`}>
                <currentStep.icon className={`h-6 w-6 ${currentStep.iconColor}`} />
              </div>
              <div>
                <span className="inline-block rounded-md bg-slate-200/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {currentStep.badge}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {currentStep.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentStep.subtitle}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Details Bullet List */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-2">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Key Rules & Benefits:
            </h4>
            <ul className="space-y-1.5 pl-5 list-disc text-xs text-slate-600 dark:text-slate-400">
              {currentStep.details.map((detail, dIdx) => (
                <li key={dIdx} className="leading-normal">
                  {detail}
                </li>
              ))}
            </ul>
          </div>

          {/* Micro Preview Box */}
          {currentStep.previewCard && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-900/60 p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 block">
                  {currentStep.previewCard.metricLabel}
                </span>
                <span className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                  {currentStep.previewCard.metricValue}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  {currentStep.previewCard.metricSubtext}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Live in Parity
              </div>
            </div>
          )}

          {/* Pro Tip Callout */}
          {currentStep.tip && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-200/50 dark:bg-slate-800/40 p-2.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">💡 Pro-Tip:</span>
              <span>{currentStep.tip}</span>
            </div>
          )}
        </div>

        {/* Quick Shortcut & PWA Footer Tips */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1">
          <div className="flex items-center gap-1.5">
            <Command className="h-3.5 w-3.5 text-slate-400" />
            <span>Shortcut: Press <strong>Ctrl+K</strong> to quick log anytime</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-slate-400" />
            <span>Install: Tap <strong>Share → Add to Home Screen</strong></span>
          </div>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={isFirst}
            className="text-xs gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </Button>

          {/* Step Dots */}
          <div className="flex items-center gap-1">
            {GUIDE_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeStepIndex
                    ? 'w-5 bg-emerald-500'
                    : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isLast ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleNext}
                className="text-xs gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="emerald"
                size="sm"
                onClick={handleNext}
                className="text-xs gap-1.5 font-semibold text-white"
              >
                <span>{isOnboarded ? 'Done' : 'Set Up My Budget (1 Min)'}</span>
                <ArrowRight className="h-3.5 w-3.5 text-white" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
