// Utility để log chỉ trong development mode
const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Error luôn log để debug production issues
    console.error(...args);
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};

