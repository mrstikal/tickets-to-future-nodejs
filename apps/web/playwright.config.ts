import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig({
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://localhost:3001',
  },
  testDir: './tests',
});
