'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMoney } from '@/lib/store/MoneyContext';
import { ChatMessage, ActionProposal } from '@/types/chat';
import { ActionCard } from './ActionCard';
import { Button } from '@/components/ui/Button';
import { formatRupees } from '@/lib/finance/currency';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  Cpu,
  HelpCircle,
  TrendingDown,
  Coffee,
  Car,
  ShoppingBag,
} from 'lucide-react';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'msg-welcome',
  role: 'assistant',
  content: "Hey! I'm your Money Survival assistant. You can log an expense in natural language (e.g. \"spent 120 on auto\" or \"chai 30\"), or ask me questions like \"how much can I spend today?\".",
  createdAt: new Date().toISOString(),
};

const SUGGESTED_PROMPTS = [
  { label: 'Safe spend today?', query: 'How much can I spend today?' },
  { label: 'Can I afford ₹2,000?', query: 'Can I buy shoes for 2000?' },
  { label: 'Chai 30', query: 'chai 30' },
  { label: 'Auto 120', query: 'auto 120 to college' },
];

export function ChatDrawer({ isOpen, onClose, initialPrompt }: ChatDrawerProps) {
  const {
    cycle,
    forecast,
    categories,
    transactions,
    todayISO,
    addTransaction,
    editTransaction,
    deleteTransaction,
  } = useMoney();

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeEngine, setActiveEngine] = useState<{ provider: 'groq' | 'fallback' | 'gemini'; model?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input, prefill if provided, and scroll down when drawer opens
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt) {
        setInputValue(initialPrompt);
      }
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 150);
    }
  }, [isOpen, initialPrompt]);

  // Accessibility: close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Prepare recent transactions sorted newest first
    const sortedRecent = [...transactions]
      .sort((a, b) => (b.createdAt || b.transactionDate).localeCompare(a.createdAt || a.transactionDate))
      .slice(0, 10);

    // Extract recent conversation turns for contextual follow-up questions
    const chatHistory = messages
      .filter(m => m.id !== 'msg-welcome' && m.content)
      .slice(-6)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            cycle,
            forecast,
            recentTransactions: sortedRecent,
            categories,
            todayISO,
            chatHistory,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.providerUsed) {
        setActiveEngine({
          provider: data.providerUsed,
          model: data.modelName,
        });
      }

      const assistantMessage: ChatMessage = {
        id: `msg-assistant-${Date.now()}`,
        role: 'assistant',
        content: data.conversationalReply || 'Understood.',
        createdAt: new Date().toISOString(),
        actionProposal: data.actionProposal,
        providerUsed: data.providerUsed,
        modelName: data.modelName,
        debugNote: data.debugNote,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't reach the server. Falling back to offline operations.",
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = (proposal: ActionProposal) => {
    // 1. Perform ledger mutation
    if (proposal.type === 'create_transaction') {
      const p = proposal.payload;
      addTransaction({
        type: p.type,
        amountPaise: p.amountPaise,
        description: p.description,
        categoryId: p.categoryId,
        isOneOff: p.isOneOff,
        transactionDate: p.transactionDate,
      });
    } else if (proposal.type === 'create_batch_transactions') {
      for (const p of proposal.payload.transactions) {
        addTransaction({
          type: p.type,
          amountPaise: p.amountPaise,
          description: p.description,
          categoryId: p.categoryId,
          isOneOff: p.isOneOff,
          transactionDate: p.transactionDate,
        });
      }
    } else if (proposal.type === 'update_transaction') {
      const p = proposal.payload;
      editTransaction(p.targetTransactionId, {
        amountPaise: p.newAmountPaise,
        description: p.newDescription,
      });
    } else if (proposal.type === 'delete_transaction') {
      deleteTransaction(proposal.payload.targetTransactionId);
    }

    // 2. Mark proposal as confirmed in message history
    setMessages(prev =>
      prev.map(msg => {
        if (msg.actionProposal && msg.actionProposal.id === proposal.id) {
          return {
            ...msg,
            actionProposal: {
              ...msg.actionProposal,
              status: 'confirmed',
            } as ActionProposal,
          };
        }
        return msg;
      })
    );

    // 3. Add positive assistant follow-up bubble
    const confirmationText =
      proposal.type === 'create_transaction'
        ? `Logged! Your balance and daily spending limit have been updated.`
        : proposal.type === 'create_batch_transactions'
        ? `Logged all ${proposal.payload.transactions.length} items to your ledger!`
        : proposal.type === 'update_transaction'
        ? `Correction applied! Your ledger has been updated.`
        : `Transaction removed from your ledger.`;

    setMessages(prev => [
      ...prev,
      {
        id: `msg-confirm-${Date.now()}`,
        role: 'assistant',
        content: confirmationText,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleCancelAction = (proposal: ActionProposal) => {
    setMessages(prev =>
      prev.map(msg => {
        if (msg.actionProposal && msg.actionProposal.id === proposal.id) {
          return {
            ...msg,
            actionProposal: {
              ...msg.actionProposal,
              status: 'cancelled',
            } as ActionProposal,
          };
        }
        return msg;
      })
    );
  };

  const handleClearHistory = () => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-over Drawer */}
      <aside className="relative flex w-full max-w-md flex-col bg-white dark:bg-slate-900 shadow-2xl z-10 h-full border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 dark:bg-slate-800 text-white shadow-sm border border-transparent dark:border-slate-700">
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Money Survival AI</h3>
                {activeEngine?.provider === 'groq' ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                    title={`Groq AI (${activeEngine.model?.replace('qwen/', '') || 'qwen3.8-27b'})`}
                    aria-label={`Groq AI (${activeEngine.model?.replace('qwen/', '') || 'qwen3.8-27b'})`}
                  >
                    <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  </span>
                ) : activeEngine?.provider === 'fallback' ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                    title="Offline Deterministic Engine"
                    aria-label="Offline Deterministic Engine"
                  >
                    <Cpu className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  </span>
                ) : (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                    title="Ready"
                    aria-label="Ready"
                  >
                    <Sparkles className="h-3 w-3 text-slate-400" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Safe Daily Spend: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatRupees(forecast ? forecast.safeDailySpendPaise : 0)}/day</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear chat history"
              aria-label="Clear chat history"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close drawer"
              aria-label="Close chat drawer"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mt-0.5">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div
                  className={`inline-block rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 rounded-br-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Engine Source Icon for Assistant Replies */}
                {msg.role === 'assistant' && msg.id !== 'msg-welcome' && (
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    {msg.providerUsed === 'groq' ? (
                      <span
                        className="inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 transition-colors"
                        title={`Groq AI (${msg.modelName?.replace('qwen/', '') || 'qwen3.8-27b'})`}
                        aria-label={`Groq AI (${msg.modelName?.replace('qwen/', '') || 'qwen3.8-27b'})`}
                      >
                        <Sparkles className="h-3 w-3" />
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-500 transition-colors"
                        title="Offline Deterministic Engine"
                        aria-label="Offline Deterministic Engine"
                      >
                        <Cpu className="h-3 w-3" />
                      </span>
                    )}

                    {msg.debugNote && (
                      <span
                        className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 rounded px-1.5 py-0.2 border border-amber-200 dark:border-amber-800"
                        title={msg.debugNote}
                      >
                        {msg.debugNote}
                      </span>
                    )}
                  </div>
                )}

                {/* Render interactive action card if present */}
                {msg.actionProposal && (
                  <ActionCard
                    proposal={msg.actionProposal}
                    categories={categories}
                    onConfirm={handleConfirmAction}
                    onCancel={handleCancelAction}
                  />
                )}
              </div>

              {msg.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 dark:bg-slate-700 text-white mt-0.5 border border-transparent dark:border-slate-600">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-2.5 items-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                <Bot className="h-3.5 w-3.5 animate-pulse" />
              </div>
              <div className="rounded-2xl rounded-bl-xs bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[11px]">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p.query)}
                className="shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input Box Form */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="e.g. spent 120 on auto, chai 30..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 pl-3.5 pr-11 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-slate-900 dark:focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500">
            AI extracts data. Final ledger calculations are 100% deterministic math.
          </p>
        </form>
      </aside>
    </div>
  );
}
