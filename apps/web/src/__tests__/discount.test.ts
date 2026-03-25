import { calculateDiscountedPrice } from '@/lib/discount';

describe('calculateDiscountedPrice', () => {
  test('applies 10% discount to positive integer', () => {
    expect(calculateDiscountedPrice(100)).toBe(90);
  });

  test('returns 0 for zero price', () => {
    expect(calculateDiscountedPrice(0)).toBe(0);
  });

  test('applies discount to decimal price and rounds to two decimal places', () => {
    // 33.33 * 0.9 = 29.997 → rounded to 30.00
    expect(calculateDiscountedPrice(33.33)).toBe(30);
  });

  test('applies discount to small integer', () => {
    expect(calculateDiscountedPrice(10)).toBe(9);
  });

  test('applies discount to price of 1', () => {
    // 1 * 0.9 = 0.9
    expect(calculateDiscountedPrice(1)).toBe(0.9);
  });

  test('applies discount to large integer', () => {
    // 999 * 0.9 = 899.1
    expect(calculateDiscountedPrice(999)).toBe(899.1);
  });

  test('handles negative price (edge case)', () => {
    // -100 * 0.9 = -90
    expect(calculateDiscountedPrice(-100)).toBe(-90);
  });

  test('handles price with many decimals', () => {
    // 123.456 * 0.9 = 111.1104 → rounded to 111.11
    expect(calculateDiscountedPrice(123.456)).toBe(111.11);
  });
});