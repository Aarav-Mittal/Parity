import { AiParseResult, AiProvider, AiProviderContext } from '../types';
import { parseNaturalLanguageInput } from '../fallbackParser';
import { formatRupees } from '@/lib/finance/currency';
import { DEFAULT_CATEGORIES } from '@/lib/store/sampleData';

export class FallbackProvider implements AiProvider {
  name = 'fallback';

  isAvailable(): boolean {
    return true; // Always available offline at ₹0 cost
  }

  async parseMessage(message: string, context: AiProviderContext): Promise<AiParseResult> {
    const intent = parseNaturalLanguageInput(message);
    const categories = context.categories || DEFAULT_CATEGORIES;

    let reply = '';

    switch (intent.intent) {
      case 'log_expense': {
        const cat = categories.find(c => c.id === intent.categoryGuess);
        const catName = cat ? cat.name : 'Miscellaneous';
        const formattedAmt = formatRupees(intent.amountPaise);
        const oneOffNote = intent.isOneOff
          ? ' (flagged as one-off purchase so it won\'t inflate your daily burn rate)'
          : '';
        reply = `Drafted: ${formattedAmt} for "${intent.description}" under ${catName}${oneOffNote}. Confirm below to log it to your ledger.`;
        break;
      }

      case 'log_batch_expenses': {
        const count = intent.expenses.length;
        const formattedTotal = formatRupees(intent.totalAmountPaise);
        const itemSummaries = intent.expenses
          .map(e => `${e.description} (${formatRupees(e.amountPaise)})`)
          .join(', ');
        reply = `Drafted ${count} expenses totaling ${formattedTotal}: ${itemSummaries}. Confirm below to log them to your ledger.`;
        break;
      }

      case 'log_income': {
        const formattedAmt = formatRupees(intent.amountPaise);
        const typeStr = intent.isRefund ? 'cashback/refund' : 'allowance/income';
        reply = `Drafted: ${formattedAmt} ${typeStr}. Confirm below to credit it to your balance.`;
        break;
      }

      case 'correct_transaction': {
        const formattedNew = intent.newAmountPaise ? formatRupees(intent.newAmountPaise) : 'new amount';
        const recentTx = context.recentTransactions && context.recentTransactions.length > 0
          ? context.recentTransactions[context.recentTransactions.length - 1]
          : null;

        if (recentTx) {
          const oldAmt = formatRupees(recentTx.amountPaise);
          reply = `Found your recent transaction "${recentTx.description}" (${oldAmt}). Correcting amount to ${formattedNew}. Confirm below to adjust your ledger.`;
        } else {
          reply = `Ready to correct your last transaction to ${formattedNew}. Confirm below to adjust your ledger.`;
        }
        break;
      }

      case 'undo_transaction': {
        const recentTx = context.recentTransactions && context.recentTransactions.length > 0
          ? context.recentTransactions[context.recentTransactions.length - 1]
          : null;

        if (recentTx) {
          const amt = formatRupees(recentTx.amountPaise);
          reply = `Ready to remove "${recentTx.description}" (${amt}). Confirm below to delete it from your ledger.`;
        } else {
          reply = 'Ready to undo your last logged transaction. Confirm below to proceed.';
        }
        break;
      }

      case 'budget_query': {
        const forecast = context.forecast;
        if (!forecast) {
          reply = 'To check your budget, please ensure your allowance cycle is set up.';
          break;
        }

        if (intent.queryType === 'safe_spend') {
          const safeDaily = formatRupees(forecast.safeDailySpendPaise);
          const pool = formatRupees(forecast.discretionaryPoolPaise);
          reply = `Your safe daily spend limit is ${safeDaily}/day. With ${forecast.daysRemaining} days remaining and ${pool} in your discretionary pool, staying within ${safeDaily}/day guarantees you finish the month safely.`;
        } else if (intent.queryType === 'will_money_last') {
          const nextPayoutStr = context.cycle?.nextPayoutDate ? `on ${context.cycle.nextPayoutDate}` : 'on payout day';
          const reservePaise = context.cycle?.targetReservePaise || 0;
          if (forecast.status === 'safe') {
            reply = `Yes, you're in great shape! At your current spending pace (~${formatRupees(forecast.recentDailySpendPaise)}/day), your money will easily last until your next allowance ${nextPayoutStr}.`;
          } else if (forecast.status === 'tight') {
            reply = `You're cutting it close. At your current pace (~${formatRupees(forecast.recentDailySpendPaise)}/day), you risk breaching your ${formatRupees(reservePaise)} safety reserve. Try keeping daily spends under ${formatRupees(forecast.safeDailySpendPaise)}/day.`;
          } else {
            const runOutStr = forecast.projectedRunOutDate ? `on ${forecast.projectedRunOutDate}` : 'before next payout';
            reply = `Warning: At your current burn rate, your money is projected to run out ${runOutStr}. Limit spending strictly to essentials to avoid a deficit.`;
          }
        } else if (intent.queryType === 'affordability_check') {
          const target = intent.targetAmountPaise || 0;
          const formattedTarget = formatRupees(target);
          const pool = forecast.discretionaryPoolPaise;

          if (target <= 0) {
            reply = `Your safe daily spend is ${formatRupees(forecast.safeDailySpendPaise)}/day, with ${formatRupees(pool)} discretionary funds left for the month.`;
          } else if (target > pool) {
            reply = `Spending ${formattedTarget} is not recommended right now. Your remaining discretionary pool is ${formatRupees(pool)} after accounting for upcoming bills and your reserve. This purchase would cause a budget deficit.`;
          } else {
            const days = Math.max(1, forecast.daysRemaining);
            const remainingPool = pool - target;
            const newSafeDaily = Math.floor(remainingPool / days);
            reply = `Yes, you can afford it! Spending ${formattedTarget} will adjust your safe daily spend from ${formatRupees(forecast.safeDailySpendPaise)}/day down to ${formatRupees(newSafeDaily)}/day for the remaining ${days} days, but you will still reach your next payout safely.`;
          }
        } else {
          reply = `You have ${formatRupees(forecast.currentBalancePaise)} in your account with ${forecast.daysRemaining} days left until payout. Your safe daily spend is ${formatRupees(forecast.safeDailySpendPaise)}/day.`;
        }
        break;
      }

      case 'unknown':
      default: {
        reply = 'I didn\'t catch that. Try saying something like "spent 120 on auto", "chai 30", "how much can I spend today?", or "undo".';
        break;
      }
    }

    return {
      intent,
      conversationalReply: reply,
      providerUsed: 'fallback',
    };
  }
}
