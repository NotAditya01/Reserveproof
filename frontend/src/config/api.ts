export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: `${API_BASE_URL}/api/auth/login`,
        SIGNUP: `${API_BASE_URL}/api/auth/signup`,
        LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    },
    RESERVE: {
        ATTEST: `${API_BASE_URL}/api/reserve/attest`,
        VERIFY: `${API_BASE_URL}/api/reserve/verify`,
        HISTORY: (walletAddress: string) => `${API_BASE_URL}/api/reserve/history/${walletAddress}`,
        PROTOCOL_HISTORY: (protocolName: string) => `${API_BASE_URL}/api/reserve/history/protocol/${encodeURIComponent(protocolName)}`,
        FEED: `${API_BASE_URL}/api/reserve/feed`,
    },
} as const;
