import { describe, it, expect } from 'vitest';
import { FallbackProvider } from '../providers/fallbackProvider';
import { ARYAN_CYCLE, ARYAN_TRANSACTIONS, DEFAULT_CATEGORIES } from '@/lib/store/sampleData';
import { calculateForecast } from '@/lib/finance/forecast';
import { calculateLedgerBalance } from '@/lib/finance/ledger';
import { Transaction } from '@/types/finance';

describe('Checkpoint 3.4: End-to-End Chat Action Flow (Undo, Correction & Batch)', () => {
  const provider = new FallbackProvider();

  it('1. End-to-end Expense Logging Flow: intent -> proposal -> ledger update -> recomputed forecast', async () => {
    let currentTransactions: Transaction[] = [...ARYAN_TRANSACTIONS];

    // Initial state before logging new expense
    const initialBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);
    expect(initialBalance).toBe(420100); // ₹4,201

    // Step A: Student types natural language log
    const parseResult = await provider.parseMessage('canteen thali 150', {
      cycle: ARYAN_CYCLE,
      recentTransactions: currentTransactions,
      categories: DEFAULT_CATEGORIES,
      todayISO: '2026-10-15',
    });

    expect(parseResult.intent.intent).toBe('log_expense');
    if (parseResult.intent.intent !== 'log_expense') return;
    expect(parseResult.intent.amountPaise).toBe(15000); // ₹150

    // Step B: User confirms action proposal
    const newTx: Transaction = {
      id: 'tx-new-1',
      userId: ARYAN_CYCLE.userId,
      type: 'expense',
      amountPaise: parseResult.intent.amountPaise,
      description: parseResult.intent.description,
      categoryId: parseResult.intent.categoryGuess || 'cat-food',
      transactionDate: '2026-10-15',
      createdAt: '2026-10-15T12:00:00Z',
    };
    currentTransactions = [...currentTransactions, newTx];

    // Step C: Ledger updates immediately
    const updatedBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);
    expect(updatedBalance).toBe(420100 - 15000); // ₹4,051 (405100 paise)

    // Step D: Recomputed forecast reflects deduction
    const updatedForecast = calculateForecast({
      todayISO: '2026-10-15',
      cycle: ARYAN_CYCLE,
      transactions: currentTransactions,
      recurringExpenses: [],
    });
    expect(updatedForecast.currentBalancePaise).toBe(405100);
  });

  it('2. End-to-end Correction Flow: user corrects previous mistake via chat', async () => {
    let currentTransactions: Transaction[] = [...ARYAN_TRANSACTIONS];
    const initialBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);
    expect(initialBalance).toBe(420100);

    // Step A: Student says "actually lunch was 150 not 180"
    const parseResult = await provider.parseMessage('actually lunch was 150 not 180', {
      cycle: ARYAN_CYCLE,
      recentTransactions: currentTransactions,
      categories: DEFAULT_CATEGORIES,
      todayISO: '2026-10-15',
    });

    expect(parseResult.intent.intent).toBe('correct_transaction');
    if (parseResult.intent.intent !== 'correct_transaction') return;
    expect(parseResult.intent.newAmountPaise).toBe(15000); // ₹150

    // Step B: Target is the last transaction (tx-6: Chai & Snacks, ₹250)
    const targetTx = currentTransactions[currentTransactions.length - 1];

    // Step C: Apply correction (adjust amount)
    currentTransactions = currentTransactions.map(tx =>
      tx.id === targetTx.id ? { ...tx, amountPaise: 15000 } : tx
    );

    // Step D: Ledger recomputes with corrected amount
    const updatedBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);
    // target was ₹250, corrected to ₹150 -> ₹100 restored!
    expect(updatedBalance).toBe(initialBalance + 10000);
  });

  it('3. End-to-end Undo Flow: user cancels last transaction via chat', async () => {
    let currentTransactions: Transaction[] = [...ARYAN_TRANSACTIONS];
    const initialTxCount = currentTransactions.length;
    const initialBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);

    // Step A: Student says "undo last transaction"
    const parseResult = await provider.parseMessage('undo last transaction', {
      cycle: ARYAN_CYCLE,
      recentTransactions: currentTransactions,
      categories: DEFAULT_CATEGORIES,
      todayISO: '2026-10-15',
    });

    expect(parseResult.intent.intent).toBe('undo_transaction');

    // Step B: Remove target transaction
    const targetId = currentTransactions[currentTransactions.length - 1].id;
    currentTransactions = currentTransactions.filter(tx => tx.id !== targetId);

    expect(currentTransactions.length).toBe(initialTxCount - 1);

    // Step C: Balance is restored by ₹250 (amount of tx-6)
    const afterUndoBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);
    expect(afterUndoBalance).toBe(initialBalance + 25000);
  });

  it('4. End-to-end Batch Logging Flow: logs multiple items from a single message', async () => {
    let currentTransactions: Transaction[] = [...ARYAN_TRANSACTIONS];
    const initialBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);

    // Step A: Student inputs multiple expenses
    const parseResult = await provider.parseMessage(
      'i spent 20 on a samosa, then 40 on snacks and another 40 for coke',
      {
        cycle: ARYAN_CYCLE,
        recentTransactions: currentTransactions,
        categories: DEFAULT_CATEGORIES,
        todayISO: '2026-10-15',
      }
    );

    expect(parseResult.intent.intent).toBe('log_batch_expenses');
    if (parseResult.intent.intent !== 'log_batch_expenses') return;

    expect(parseResult.intent.expenses).toHaveLength(3);
    expect(parseResult.intent.totalAmountPaise).toBe(10000); // ₹100

    // Step B: User clicks "Confirm All (3 items)"
    const newItems: Transaction[] = parseResult.intent.expenses.map((e, idx) => ({
      id: `tx-batch-${idx}`,
      userId: ARYAN_CYCLE.userId,
      type: 'expense',
      amountPaise: e.amountPaise,
      description: e.description,
      categoryId: e.categoryGuess || 'cat-food',
      transactionDate: '2026-10-15',
      createdAt: new Date().toISOString(),
    }));

    currentTransactions = [...currentTransactions, ...newItems];

    // Step C: Ledger balance decreases by exactly ₹100 (10000 paise)
    const afterBatchBalance = calculateLedgerBalance(ARYAN_CYCLE.openingBalancePaise, currentTransactions);
    expect(afterBatchBalance).toBe(initialBalance - 10000);
  });

  it('5. Targeted Correction Flow: correctly targets named transaction ("my bad, the lunch was 350") instead of unrelated previous transactions', async () => {
    // Current transactions has Lunch (₹450) freshly logged at index 0, followed by older transactions
    const lunchTx: Transaction = {
      id: 'tx-lunch-recent',
      userId: ARYAN_CYCLE.userId,
      type: 'expense',
      amountPaise: 45000,
      description: 'Lunch',
      categoryId: 'cat-food',
      transactionDate: '2026-10-15',
      createdAt: '2026-10-15T13:00:00Z',
    };
    let currentTransactions: Transaction[] = [lunchTx, ...ARYAN_TRANSACTIONS];

    // User sends correction with "my bad, the lunch was 350"
    const parseResult = await provider.parseMessage('my bad, the lunch was 350', {
      cycle: ARYAN_CYCLE,
      recentTransactions: currentTransactions,
      categories: DEFAULT_CATEGORIES,
      todayISO: '2026-10-15',
      chatHistory: [
        { role: 'user', content: 'lunch 450' },
        { role: 'assistant', content: 'Logged ₹450 for lunch.' },
      ],
    });

    const parsedIntent = parseResult.intent;
    expect(parsedIntent.intent).toBe('correct_transaction');
    if (parsedIntent.intent !== 'correct_transaction') return;
    expect(parsedIntent.newAmountPaise).toBe(35000);
    expect(parsedIntent.targetKeyword).toBe('lunch');

    // Matching logic: match against 'lunch' keyword
    const matchedTx = currentTransactions.find(t =>
      t.description.toLowerCase().includes(parsedIntent.targetKeyword || '')
    );

    expect(matchedTx).toBeDefined();
    expect(matchedTx?.id).toBe('tx-lunch-recent'); // Targets Lunch (₹450), NOT Chai & Snacks!
    expect(matchedTx?.amountPaise).toBe(45000);

    // Apply update to the matched transaction
    currentTransactions = currentTransactions.map(t =>
      t.id === matchedTx?.id ? { ...t, amountPaise: 35000 } : t
    );
    expect(currentTransactions.find(t => t.id === 'tx-lunch-recent')?.amountPaise).toBe(35000);
    // Verify older transactions (e.g. Chai & Snacks tx-6) remain completely untouched
    expect(currentTransactions.find(t => t.id === 'tx-6')?.amountPaise).toBe(25000);
  });
});
