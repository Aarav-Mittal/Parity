import { NextRequest, NextResponse } from 'next/server';
import { getAiProvider } from '@/lib/ai';
import { ActionProposal, ProposedDeletePayload, ProposedTransactionPayload, ProposedUpdatePayload } from '@/types/chat';
import { AiProviderContext } from '@/lib/ai/types';
import { getTodayISO } from '@/lib/finance/dates';
import { Transaction } from '@/types/finance';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, context = {} } = body as { message?: string; context?: AiProviderContext };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'A non-empty message is required.' },
        { status: 400 }
      );
    }

    const provider = getAiProvider();
    const todayISO = context.todayISO || getTodayISO();
    const result = await provider.parseMessage(message, { ...context, todayISO });

    // Build an ActionProposal when intent requires ledger mutation or confirmation
    let actionProposal: ActionProposal | undefined;
    const proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const parsedIntent = result.intent;

    switch (parsedIntent.intent) {
      case 'log_expense': {
        const payload: ProposedTransactionPayload = {
          type: 'expense',
          amountPaise: parsedIntent.amountPaise,
          description: parsedIntent.description,
          categoryId: parsedIntent.categoryGuess || 'cat-misc',
          isOneOff: Boolean(parsedIntent.isOneOff),
          transactionDate: todayISO,
        };
        actionProposal = {
          id: proposalId,
          type: 'create_transaction',
          status: 'pending',
          payload,
        };
        break;
      }

      case 'log_batch_expenses': {
        const transactions: ProposedTransactionPayload[] = parsedIntent.expenses.map(e => ({
          type: 'expense',
          amountPaise: e.amountPaise,
          description: e.description,
          categoryId: e.categoryGuess || 'cat-misc',
          isOneOff: Boolean(e.isOneOff),
          transactionDate: todayISO,
        }));

        actionProposal = {
          id: proposalId,
          type: 'create_batch_transactions',
          status: 'pending',
          payload: {
            transactions,
            totalAmountPaise: parsedIntent.totalAmountPaise,
          },
        };
        break;
      }

      case 'log_income': {
        const payload: ProposedTransactionPayload = {
          type: 'income',
          amountPaise: parsedIntent.amountPaise,
          description: parsedIntent.description,
          categoryId: 'cat-misc',
          isRefund: Boolean(parsedIntent.isRefund),
          transactionDate: todayISO,
        };
        actionProposal = {
          id: proposalId,
          type: 'create_transaction',
          status: 'pending',
          payload,
        };
        break;
      }

      case 'correct_transaction': {
        const txList = context.recentTransactions && context.recentTransactions.length > 0
          ? context.recentTransactions
          : [];

        let targetTx: Transaction | null = null;

        // 1. Direct ID match if identified by AI
        if (parsedIntent.targetTransactionId) {
          targetTx = txList.find(t => t.id === parsedIntent.targetTransactionId) || null;
        }

        // 2. Keyword match against transaction description (e.g. user said "lunch", match "Lunch")
        if (!targetTx) {
          const searchTerms = [
            parsedIntent.targetKeyword,
            parsedIntent.newDescription,
          ].filter(Boolean).map(s => s!.toLowerCase());

          // Also check words from the message
          const rawWords = message
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length >= 3 && !['bad', 'the', 'was', 'for', 'not', 'and', 'that', 'this', 'actually'].includes(w));
          searchTerms.push(...rawWords);

          for (const term of searchTerms) {
            targetTx = txList.find(t => t.description.toLowerCase().includes(term)) || null;
            if (targetTx) break;
          }
        }

        // 3. Fallback: most recent transaction (index 0, since transactions are sorted newest first)
        if (!targetTx && txList.length > 0) {
          targetTx = txList[0];
        }

        if (targetTx) {
          const payload: ProposedUpdatePayload = {
            targetTransactionId: targetTx.id,
            originalAmountPaise: targetTx.amountPaise,
            newAmountPaise: parsedIntent.newAmountPaise,
            originalDescription: targetTx.description,
            newDescription: parsedIntent.newDescription,
          };
          actionProposal = {
            id: proposalId,
            type: 'update_transaction',
            status: 'pending',
            payload,
          };
        }
        break;
      }

      case 'undo_transaction': {
        const txList = context.recentTransactions && context.recentTransactions.length > 0
          ? context.recentTransactions
          : [];

        // Pick newest transaction to undo
        const recentTx = txList.length > 0 ? txList[0] : null;

        if (recentTx) {
          const payload: ProposedDeletePayload = {
            targetTransactionId: recentTx.id,
            description: recentTx.description,
            amountPaise: recentTx.amountPaise,
          };
          actionProposal = {
            id: proposalId,
            type: 'delete_transaction',
            status: 'pending',
            payload,
          };
        }
        break;
      }

      case 'budget_query': {
        actionProposal = {
          id: proposalId,
          type: 'answer_query',
          status: 'confirmed',
          payload: {
            queryType: parsedIntent.queryType,
            targetAmountPaise: parsedIntent.targetAmountPaise,
            directAnswer: result.conversationalReply,
          },
        };
        break;
      }

      case 'unknown':
      default:
        break;
    }

    return NextResponse.json({
      success: true,
      intent: result.intent,
      conversationalReply: result.conversationalReply,
      providerUsed: result.providerUsed,
      modelName: result.modelName,
      debugNote: result.debugNote,
      actionProposal,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
