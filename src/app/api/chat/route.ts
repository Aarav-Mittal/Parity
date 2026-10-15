import { NextRequest, NextResponse } from 'next/server';
import { getAiProvider } from '@/lib/ai';
import { ActionProposal, ProposedDeletePayload, ProposedTransactionPayload, ProposedUpdatePayload } from '@/types/chat';
import { AiProviderContext } from '@/lib/ai/types';
import { getTodayISO } from '@/lib/finance/dates';

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

    switch (result.intent.intent) {
      case 'log_expense': {
        const payload: ProposedTransactionPayload = {
          type: 'expense',
          amountPaise: result.intent.amountPaise,
          description: result.intent.description,
          categoryId: result.intent.categoryGuess || 'cat-misc',
          isOneOff: Boolean(result.intent.isOneOff),
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

      case 'log_income': {
        const payload: ProposedTransactionPayload = {
          type: 'income',
          amountPaise: result.intent.amountPaise,
          description: result.intent.description,
          categoryId: 'cat-misc',
          isRefund: Boolean(result.intent.isRefund),
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
        const recentTx = context.recentTransactions && context.recentTransactions.length > 0
          ? context.recentTransactions[context.recentTransactions.length - 1]
          : null;

        if (recentTx) {
          const payload: ProposedUpdatePayload = {
            targetTransactionId: recentTx.id,
            originalAmountPaise: recentTx.amountPaise,
            newAmountPaise: result.intent.newAmountPaise,
            originalDescription: recentTx.description,
            newDescription: result.intent.newDescription,
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
        const recentTx = context.recentTransactions && context.recentTransactions.length > 0
          ? context.recentTransactions[context.recentTransactions.length - 1]
          : null;

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
            queryType: result.intent.queryType,
            targetAmountPaise: result.intent.targetAmountPaise,
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
