/**
 * Calculate discounted price (10% discount)
 * @param price Original price
 * @returns Discounted price (price * 0.9)
 */
export function calculateDiscountedPrice(price: number): number {
  return Math.round(price * 0.9 * 100) / 100;
}