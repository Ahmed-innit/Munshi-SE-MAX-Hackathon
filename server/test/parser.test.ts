import { describe, it, expect } from 'vitest';
import { parseCommand, normalizeInputText } from '../src/services/parserService';

// Seed data from SRS Section 1.5
const mockProducts = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Basmati Chawal', baseUnit: 'kg', purchasePricePaisa: 25000, salePricePaisa: 30000 },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Aata', baseUnit: 'kg', purchasePricePaisa: 12000, salePricePaisa: 15000 },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Cheeni', baseUnit: 'kg', purchasePricePaisa: 16000, salePricePaisa: 18000 },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Doodh', baseUnit: 'litre', purchasePricePaisa: 18000, salePricePaisa: 20000 },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Coke bottle', baseUnit: 'piece', purchasePricePaisa: 8000, salePricePaisa: 10000 },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Sabun packet', baseUnit: 'packet', purchasePricePaisa: 10000, salePricePaisa: 12000 }
];

const mockCustomers = [
  { id: '00000000-0000-4000-8000-000000000101', name: 'Ali', phone: '0300-1111111' },
  { id: '00000000-0000-4000-8000-000000000102', name: 'Ahmed', phone: '0300-2222222' },
  { id: '00000000-0000-4000-8000-000000000103', name: 'Ahmed Khan', phone: '0300-3333333' },
  { id: '00000000-0000-4000-8000-000000000104', name: 'Bilal', phone: '0300-4444444' }
];

describe('Munshi Roman Urdu Parser (SRS Module D Test Cases)', () => {
  // TC-PAR-01: 'Aata 20 kilo aya hai, 150 rupay kilo'
  it('TC-PAR-01: parses stock purchase with product, quantity and unit price', () => {
    const draft = parseCommand('Aata 20 kilo aya hai, 150 rupay kilo', mockCustomers, mockProducts);
    expect(draft.intent).toBe('STOCK_PURCHASE');
    expect(draft.productName).toContain('Aata');
    expect(draft.quantity).toBe(20);
    expect(draft.quantityBase).toBe(20000);
    expect(draft.unitPricePaisa).toBe(15000); // 150 PKR
  });

  // TC-PAR-02: 'Chawal 5 kg becha, 300 rupay kilo'
  it('TC-PAR-02: parses cash sale without customer, 300 rupay kilo', () => {
    const draft = parseCommand('Chawal 5 kg becha, 300 rupay kilo', mockCustomers, mockProducts);
    expect(draft.intent).toBe('SALE_CASH');
    expect(draft.customerName).toBeNull();
    expect(draft.productName).toContain('Chawal');
    expect(draft.quantity).toBe(5);
    expect(draft.totalPaisa).toBe(150000); // 1500 PKR
  });

  // TC-PAR-03: 'Ali ko 2 kg chawal udhaar par diya'
  it('TC-PAR-03: parses udhaar sale with customer and product', () => {
    const draft = parseCommand('Ali ko 2 kg chawal udhaar par diya', mockCustomers, mockProducts);
    expect(draft.intent).toBe('SALE_UDHAAR');
    expect(draft.customerName).toBe('Ali');
    expect(draft.productName).toContain('Chawal');
    expect(draft.quantity).toBe(2);
    expect(draft.paymentMethod).toBe('UDHAAR');
  });

  // TC-PAR-04: 'Ali ne 500 diya'
  it('TC-PAR-04: parses payment received (ne ... diya)', () => {
    const draft = parseCommand('Ali ne 500 diya', mockCustomers, mockProducts);
    expect(draft.intent).toBe('PAYMENT_RECEIVED');
    expect(draft.customerName).toBe('Ali');
    expect(draft.totalPaisa).toBe(50000); // 500 PKR
  });

  // TC-PAR-05: 'Ali se 500 liye'
  it('TC-PAR-05: parses payment received (se ... liye)', () => {
    const draft = parseCommand('Ali se 500 liye', mockCustomers, mockProducts);
    expect(draft.intent).toBe('PAYMENT_RECEIVED');
    expect(draft.customerName).toBe('Ali');
    expect(draft.totalPaisa).toBe(50000);
  });

  // TC-PAR-06: 'Ali ne 1 kg chawal wapas kiya'
  it('TC-PAR-06: parses goods return', () => {
    const draft = parseCommand('Ali ne 1 kg chawal wapas kiya', mockCustomers, mockProducts);
    expect(draft.intent).toBe('RETURN_ENTRY');
    expect(draft.customerName).toBe('Ali');
    expect(draft.productName).toContain('Chawal');
    expect(draft.quantity).toBe(1);
  });

  // TC-PAR-07: 'Ali ko 500 wapas kiye' (ambiguous direction)
  it('TC-PAR-07: asks clarifying question for ambiguous money return', () => {
    const draft = parseCommand('Ali ko 500 wapas kiye', mockCustomers, mockProducts);
    expect(draft.intent).toBe('AMBIGUOUS');
    expect(draft.clarifyingQuestion).toBeTruthy();
  });

  // TC-PAR-08: 'Coke 6 bottles kharab ho gaye'
  it('TC-PAR-08: parses damage entry', () => {
    const draft = parseCommand('Coke 6 bottles kharab ho gaye', mockCustomers, mockProducts);
    expect(draft.intent).toBe('DAMAGE');
    expect(draft.productName).toContain('Coke');
    expect(draft.quantity).toBe(6);
  });

  // TC-PAR-09: 'Ali ka kitna udhaar baqi hai?'
  it('TC-PAR-09: parses query intent', () => {
    const draft = parseCommand('Ali ka kitna udhaar baqi hai?', mockCustomers, mockProducts);
    expect(draft.intent).toBe('QUERY');
    expect(draft.customerName).toBe('Ali');
  });

  // TC-PAR-10: 'Aaj ki sale batao'
  it('TC-PAR-10: parses report intent', () => {
    const draft = parseCommand('Aaj ki sale batao', mockCustomers, mockProducts);
    expect(draft.intent).toBe('REPORT');
  });

  // TC-PAR-11: 'Chawal 5 kg becha, 150 rupay kilo' (unit price)
  it('TC-PAR-11: parses unit price and computes total', () => {
    const draft = parseCommand('Chawal 5 kg becha, 150 rupay kilo', mockCustomers, mockProducts);
    expect(draft.unitPricePaisa).toBe(15000);
    expect(draft.totalPaisa).toBe(75000); // 5 * 150 = 750 PKR
  });

  // TC-PAR-12: 'Chawal 5 kg 1500 ka becha' (total price)
  it('TC-PAR-12: parses total price and derives unit price', () => {
    const draft = parseCommand('Chawal 5 kg 1500 ka becha', mockCustomers, mockProducts);
    expect(draft.totalPaisa).toBe(150000); // 1500 PKR
    expect(draft.unitPricePaisa).toBe(30000); // 1500 / 5 = 300 PKR
  });

  // TC-PAR-14: number words (das, sau, ek hazar, lakh)
  it('TC-PAR-14: parses number words correctly', () => {
    const d1 = parseCommand('das kilo aata aya', mockCustomers, mockProducts);
    expect(d1.quantity).toBe(10);

    const d2 = parseCommand('sau rupay Ali ne diya', mockCustomers, mockProducts);
    expect(d2.totalPaisa).toBe(10000); // 100 PKR

    const d3 = parseCommand('Ali ko ek hazar udhaar diya', mockCustomers, mockProducts);
    expect(d3.totalPaisa).toBe(100000); // 1,000 PKR
  });

  // TC-PAR-15: fraction words (adha, derh, dhai, paun, sawa)
  it('TC-PAR-15: parses fraction words into correct base units', () => {
    expect(parseCommand('adha kilo cheeni becha', mockCustomers, mockProducts).quantityBase).toBe(500);
    expect(parseCommand('derh kilo chawal becha', mockCustomers, mockProducts).quantityBase).toBe(1500);
    expect(parseCommand('dhai kilo aata becha', mockCustomers, mockProducts).quantityBase).toBe(2500);
    expect(parseCommand('paun kilo cheeni becha', mockCustomers, mockProducts).quantityBase).toBe(750);
    expect(parseCommand('sawa kilo chawal becha', mockCustomers, mockProducts).quantityBase).toBe(1250);
  });

  // TC-PAR-16: Urdu digits & comma formatting
  it('TC-PAR-16: normalizes Urdu digits and comma-separated amounts', () => {
    const text = normalizeInputText('Ali ko ۱,۵۰۰ udhaar diya');
    expect(text).toContain('1500');
    const draft = parseCommand('Ali ko ۱,۵۰۰ udhaar diya', mockCustomers, mockProducts);
    expect(draft.totalPaisa).toBe(150000);
  });

  // TC-PAR-17: compound quantity (2 kg 500 gram)
  it('TC-PAR-17: parses compound quantity (2 kg 500 gram = 2500 g)', () => {
    const draft = parseCommand('Aata 2 kg 500 gram aya hai', mockCustomers, mockProducts);
    expect(draft.quantityBase).toBe(2500);
    expect(draft.quantity).toBe(2.5);
  });

  // TC-PAR-19: partial name match (Al -> Ali)
  it('TC-PAR-19: matches single partial customer name (Al -> Ali)', () => {
    const draft = parseCommand('Al ko 500 udhar diya', mockCustomers, mockProducts);
    expect(draft.customerName).toBe('Ali');
  });

  // TC-PAR-20: ambiguous customer match (Ahmed vs Ahmed Khan)
  it('TC-PAR-20: asks clarifying question when multiple customers match', () => {
    const draft = parseCommand('Ahmed ko 500 udhar diya', mockCustomers, mockProducts);
    expect(draft.intent).toBe('AMBIGUOUS');
    expect(draft.candidateCustomers?.length).toBe(2);
    expect(draft.clarifyingQuestion).toContain('Ahmed');
  });

  // TC-PAR-22: missing fields question (does not guess Rs 500)
  it('TC-PAR-22: asks for missing amount without guessing Rs 500', () => {
    const draft = parseCommand('Bilal ko udhaar diya', mockCustomers, mockProducts);
    expect(draft.missingFields).toContain('amount');
    expect(draft.clarifyingQuestion).toBeTruthy();
  });

  // TC-PAR-23: unintelligible text
  it('TC-PAR-23: handles unintelligible text gracefully', () => {
    const draft = parseCommand('random xyz gibberish words', mockCustomers, mockProducts);
    expect(draft.intent).toBe('UNKNOWN');
    expect(draft.clarifyingQuestion).toContain('Manual entry');
  });

  // TC-PAR-30: spelling variants (udhar instead of udhaar, beche instead of becha)
  it('TC-PAR-30: recognizes "udhar" as "udhaar" and "beche" as "becha"', () => {
    const d1 = parseCommand('Ali ko 500 udhar diya', mockCustomers, mockProducts);
    expect(d1.intent).toBe('SALE_UDHAAR');
    expect(d1.customerName).toBe('Ali');
    expect(d1.totalPaisa).toBe(50000);

    const d2 = parseCommand('Chawal 2 kg beche', mockCustomers, mockProducts);
    expect(d2.intent).toBe('SALE_CASH');
  });
});
