type LaceApi = {
  getUsedAddresses: () => Promise<string[]>;
  getUnusedAddresses?: () => Promise<string[]>;
  getChangeAddress?: () => Promise<string>;
};

declare global {
  interface Window {
    midnight?: {
      mnLace?: {
        enable: () => Promise<LaceApi>;
      };
    };
    cardano?: {
      lace?: {
        enable: () => Promise<LaceApi>;
      };
      [key: string]: unknown;
    };
  }
}

async function getLaceApi(): Promise<LaceApi> {
  if (window.midnight?.mnLace) {
    return window.midnight.mnLace.enable();
  }
  if (window.cardano?.lace) {
    return window.cardano.lace.enable();
  }
  const detected = window.cardano ? Object.keys(window.cardano) : [];
  throw new Error(`Lace wallet not found. Detected: [${detected.join(', ')}]`);
}

function isRetryableLaceError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('wallet-api-lace') ||
    message.includes('object can no longer be used') ||
    message.includes('channel') ||
    message.includes('shutdown')
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      window.clearTimeout(timer);
    }
  }
}

async function resolveAddressFromApi(api: LaceApi): Promise<string> {
  const used = await api.getUsedAddresses();
  if (used.length) return used[0];
  if (api.getChangeAddress) {
    const change = await api.getChangeAddress();
    if (change) return change;
  }
  if (api.getUnusedAddresses) {
    const unused = await api.getUnusedAddresses();
    if (unused.length) return unused[0];
  }
  throw new Error('No wallet address available in Lace');
}

export async function getMidnightAddress(): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const api = await withTimeout(getLaceApi(), 10000, 'Wallet connection timed out while enabling Lace');
      return await withTimeout(
        resolveAddressFromApi(api),
        10000,
        'Wallet connection timed out while requesting address',
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableLaceError(error) || attempt === 1) {
        throw error;
      }
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error('Failed to connect Lace wallet');
}
