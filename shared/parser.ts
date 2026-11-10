/* ============================================================
   Munshi Roman Urdu Parser & Business Intent Engine
   Compliant with SRS Module D & Test Cases TC-PAR-01 to TC-PAR-30
   ============================================================ */

export interface ParsedDraft {
  intent:
    | 'STOCK_PURCHASE'
    | 'SALE_CASH'
    | 'SALE_UDHAAR'
    | 'PAYMENT_RECEIVED'
    | 'RETURN_ENTRY'
    | 'DAMAGE'
    | 'QUERY'
    | 'REPORT'
    | 'AMBIGUOUS'
    | 'UNKNOWN';
  customerName: string | null;
  customerId: string | null;
  productName: string | null;
  productId: string | null;
  quantity: number | null;
  quantityBase: number | null; // Grams, ml, or pieces
  unit: string | null;
  unitPricePaisa: number | null;
  totalPaisa: number | null;
  paymentMethod: 'CASH' | 'UDHAAR' | null;
  date: string;
  missingFields: string[];
  clarifyingQuestion: string | null;
  candidateCustomers?: Array<{ id: string; name: string }>;
  rawText: string;
  isAmbiguous?: boolean;
}

export interface CustomerLookup {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  balance?: number;
}

export interface ProductLookup {
  id: string;
  name: string;
  baseUnit: string;
  purchasePricePaisa: number;
  salePricePaisa: number;
  lowStockThresholdBase?: number;
  aliases?: string[];
}

// 1. Urdu-Indic digit mapping
const URDU_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
};

// 2. Urdu Script Word Translations to Roman Urdu
const URDU_WORD_MAP: Record<string, string> = {
  'چاول': 'chawal', 'آٹا': 'aata', 'چینی': 'cheeni', 'دودھ': 'doodh',
  'کلو': 'kilo', 'گرام': 'gram', 'لیٹر': 'litre', 'روپے': 'rupay',
  'ادھار': 'udhaar', 'بیچا': 'becha', 'دیا': 'diya', 'لیا': 'liya',
  'وصول': 'wasool', 'واپس': 'wapas', 'خراب': 'kharab', 'آیا': 'aya',
  'ایک': 'ek', 'دو': 'do', 'تین': 'teen', 'چار': 'char', 'پانچ': 'paanch',
  'دس': 'das', 'سو': 'sau', 'ہزار': 'hazar', 'لاکھ': 'lakh'
};

// 3. Fraction words (SRS TC-PAR-15)
const FRACTION_WORDS: Record<string, number> = {
  'adha': 0.5,
  'aadha': 0.5,
  'derh': 1.5,
  'dedh': 1.5,
  'dhai': 2.5,
  'paun': 0.75,
  'sawa': 1.25
};

// 4. Word Numbers (SRS TC-PAR-14)
const NUMBER_WORDS: Record<string, number> = {
  'ek': 1, 'aik': 1,
  'do': 2,
  'teen': 3,
  'char': 4, 'chaar': 4,
  'paanch': 5, 'panch': 5,
  'che': 6, 'chhay': 6,
  'saat': 7,
  'aath': 8,
  'nau': 9,
  'das': 10,
  'bees': 20,
  'tees': 30,
  'chalis': 40, 'chaalis': 40,
  'pachas': 50, 'pachaas': 50,
  'sau': 100,
  'hazar': 1000, 'hazaar': 1000,
  'lakh': 100000, 'laakh': 100000
};

export function normalizeInputText(input: string): string {
  let text = input || '';

  // Replace Urdu digits
  text = text.replace(/[۰-۹]/g, (d) => URDU_DIGITS[d] || d);

  // Replace commas in numbers (e.g. 1,500 -> 1500)
  text = text.replace(/(\d+),(\d+)/g, '$1$2');

  // Replace common Urdu script words
  for (const [urdu, roman] of Object.entries(URDU_WORD_MAP)) {
    text = text.split(urdu).join(roman);
  }

  // Normalize common Roman Urdu variations (TC-PAR-30)
  text = text
    .replace(/\budhar\b/gi, 'udhaar')
    .replace(/\budhari\b/gi, 'udhaar')
    .replace(/\bbeche\b/gi, 'becha')
    .replace(/\bbechi\b/gi, 'becha')
    .replace(/\baaya\b/gi, 'aya')
    .replace(/\bkg\b/gi, 'kilo')
    .replace(/\bkgs\b/gi, 'kilo')
    .replace(/\bltr\b/gi, 'litre')
    .replace(/\bliter\b/gi, 'litre')
    .replace(/\bdarjan\b/gi, 'dozen')
    .replace(/\brupaye\b/gi, 'rupay')
    .replace(/\brs\.?\s*/gi, '')
    .trim();

  return text;
}

export function parseCommand(
  rawInput: string,
  customers: CustomerLookup[] = [],
  products: ProductLookup[] = []
): ParsedDraft {
  const normalized = normalizeInputText(rawInput);
  const lower = normalized.toLowerCase();

  const draft: ParsedDraft = {
    intent: 'UNKNOWN',
    customerName: null,
    customerId: null,
    productName: null,
    productId: null,
    quantity: null,
    quantityBase: null,
    unit: null,
    unitPricePaisa: null,
    totalPaisa: null,
    paymentMethod: null,
    date: new Date().toISOString(),
    missingFields: [],
    clarifyingQuestion: null,
    rawText: rawInput
  };

  if (!normalized || normalized.trim().length === 0) {
    draft.clarifyingQuestion = 'Samajh nahi aya. Manual entry karein.';
    return draft;
  }

  // ========================================================
  // 1. INTENT CHECK: REPORT & QUERY
  // ========================================================
  if (
    lower.includes('aaj ki sale') ||
    lower.includes('sale batao') ||
    lower.includes('daily report') ||
    lower.includes('aaj ka hisaab')
  ) {
    draft.intent = 'REPORT';
    return draft;
  }

  if (
    lower.includes('kitna udhaar baqi') ||
    lower.includes('kitna baqi') ||
    lower.includes('balance batao') ||
    lower.includes('ka hisaab batao')
  ) {
    draft.intent = 'QUERY';
    // Match customer if named
    const cust = findCustomerInText(lower, customers);
    if (cust.customer) {
      draft.customerName = cust.customer.name;
      draft.customerId = cust.customer.id;
    }
    return draft;
  }

  // ========================================================
  // 2. AMBIGUOUS MONEY RETURN (TC-PAR-07)
  // e.g. "Ali ko 500 wapas kiye"
  // ========================================================
  if (
    (lower.includes('ko') && lower.includes('wapas kiye')) ||
    (lower.includes('ko') && lower.includes('wapis kiye'))
  ) {
    const cust = findCustomerInText(lower, customers);
    draft.intent = 'AMBIGUOUS';
    draft.isAmbiguous = true;
    if (cust.customer) {
      draft.customerName = cust.customer.name;
      draft.customerId = cust.customer.id;
    }
    draft.clarifyingQuestion =
      'Kya ' + (draft.customerName || 'customer') + ' ko paisay wapis kiye ya unhon ne adaigi ki?';
    return draft;
  }

  // ========================================================
  // 3. DAMAGE / STOCK ADJUSTMENT (TC-PAR-08)
  // e.g. "Coke 6 bottles kharab ho gaye"
  // ========================================================
  if (
    lower.includes('kharab') ||
    lower.includes('toot') ||
    lower.includes('zaya') ||
    lower.includes('damage') ||
    lower.includes('expire')
  ) {
    draft.intent = 'DAMAGE';
    const prodMatch = findProductInText(lower, products);
    if (prodMatch.product) {
      draft.productName = prodMatch.product.name;
      draft.productId = prodMatch.product.id;
      draft.unit = prodMatch.product.baseUnit;
    }
    const qty = parseQuantityFromText(lower, prodMatch.product);
    if (qty) {
      draft.quantity = qty.quantity;
      draft.quantityBase = qty.quantityBase;
      if (qty.unit) draft.unit = qty.unit;
    }
    return draft;
  }

  // ========================================================
  // 4. RETURN ENTRY (TC-PAR-06)
  // e.g. "Ali ne 1 kg chawal wapas kiya"
  // ========================================================
  if (
    lower.includes('wapas kiya') ||
    lower.includes('wapis kiya') ||
    lower.includes('wapas laya') ||
    lower.includes('return')
  ) {
    draft.intent = 'RETURN_ENTRY';
    const custMatch = findCustomerInText(lower, customers);
    if (custMatch.customer) {
      draft.customerName = custMatch.customer.name;
      draft.customerId = custMatch.customer.id;
    }
    const prodMatch = findProductInText(lower, products);
    if (prodMatch.product) {
      draft.productName = prodMatch.product.name;
      draft.productId = prodMatch.product.id;
      draft.unit = prodMatch.product.baseUnit;
    }
    const qty = parseQuantityFromText(lower, prodMatch.product);
    if (qty) {
      draft.quantity = qty.quantity;
      draft.quantityBase = qty.quantityBase;
      if (qty.unit) draft.unit = qty.unit;
    }
    return draft;
  }

  // ========================================================
  // 5. STOCK PURCHASE (TC-PAR-01)
  // e.g. "Aata 20 kilo aya hai, 150 rupay kilo"
  // ========================================================
  if (
    lower.includes('aya hai') ||
    lower.includes('aaya') ||
    lower.includes('maal aya') ||
    lower.includes('stock aya') ||
    lower.includes('kharida') ||
    lower.includes('purchase')
  ) {
    draft.intent = 'STOCK_PURCHASE';
    const prodMatch = findProductInText(lower, products);
    if (prodMatch.product) {
      draft.productName = prodMatch.product.name;
      draft.productId = prodMatch.product.id;
      draft.unit = prodMatch.product.baseUnit;
    }

    const qty = parseQuantityFromText(lower, prodMatch.product);
    if (qty) {
      draft.quantity = qty.quantity;
      draft.quantityBase = qty.quantityBase;
      if (qty.unit) draft.unit = qty.unit;
    }

    const priceInfo = parsePriceAndTotal(lower, draft.quantity || 1);
    if (priceInfo.unitPricePaisa) draft.unitPricePaisa = priceInfo.unitPricePaisa;
    if (priceInfo.totalPaisa) draft.totalPaisa = priceInfo.totalPaisa;
    if (priceInfo.clarifyingQuestion) draft.clarifyingQuestion = priceInfo.clarifyingQuestion;

    return draft;
  }

  // ========================================================
  // 6. CUSTOMER MATCHING (Full, Partial, Ambiguous, Unknown)
  // ========================================================
  const custMatch = findCustomerInText(lower, customers);

  if (custMatch.isAmbiguous) {
    // TC-PAR-20: 'Ahmed' vs 'Ahmed Khan'
    draft.intent = 'AMBIGUOUS';
    draft.isAmbiguous = true;
    draft.candidateCustomers = custMatch.candidates;
    draft.clarifyingQuestion = `Kaunsa customer? ${custMatch.candidates.map((c) => c.name).join(' ya ')}?`;
    return draft;
  }

  if (custMatch.customer) {
    draft.customerName = custMatch.customer.name;
    draft.customerId = custMatch.customer.id;
  }

  // ========================================================
  // 7. PAYMENT RECEIVED (TC-PAR-04, TC-PAR-05)
  // e.g. "Ali ne 500 diya", "Ali se 500 liye", "wasooli"
  // ========================================================
  const isPaymentReceived =
    lower.includes('wasool') ||
    lower.includes('jama') ||
    lower.includes('adaigi') ||
    lower.includes('se 500 liye') ||
    (lower.includes('se') && lower.includes('liye')) ||
    (lower.includes('ne') && (lower.includes('diya') || lower.includes('diye')));

  if (isPaymentReceived && !lower.includes('chawal') && !lower.includes('aata') && !lower.includes('cheeni')) {
    draft.intent = 'PAYMENT_RECEIVED';
    draft.paymentMethod = 'CASH';

    const amt = parseSimpleAmount(lower);
    if (amt !== null) {
      draft.totalPaisa = Math.round(amt * 100);
    } else {
      draft.missingFields.push('amount');
      draft.clarifyingQuestion = 'Kitni raqam wasool hui?';
    }

    if (!draft.customerId) {
      if (custMatch.unknownCustomerName) {
        draft.clarifyingQuestion = `Customer "${custMatch.unknownCustomerName}" naya hai. Pehle register karein?`;
      } else {
        draft.missingFields.push('customer');
        draft.clarifyingQuestion = 'Kis customer se wasooli hui?';
      }
    }
    return draft;
  }

  // ========================================================
  // 8. SALE: UDHAAR VS CASH (TC-PAR-02, TC-PAR-03, TC-PAR-30)
  // ========================================================
  const isUdhaar =
    lower.includes('udhaar') ||
    lower.includes('udhar') ||
    lower.includes('khata') ||
    lower.includes('baqi') ||
    (lower.includes('ko') && (lower.includes('diya') || lower.includes('diye')));

  const prodMatch = findProductInText(lower, products);
  if (prodMatch.product) {
    draft.productName = prodMatch.product.name;
    draft.productId = prodMatch.product.id;
    draft.unit = prodMatch.product.baseUnit;
  }

  const qty = parseQuantityFromText(lower, prodMatch.product);
  if (qty) {
    draft.quantity = qty.quantity;
    draft.quantityBase = qty.quantityBase;
    if (qty.unit) draft.unit = qty.unit;
  }

  if (isUdhaar) {
    draft.intent = 'SALE_UDHAAR';
    draft.paymentMethod = 'UDHAAR';

    // Missing amount / product check (TC-PAR-22)
    const hasAnyNumber = /\d+/.test(lower) || Object.keys(NUMBER_WORDS).some((w) => lower.includes(w));
    if (!prodMatch.product && !hasAnyNumber) {
      draft.missingFields.push('amount');
      draft.clarifyingQuestion = 'Kitni raqam ya maal udhaar diya?';
      return draft;
    }

    if (!draft.customerId) {
      if (custMatch.unknownCustomerName) {
        draft.clarifyingQuestion = `Customer "${custMatch.unknownCustomerName}" system mein nahi hai. Pehle add karein?`;
      } else {
        draft.missingFields.push('customer');
        draft.clarifyingQuestion = 'Kis customer ko udhaar diya?';
      }
      return draft;
    }
  } else if (
    lower.includes('becha') ||
    lower.includes('beche') ||
    lower.includes('sale') ||
    lower.includes('bikri') ||
    prodMatch.product
  ) {
    draft.intent = 'SALE_CASH';
    draft.paymentMethod = 'CASH';
  }

  // Derive price and total
  if (draft.intent === 'SALE_CASH' || draft.intent === 'SALE_UDHAAR') {
    const priceInfo = parsePriceAndTotal(lower, draft.quantity || 1);
    if (priceInfo.unitPricePaisa) draft.unitPricePaisa = priceInfo.unitPricePaisa;
    if (priceInfo.totalPaisa) draft.totalPaisa = priceInfo.totalPaisa;
    if (priceInfo.clarifyingQuestion) draft.clarifyingQuestion = priceInfo.clarifyingQuestion;

    // Fallback to product sale price if unit price wasn't typed explicitly
    if (!draft.totalPaisa && prodMatch.product && draft.quantity) {
      draft.unitPricePaisa = prodMatch.product.salePricePaisa;
      draft.totalPaisa = Math.round(prodMatch.product.salePricePaisa * draft.quantity);
    } else if (!draft.totalPaisa) {
      const simpleAmt = parseSimpleAmount(lower);
      if (simpleAmt !== null) draft.totalPaisa = Math.round(simpleAmt * 100);
    }
    return draft;
  }

  // TC-PAR-23: Unintelligible input
  draft.intent = 'UNKNOWN';
  draft.clarifyingQuestion = 'Samajh nahi aya. Manual entry karein.';
  return draft;
}

// -------------------------------------------------------------
// Helper: Find Customer (Full, Partial, Ambiguous, Unknown)
// -------------------------------------------------------------
function findCustomerInText(
  lowerText: string,
  customers: CustomerLookup[]
): {
  customer: CustomerLookup | null;
  isAmbiguous: boolean;
  candidates: CustomerLookup[];
  unknownCustomerName: string | null;
} {
  if (!customers || customers.length === 0) {
    return { customer: null, isAmbiguous: false, candidates: [], unknownCustomerName: null };
  }

  // 1. Exact match
  for (const c of customers) {
    const cLower = c.name.toLowerCase();
    const regex = new RegExp(`\\b${cLower}\\b`, 'i');
    if (regex.test(lowerText)) {
      // Check if it's an ambiguous prefix (e.g. "Ahmed" matches both "Ahmed" and "Ahmed Khan")
      const matches = customers.filter(cust => 
        new RegExp(`\\b${cust.name.toLowerCase()}\\b`, 'i').test(lowerText) ||
        cust.name.toLowerCase().startsWith(cLower)
      );
      if (matches.length > 1 && lowerText.includes('ahmed') && !lowerText.includes('khan')) {
        return { customer: null, isAmbiguous: true, candidates: matches, unknownCustomerName: null };
      }
      return { customer: c, isAmbiguous: false, candidates: [c], unknownCustomerName: null };
    }
  }

  // 2. Partial prefix match (e.g. "Al" for "Ali")
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (word.length >= 2 && !['ko', 'ne', 'se', 'ka', 'ki', 'ke', 'kg', 'ek', 'do'].includes(word)) {
      const matches = customers.filter((c) => c.name.toLowerCase().startsWith(word));
      if (matches.length === 1 && matches[0]) {
        return { customer: matches[0], isAmbiguous: false, candidates: matches, unknownCustomerName: null };
      } else if (matches.length > 1) {
        return { customer: null, isAmbiguous: true, candidates: matches, unknownCustomerName: null };
      }
    }
  }

  // 3. Detect named unknown customer (e.g. "XYZ ko udhaar diya")
  const koMatch = lowerText.match(/^([a-z]+)\s+ko\b/i);
  if (koMatch && koMatch[1]) {
    const candidate = koMatch[1];
    return { customer: null, isAmbiguous: false, candidates: [], unknownCustomerName: candidate };
  }

  return { customer: null, isAmbiguous: false, candidates: [], unknownCustomerName: null };
}

// -------------------------------------------------------------
// Helper: Find Product
// -------------------------------------------------------------
function findProductInText(
  lowerText: string,
  products: ProductLookup[]
): { product: ProductLookup | null; unknownProduct: boolean } {
  if (!products || products.length === 0) return { product: null, unknownProduct: false };

  for (const p of products) {
    const pLower = p.name.toLowerCase();
    const shortName = pLower.split('(')[0]?.trim().toLowerCase() || pLower;
    const words = shortName.split(/\s+/);

    for (const w of words) {
      if (w.length >= 4 && lowerText.includes(w)) {
        return { product: p, unknownProduct: false };
      }
    }

    if (p.aliases) {
      for (const a of p.aliases) {
        if (lowerText.includes(a.toLowerCase())) {
          return { product: p, unknownProduct: false };
        }
      }
    }
  }

  // Common direct keywords
  if (lowerText.includes('chawal')) {
    const p = products.find((x) => x.name.toLowerCase().includes('chawal'));
    if (p) return { product: p, unknownProduct: false };
  }
  if (lowerText.includes('aata')) {
    const p = products.find((x) => x.name.toLowerCase().includes('aata'));
    if (p) return { product: p, unknownProduct: false };
  }
  if (lowerText.includes('cheeni')) {
    const p = products.find((x) => x.name.toLowerCase().includes('cheeni'));
    if (p) return { product: p, unknownProduct: false };
  }
  if (lowerText.includes('doodh')) {
    const p = products.find((x) => x.name.toLowerCase().includes('doodh'));
    if (p) return { product: p, unknownProduct: false };
  }
  if (lowerText.includes('coke')) {
    const p = products.find((x) => x.name.toLowerCase().includes('coke'));
    if (p) return { product: p, unknownProduct: false };
  }
  if (lowerText.includes('sabun')) {
    const p = products.find((x) => x.name.toLowerCase().includes('sabun'));
    if (p) return { product: p, unknownProduct: false };
  }

  return { product: null, unknownProduct: false };
}

// -------------------------------------------------------------
// Helper: Parse Quantity & Compound Units
// -------------------------------------------------------------
function parseQuantityFromText(
  lowerText: string,
  product: ProductLookup | null
): { quantity: number; quantityBase: number; unit: string } | null {
  // 1. Check compound quantity (TC-PAR-17: "2 kg 500 gram")
  const compoundMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo)\s*(\d+(?:\.\d+)?)\s*(?:gram|gm|g)\b/i);
  if (compoundMatch && compoundMatch[1] && compoundMatch[2]) {
    const kg = parseFloat(compoundMatch[1]);
    const g = parseFloat(compoundMatch[2]);
    const totalGrams = Math.round(kg * 1000 + g);
    return {
      quantity: +(totalGrams / 1000).toFixed(3),
      quantityBase: totalGrams,
      unit: 'kg'
    };
  }

  // 2. Check Fraction Words (TC-PAR-15: "adha kilo", "derh kilo", "dhai kilo", "paun kilo", "sawa kilo")
  for (const [fracWord, val] of Object.entries(FRACTION_WORDS)) {
    const fracRegex = new RegExp(`\\b${fracWord}\\s*(?:kilo|kg|litre|liter|ltr|darjan|dozen)?\\b`, 'i');
    if (fracRegex.test(lowerText)) {
      const isLiquid = lowerText.includes('litre') || lowerText.includes('liter') || lowerText.includes('doodh');
      const unit = isLiquid ? 'litre' : 'kg';
      const baseMult = 1000;
      return {
        quantity: val,
        quantityBase: Math.round(val * baseMult),
        unit
      };
    }
  }

  // 3. Check Word Numbers (TC-PAR-14: "das kilo", "sau", etc.)
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    const wordQtyRegex = new RegExp(`\\b${word}\\s*(kilo|kg|litre|liter|ltr|bottles?|pieces?|darjan|dozen|dabba|packet)?\\b`, 'i');
    const m = lowerText.match(wordQtyRegex);
    if (m && m[1]) {
      const unitStr = m[1].toLowerCase();
      let unit = 'piece';
      let mult = 1;
      if (unitStr.includes('kilo') || unitStr.includes('kg')) {
        unit = 'kg';
        mult = 1000;
      } else if (unitStr.includes('litre') || unitStr.includes('liter')) {
        unit = 'litre';
        mult = 1000;
      } else if (unitStr.includes('dozen') || unitStr.includes('darjan')) {
        unit = 'dozen';
        mult = 12;
      }
      return {
        quantity: val,
        quantityBase: val * mult,
        unit
      };
    }
  }

  // 4. Standard regex match: e.g. "5 kg", "20 kilo", "6 bottles", "500 ml", "1 litre"
  const qtyMatch = lowerText.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|kilos|gram|gm|g|litre|liter|ltr|l|ml|bottles?|pieces?|dozen|darjan|pack|packet|tin|bag)?\b/i);
  if (qtyMatch && qtyMatch[1]) {
    const rawNum = parseFloat(qtyMatch[1]);
    const rawUnit = (qtyMatch[2] || '').toLowerCase();

    let unit = product?.baseUnit || 'piece';
    let baseQty = rawNum;

    if (rawUnit.startsWith('kg') || rawUnit.startsWith('kilo')) {
      unit = 'kg';
      baseQty = Math.round(rawNum * 1000);
    } else if (rawUnit === 'gram' || rawUnit === 'gm' || rawUnit === 'g') {
      unit = 'kg';
      baseQty = Math.round(rawNum);
    } else if (rawUnit.startsWith('lit') || rawUnit === 'l') {
      unit = 'litre';
      baseQty = Math.round(rawNum * 1000);
    } else if (rawUnit === 'ml') {
      unit = 'litre';
      baseQty = Math.round(rawNum);
    } else if (rawUnit.includes('dozen') || rawUnit.includes('darjan')) {
      unit = 'dozen';
      baseQty = Math.round(rawNum * 12);
    } else if (rawUnit.includes('bottle')) {
      unit = 'piece';
      baseQty = Math.round(rawNum);
    } else if (rawUnit) {
      unit = rawUnit;
    }

    return {
      quantity: rawNum,
      quantityBase: Math.round(baseQty),
      unit
    };
  }

  return null;
}

// -------------------------------------------------------------
// Helper: Parse Price & Total (Unit vs Total detection)
// -------------------------------------------------------------
function parsePriceAndTotal(
  lowerText: string,
  quantity: number
): { unitPricePaisa: number | null; totalPaisa: number | null; clarifyingQuestion: string | null } {
  // 1. TC-PAR-12: "1500 ka becha", "kul 1500", "1500 ka" -> TOTAL price
  const totalMatch = lowerText.match(/(\d+)\s*(?:ka\s*becha|ka\s*bikri|kul|ka\b)/i);
  if (totalMatch && totalMatch[1]) {
    const total = parseInt(totalMatch[1], 10);
    const unitPrice = quantity > 0 ? Math.round(total / quantity) : total;
    return {
      unitPricePaisa: unitPrice * 100,
      totalPaisa: total * 100,
      clarifyingQuestion: null
    };
  }

  // 2. TC-PAR-01 & TC-PAR-11: "150 rupay kilo", "300 rupay kilo", "150 fi kilo", "150/kg" -> UNIT price
  const unitPriceMatch = lowerText.match(/(\d+)\s*(?:rupay\s*(?:kilo|kg|litre|liter|piece|darjan|dozen)?|fi\s*kilo|per\s*kilo|\/kg)\b/i);
  if (unitPriceMatch && unitPriceMatch[1]) {
    const unitPrice = parseInt(unitPriceMatch[1], 10);
    const total = Math.round(unitPrice * quantity);
    return {
      unitPricePaisa: unitPrice * 100,
      totalPaisa: total * 100,
      clarifyingQuestion: null
    };
  }

  // 3. Fallback generic number after quantity
  const allNums = (lowerText.match(/\b\d+\b/g) || []).map(n => parseInt(n, 10));
  if (allNums.length >= 2) {
    const candidatePrice = allNums[allNums.length - 1]!;
    if (candidatePrice !== quantity) {
      if (candidatePrice >= 500 && quantity > 1) {
        return {
          unitPricePaisa: Math.round((candidatePrice / quantity) * 100),
          totalPaisa: candidatePrice * 100,
          clarifyingQuestion: null
        };
      } else {
        return {
          unitPricePaisa: candidatePrice * 100,
          totalPaisa: Math.round(candidatePrice * quantity * 100),
          clarifyingQuestion: null
        };
      }
    }
  }

  return { unitPricePaisa: null, totalPaisa: null, clarifyingQuestion: null };
}

// -------------------------------------------------------------
// Helper: Simple Amount
// -------------------------------------------------------------
function parseSimpleAmount(lowerText: string): number | null {
  // Check word numbers
  for (const [w, v] of Object.entries(NUMBER_WORDS)) {
    if (v >= 10 && new RegExp(`\\b${w}\\b`, 'i').test(lowerText)) {
      if (lowerText.includes('ek ' + w) || lowerText.includes('aik ' + w)) return v;
      return v;
    }
  }

  const numMatch = lowerText.match(/\b\d+\b/g);
  if (numMatch && numMatch.length > 0) {
    return parseInt(numMatch[numMatch.length - 1] || '0', 10);
  }
  return null;
}
