import React, { createContext, useContext, useState, useCallback } from 'react';

export type MarketStatus = 'OPEN' | 'CLOSED' | 'AFTER_HOURS' | 'PRE_MARKET';

export interface MarketStatusInfo {
  status: MarketStatus;
  isTrading: boolean;
  nextOpenTime?: number; // timestamp
  nextCloseTime?: number; // timestamp
  canPlaceOrder: boolean;
  reason?: string;
}

interface MarketStatusContextType {
  getMarketStatus: (symbol: string) => MarketStatusInfo;
  updatePriceData: (priceData: Record<string, any>) => void;
}

const MarketStatusContext = createContext<MarketStatusContextType | undefined>(undefined);

const isCryptoAsset = (symbol: string): boolean => {
  const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'LINK', 'MATIC', 'DOGE', 'SHIB', 'BNB', 'AVAX'];
  return cryptoSymbols.includes(symbol.toUpperCase());
};

const getStockMarketStatus = (): MarketStatusInfo => {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  const hours = estTime.getHours();
  const minutes = estTime.getMinutes();
  const dayOfWeek = estTime.getDay();

  // Check if weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'CLOSED',
      isTrading: false,
      canPlaceOrder: false,
      reason: 'Market closed on weekends',
    };
  }

  // Regular market hours: 9:30 - 16:00 EST
  if (hours > 9 || (hours === 9 && minutes >= 30)) {
    if (hours < 16) {
      const nextCloseTime = new Date(estTime.setHours(16, 0, 0, 0)).getTime();
      return {
        status: 'OPEN',
        isTrading: true,
        nextCloseTime,
        canPlaceOrder: true,
      };
    }
  }

  // After hours: 16:00 - 20:00 EST
  if (hours >= 16 && hours < 20) {
    return {
      status: 'AFTER_HOURS',
      isTrading: true,
      canPlaceOrder: true,
      reason: 'After-hours trading (limited liquidity)',
    };
  }

  // Pre-market: 4:00 - 9:30 EST
  if (hours < 4 || (hours >= 4 && hours < 9) || (hours === 9 && minutes < 30)) {
    const nextOpenTime = new Date(estTime.setHours(9, 30, 0, 0)).getTime();
    return {
      status: 'PRE_MARKET',
      isTrading: true,
      nextOpenTime,
      canPlaceOrder: true,
      reason: 'Pre-market trading (limited liquidity)',
    };
  }

  return {
    status: 'CLOSED',
    isTrading: false,
    canPlaceOrder: false,
    reason: 'Market closed',
  };
};

const getCryptoMarketStatus = (): MarketStatusInfo => {
  return {
    status: 'OPEN',
    isTrading: true,
    canPlaceOrder: true,
    reason: '24/7 market',
  };
};

export const MarketStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setPriceData] = useState<Record<string, any>>({});

  const getMarketStatus = useCallback((symbol: string): MarketStatusInfo => {
    if (isCryptoAsset(symbol)) {
      return getCryptoMarketStatus();
    } else {
      return getStockMarketStatus();
    }
  }, []);

  const updatePriceData = useCallback((priceData: Record<string, any>) => {
    setPriceData(priceData);
  }, []);

  return (
    <MarketStatusContext.Provider
      value={{
        getMarketStatus,
        updatePriceData,
      }}
    >
      {children}
    </MarketStatusContext.Provider>
  );
};

export const useMarketStatus = () => {
  const context = useContext(MarketStatusContext);
  if (!context) {
    throw new Error('useMarketStatus must be used within MarketStatusProvider');
  }
  return context;
};
