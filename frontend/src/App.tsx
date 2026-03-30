import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import HomePage from './pages/HomePage';
import AttestPage from './pages/AttestPage';
import AttestProofPage from './pages/AttestProofPage';
import VerifyPage from './pages/VerifyPage';
import DashboardPage from './pages/DashboardPage';
import { WalletProvider, useWallet } from './context/WalletContext';
import Navbar from './components/Navbar';

function WalletGuard({ children }: { children: ReactElement }) {
  const { walletAddress } = useWallet();
  if (!walletAddress) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-fade">
      <Routes location={location}>
        <Route path="/" element={<HomePage />} />
        <Route path="/attest" element={<AttestPage />} />
        <Route path="/attest/:proofHash" element={<AttestProofPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/proof/:proofHash" element={<Navigate to="/verify" replace />} />
        <Route
          path="/dashboard"
          element={
            <WalletGuard>
              <DashboardPage />
            </WalletGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function ReserveProofApp() {
  return (
    <BrowserRouter>
      <WalletProvider>
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
          <Navbar />
          <AnimatedRoutes />
        </div>
      </WalletProvider>
    </BrowserRouter>
  );
}
