import { describe, it, expect } from 'vitest';

// Example unit test for backend
describe('Example backend unit test', () => {
  it('should add numbers correctly', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});