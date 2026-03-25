export const logger = {
  info(message: string, meta?: unknown): void {
    if (meta !== undefined) {
      console.log(`[INFO] ${message}`, meta);
      return;
    }

    console.log(`[INFO] ${message}`);
  },

  error(message: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(`[ERROR] ${message}`, error);
      return;
    }

    console.error(`[ERROR] ${message}`);
  },

  warn(message: string, meta?: unknown): void {
    if (meta !== undefined) {
      console.warn(`[WARN] ${message}`, meta);
      return;
    }

    console.warn(`[WARN] ${message}`);
  },
};