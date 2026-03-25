import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

// Mock Next.js Image component globally for tests
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const { fill, ...imgProps } = props;
    const style = fill
      ? { ...(imgProps.style || {}), width: '100%', height: '100%', objectFit: imgProps.style?.objectFit || 'cover' }
      : imgProps.style;
    return React.createElement('img', { ...imgProps, style, alt: props.alt || '' });
  },
}));

// Mock Next.js dynamic import to return a simple component (ignore loader)
vi.mock('next/dynamic', () => {
  return {
    __esModule: true,
    default: () => {
      // Return a plain img wrapper component that accepts the same props as next/image
      return (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
        const { src, alt, ...rest } = props || {};
        return React.createElement('img', { src, alt, ...rest });
      };
    },
  };
});

// Mock Next.js router if used
vi.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: vi.fn(),
      prefetch: vi.fn().mockResolvedValue(undefined),
    };
  },
}));