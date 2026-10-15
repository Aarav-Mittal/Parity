import { ParsedFinancialIntent } from '@/types/chat';
import { rupeesToPaise } from '@/lib/finance/currency';

// Category keyword mappings for common student expenses
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'cat-food': [
    'chai', 'tea', 'coffee', 'lunch', 'dinner', 'breakfast', 'canteen',
    'biryani', 'pizza', 'burger', 'swiggy', 'zomato', 'maggi', 'snack',
    'snacks', 'samosa', 'food', 'grocery', 'groceries', 'milk', 'eating',
    'momo', 'momos', 'shawarma', 'rolls', 'thali', 'dosa', 'coke', 'pepsi',
    'cold drink', 'drink', 'beverage', 'juice', 'soda', 'water'
  ],
  'cat-travel': [
    'auto', 'metro', 'bus', 'cab', 'uber', 'ola', 'rapido', 'rickshaw',
    'train', 'ticket', 'petrol', 'fuel', 'travel', 'fare', 'toll'
  ],
  'cat-wifi': [
    'wifi', 'wi-fi', 'recharge', 'mobile bill', 'airtel', 'jio', 'vi', 'data pack', 'broadband', 'internet'
  ],
  'cat-subs': [
    'netflix', 'spotify', 'youtube', 'prime', 'subscription', 'hotstar', 'chatgpt'
  ],
  'cat-shopping': [
    'shopping', 'shoes', 'clothes', 'shirt', 'pants', 'jacket', 'hoodie',
    'books', 'book', 'textbook', 'notes', 'photocopy', 'stationery', 'pen',
    'amazon', 'flipkart', 'myntra', 'zara', 'h&m'
  ],
  'cat-health': [
    'meds', 'medicine', 'medicines', 'doctor', 'clinic', 'pharmacy',
    'hospital', 'tablet', 'tablets', 'bandaid', 'health'
  ],
  'cat-rent': [
    'rent', 'hostel fee', 'room rent', 'hostel rent', 'pg rent', 'pg fee', 'landlord', 'electricity'
  ],
};

const ONE_OFF_KEYWORDS = [
  'shoes', 'jacket', 'textbook', 'textbooks', 'course', 'laptop', 'phone',
  'repair', 'trip', 'outfit', 'gift', 'headphones', 'spectacles', 'glasses',
  'bag', 'backpack', 'blazer', 'dentist', 'fee', 'fees'
];

/**
 * Extracts a numerical monetary amount from natural language.
 * Handles: "120", "₹120", "Rs 120", "120 rs", "1.5k", "2k", "120/-", "120 bucks"
 */
export function extractAmount(text: string): { amountPaise: number; rawMatched: string } | null {
  // 1. Matches "1.5k", "2k", "₹2.5k"
  const kPattern = /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i;
  const kMatch = text.match(kPattern);
  if (kMatch) {
    const num = parseFloat(kMatch[1]);
    if (!isNaN(num) && num > 0) {
      return {
        amountPaise: Math.round(num * 1000 * 100),
        rawMatched: kMatch[0],
      };
    }
  }

  // 2. Matches "₹1,800", "Rs. 250", "250/-", "120 bucks", "rs 120", "120 rs"
  const standardPattern = /(?:(?:₹|rs\.?|inr)\s*)?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?(?:\s*(?:\/-|rs\.?|inr|bucks))?\b/i;
  
  // To avoid matching plain years like 2026 or small day numbers unless preceded by currency or context,
  // we test standard currency regex
  const regex = /(?:(?:₹|rs\.?|inr)\s*(\d+(?:,\d+)*(?:\.\d+)?))|(?:(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:\/-|rs\.?|inr|bucks))|(?:(?:spent|paid|bought|cost|got|received|sent|for|of)\s*(?:(?:₹|rs\.?|inr)\s*)?(\d+(?:,\d+)*(?:\.\d+)?))/i;
  const regexMatch = text.match(regex);

  if (regexMatch) {
    const rawVal = regexMatch[1] || regexMatch[2] || regexMatch[3];
    const cleaned = rawVal.replace(/,/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) {
      return {
        amountPaise: Math.round(num * 100),
        rawMatched: regexMatch[0],
      };
    }
  }

  // Fallback: simple standalone number if input is very short (e.g. "chai 30", "120 auto")
  const simpleMatch = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (simpleMatch) {
    const num = parseFloat(simpleMatch[1]);
    // Avoid matching isolated years like 2024-2030 or days 1-31 if ambiguous
    if (!isNaN(num) && num > 0 && num !== 2026 && num !== 2025 && num !== 2024) {
      return {
        amountPaise: Math.round(num * 100),
        rawMatched: simpleMatch[0],
      };
    }
  }

  return null;
}

/**
 * Guesses the most appropriate category ID based on vocabulary keywords in the text.
 */
export function guessCategory(text: string): string {
  const normalized = text.toLowerCase();
  
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(normalized)) {
        return catId;
      }
    }
  }

  return 'cat-misc';
}

/**
 * Determines whether an expense should be initially flagged as a capital one-off purchase.
 */
export function isOneOffCandidate(text: string, amountPaise: number): boolean {
  const normalized = text.toLowerCase();

  // If amount is >= ₹1,000 (100,000 paise)
  if (amountPaise >= 100000) {
    return true;
  }

  // If explicit one-off keywords are found
  for (const kw of ONE_OFF_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Cleans extracted description by stripping action verbs and amounts.
 */
function cleanDescription(rawText: string, matchedAmountStr: string): string {
  let cleaned = rawText;
  
  // Remove matched amount substring
  cleaned = cleaned.replace(matchedAmountStr, ' ');

  // Remove common filler words & prepositions
  cleaned = cleaned.replace(/\b(spent|paid|bought|cost|got|for|on|in|to|at|rupees|rs|bucks|inr|then|another|also|and|a|an|i)\b/gi, ' ');
  
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return 'Expense';
}

/**
 * Main offline fallback intent parser.
 * Deterministic, ₹0 cost, zero API keys required.
 */
export function parseNaturalLanguageInput(rawInput: string): ParsedFinancialIntent {
  const trimmed = rawInput.trim();
  const lower = trimmed.toLowerCase();

  if (!trimmed) {
    return { intent: 'unknown', confidence: 0, rawInput };
  }

  // 1. Undo / Delete Intent
  const undoPatterns = [
    /\b(undo|cancel|revert)\b/i,
    /\b(delete|remove)\s+(that|last|it|transaction)\b/i,
    /^undo$/i,
    /^delete$/i,
  ];
  if (undoPatterns.some(pattern => pattern.test(lower))) {
    return {
      intent: 'undo_transaction',
      target: 'last',
      confidence: 0.95,
      rawInput,
    };
  }

  // 2. Correction Intent
  // e.g. "actually lunch was 150 not 180", "my bad, the lunch was 350", "it was 150 not 180", "correct to 150", "change that to 150"
  const hasCorrectionKeyword = /\b(actually|correction|change\s+to|change\s+that\s+to|correct\s+to|make\s+it|my\s+bad|wrong|mistake|sorry|oops)\b/i.test(lower) ||
                               /\b(?:not|instead\s+of)\s+(?:₹|rs\.?)?\s*\d+/i.test(lower);

  if (hasCorrectionKeyword) {
    // Extract target keyword if mentioned (e.g. "lunch", "auto", "chai", "dinner", "breakfast", etc.)
    const commonKeywords = ['lunch', 'chai', 'auto', 'dinner', 'breakfast', 'canteen', 'samosa', 'snacks', 'coffee', 'metro', 'bus', 'rent', 'wifi', 'recharge', 'notes', 'groceries'];
    const foundKeyword = commonKeywords.find(kw => lower.includes(kw));

    // Check for "X not Y" or "X instead of Y"
    const notMatch = lower.match(/(?:(?:₹|rs\.?)?\s*)(\d+(?:\.\d+)?)\s*(?:not|instead\s+of)\s*(?:(?:₹|rs\.?)?\s*)\d+/i);
    if (notMatch) {
      const correctVal = parseFloat(notMatch[1]);
      if (!isNaN(correctVal) && correctVal > 0) {
        return {
          intent: 'correct_transaction',
          target: 'last',
          targetKeyword: foundKeyword,
          newAmountPaise: Math.round(correctVal * 100),
          confidence: 0.95,
          rawInput,
        };
      }
    }

    // Check for general amount in a correction phrase
    const amountExtract = extractAmount(lower);
    if (amountExtract) {
      return {
        intent: 'correct_transaction',
        target: 'last',
        targetKeyword: foundKeyword,
        newAmountPaise: amountExtract.amountPaise,
        confidence: 0.9,
        rawInput,
      };
    }
  }

  // 3. Budget & Affordability Query Intent
  // e.g. "how much can i spend today?", "can i buy sneakers for 2500?", "will my money last?"
  const safeSpendPatterns = [
    /\bhow\s+much\s+(?:can|should)\s+i\s+spend\b/i,
    /\bdaily\s+(?:limit|budget|allowance|safe\s+spend)\b/i,
    /\bwhat\s+is\s+my\s+safe\s+(?:daily\s+)?spend\b/i,
  ];
  if (safeSpendPatterns.some(p => p.test(lower))) {
    return {
      intent: 'budget_query',
      queryType: 'safe_spend',
      confidence: 0.95,
      rawInput,
    };
  }

  const willMoneyLastPatterns = [
    /\bwill\s+(?:my\s+)?money\s+last\b/i,
    /\bwill\s+i\s+survive\b/i,
    /\bam\s+i\s+on\s+track\b/i,
    /\bhow\s+am\s+i\s+doing\b/i,
  ];
  if (willMoneyLastPatterns.some(p => p.test(lower))) {
    return {
      intent: 'budget_query',
      queryType: 'will_money_last',
      confidence: 0.95,
      rawInput,
    };
  }

  // Affordability check: "can i afford / buy X for [amount]?"
  const affordabilityPatterns = [
    /\bcan\s+i\s+(?:afford|buy|order|get|spend)\b/i,
    /\bshould\s+i\s+buy\b/i,
    /\bis\s+it\s+okay\s+to\s+buy\b/i,
  ];
  if (affordabilityPatterns.some(p => p.test(lower))) {
    const amountExtract = extractAmount(lower);
    return {
      intent: 'budget_query',
      queryType: 'affordability_check',
      targetAmountPaise: amountExtract ? amountExtract.amountPaise : undefined,
      confidence: 0.85,
      rawInput,
    };
  }

  // 4. Income / Allowance / Refund Intent
  const incomeKeywords = [
    'received', 'got', 'salary', 'allowance', 'credited', 'cashback',
    'refund', 'mom sent', 'dad sent', 'pocket money', 'gifted', 'repaid'
  ];
  const isIncome = incomeKeywords.some(kw => lower.includes(kw));
  if (isIncome) {
    const amountExtract = extractAmount(trimmed);
    if (amountExtract) {
      const isRefund = lower.includes('cashback') || lower.includes('refund') || lower.includes('repaid');
      const desc = isRefund ? 'Cashback / Refund' : (lower.includes('allowance') ? 'Monthly Allowance' : 'Income Received');
      return {
        intent: 'log_income',
        amountPaise: amountExtract.amountPaise,
        description: desc,
        isRefund,
        confidence: 0.9,
        rawInput,
      };
    }
  }

  // 5. Batch Expense Intent (Multiple expenses in a single message)
  // e.g. "i spent 20 on a samosa, then 40 on snacks and another 40 for coke"
  // e.g. "auto 50, lunch 120, chai 20"
  const delimiterRegex = /(?:\s*,\s*|\s+then\s+|\s+and\s+(?:another\s+)?|\s*\+\s*|\n|;)/i;
  const potentialClauses = trimmed.split(delimiterRegex).map(c => c.trim()).filter(Boolean);

  if (potentialClauses.length >= 2) {
    const batchItems: Array<{
      amountPaise: number;
      description: string;
      categoryGuess: string;
      isOneOff: boolean;
    }> = [];

    for (const clause of potentialClauses) {
      const amt = extractAmount(clause);
      if (amt) {
        batchItems.push({
          amountPaise: amt.amountPaise,
          description: cleanDescription(clause, amt.rawMatched),
          categoryGuess: guessCategory(clause),
          isOneOff: isOneOffCandidate(clause, amt.amountPaise),
        });
      }
    }

    if (batchItems.length >= 2) {
      const totalAmountPaise = batchItems.reduce((sum, item) => sum + item.amountPaise, 0);
      return {
        intent: 'log_batch_expenses',
        expenses: batchItems,
        totalAmountPaise,
        confidence: 0.9,
        rawInput,
      };
    }
  }

  // 6. Single Expense Intent (Standard Student Logging)
  // Extract amount
  const amountExtract = extractAmount(trimmed);
  if (amountExtract) {
    const category = guessCategory(trimmed);
    const isOneOff = isOneOffCandidate(trimmed, amountExtract.amountPaise);
    const cleanedDesc = cleanDescription(trimmed, amountExtract.rawMatched);

    return {
      intent: 'log_expense',
      amountPaise: amountExtract.amountPaise,
      description: cleanedDesc,
      categoryGuess: category,
      isOneOff,
      confidence: 0.85,
      rawInput,
    };
  }

  // Fallback for unrecognized phrases
  return {
    intent: 'unknown',
    confidence: 0,
    rawInput,
  };
}
