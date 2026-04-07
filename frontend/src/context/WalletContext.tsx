import { createContext, useContext, useMemo, useState, useEffect } from 'react';
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


  useEffect(() => {
    const wasConnected = localStorage.getItem('reserve_wallet_connected');
    if (wasConnected === 'true') {
      connectWallet().catch(() => {

        localStorage.removeItem('reserve_wallet_connected');
      });
    }
  }, []);

  async function connectWallet() {
    try {
      setLoading(true);
      const address = await getMidnightAddress();
      setWalletAddress(address);
      setError(null);
      localStorage.setItem('reserve_wallet_connected', 'true');
      return address;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
      localStorage.removeItem('reserve_wallet_connected');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function disconnectWallet() {
    setWalletAddress(null);
    setError(null);
    localStorage.removeItem('reserve_wallet_connected');
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
