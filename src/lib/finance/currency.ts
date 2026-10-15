/**
 * Currency Utility Functions
 * 
 * Safe handling of Indian Rupee (INR) calculations.
 * Always handles internal math in minor units (paise: 1 INR = 100 paise).
 */

/**
 * Converts a rupee float (e.g. 120.50) to integer paise (e.g. 12050).
 * Uses Math.round to avoid standard float representation glitches.
 */
export function rupeesToPaise(rupees: number): number {
  if (isNaN(rupees) || !isFinite(rupees)) {
    throw new Error(`Invalid rupee amount: ${rupees}`);
  }
  return Math.round(rupees * 100);
}

/**
 * Converts integer paise (e.g. 12050) back to rupees (e.g. 120.50).
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Formats paise as an Indian Rupee string using Indian numbering formatting.
 * E.g. 150000 paise -> "₹1,500"
 * E.g. 15050 paise -> "₹150.50"
 */
export function formatPaiseToINR(
  paise: number,
  options: { includeSymbol?: boolean; forceDecimals?: boolean } = {}
): string {
  const { includeSymbol = true, forceDecimals = false } = options;
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = paiseToRupees(absPaise);
  
  const hasDecimals = absPaise % 100 !== 0 || forceDecimals;
  
  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);

  if (!includeSymbol) {
    return isNegative ? `-${formattedNumber}` : formattedNumber;
  }
  return isNegative ? `-₹${formattedNumber}` : `₹${formattedNumber}`;
}

/**
 * Convenient alias for formatPaiseToINR
 */
export const formatRupees = formatPaiseToINR;

/**
 * Parses user input strings like "500", "₹120", "1,250.50", "45 rs" into integer paise.
 * Returns null if input is completely invalid or negative.
 */
export function parseCurrencyInput(rawInput: string): number | null {
  if (!rawInput || typeof rawInput !== 'string') return null;

  // Clean out currency symbols, whitespace, and commas
  const cleaned = rawInput
    .replace(/[₹\s,]|rs\.?|inr|rupees/gi, '')
    .trim();

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  return rupeesToPaise(parsed);
}
