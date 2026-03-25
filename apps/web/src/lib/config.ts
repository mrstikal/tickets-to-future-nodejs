export const config = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
  get wsBaseUrl(): string {
    const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL;
    if (wsUrl) {
      return wsUrl;
    }
    // Derive WS URL from API base URL
    return this.apiBaseUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:');
  },
};
