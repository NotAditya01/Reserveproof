import { createContext, useContext, useMemo, useState } from 'react';
import { getMidnightAddress } from '../lib/midnight';

type WalletContextValue = {
  walletAddress: string | null;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
  loading: boolean;
  error: string | null;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connectWallet() {
    try {
      setLoading(true);
      const address = await getMidnightAddress();
      setWalletAddress(address);
      setError(null);
      return address;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function disconnectWallet() {
    setWalletAddress(null);
    setError(null);
  }

  const value = useMemo(
    () => ({ walletAddress, connectWallet, disconnectWallet, loading, error }),
    [walletAddress, loading, error],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
}
