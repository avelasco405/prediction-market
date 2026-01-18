import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Position {
  id: string;
  symbol: string;
  accountType: 'crypto' | 'equity';
  quantity: number;
  avgCostPrice: number;
  currentPrice: number;
  leverage: number;
  side: 'LONG' | 'SHORT';
  unrealizedPnL: number;
  realizedPnL: number;
  fees: number;
  fundingCost: number;
  openedAt: number;
  openOrderId?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  quantity: number;
  executionPrice: number;
  side: 'BUY' | 'SELL';
  fee: number;
  timestamp: number;
  pnl?: number;
}

export interface Account {
  cash: number;
  equity: number;
  unrealizedPnL: number;
  realizedPnL: number;
  totalFees: number;
  totalFundingCost: number;
  leverage: number;
  positions: Position[];
  trades: Trade[];
}

interface AccountContextType {
  cryptoAccount: Account;
  equityAccount: Account;
  totalEquity: number;
  updatePosition: (position: Position, accountType: 'crypto' | 'equity') => void;
  addTrade: (trade: Trade, accountType: 'crypto' | 'equity') => void;
  updateFees: (fee: number, accountType: 'crypto' | 'equity') => void;
  updateFundingCost: (cost: number, accountType: 'crypto' | 'equity') => void;
  withdrawCash: (amount: number, accountType: 'crypto' | 'equity') => boolean;
  depositCash: (amount: number, accountType: 'crypto' | 'equity') => void;
  getPositionBySymbol: (symbol: string, accountType: 'crypto' | 'equity') => Position | undefined;
  closePosition: (positionId: string, accountType: 'crypto' | 'equity') => void;
  validateMarginUsage: (symbol: string, leverage: number, accountType: 'crypto' | 'equity') => { isValid: boolean; reason?: string };
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const createInitialAccount = (initialCash: number): Account => ({
  cash: initialCash,
  equity: initialCash,
  unrealizedPnL: 0,
  realizedPnL: 0,
  totalFees: 0,
  totalFundingCost: 0,
  leverage: 1,
  positions: [],
  trades: [],
});

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cryptoAccount, setCryptoAccount] = useState<Account>(createInitialAccount(5000));
  const [equityAccount, setEquityAccount] = useState<Account>(createInitialAccount(5000));

  const calculateTotalEquity = (account: Account): number => {
    const accountEquity = account.cash + account.unrealizedPnL + account.realizedPnL - account.totalFees - account.totalFundingCost;
    return Math.max(accountEquity, 0);
  };

  const totalEquity = calculateTotalEquity(cryptoAccount) + calculateTotalEquity(equityAccount);

  const updatePosition = useCallback((position: Position, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    setAccount((prevAccount) => {
      const existingIndex = prevAccount.positions.findIndex((p) => p.id === position.id);
      let newPositions: Position[];

      if (existingIndex >= 0) {
        newPositions = [...prevAccount.positions];
        newPositions[existingIndex] = position;
      } else {
        newPositions = [...prevAccount.positions, position];
      }

      const unrealizedPnL = newPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
      const realizedPnL = newPositions.reduce((sum, p) => sum + p.realizedPnL, 0);

      return {
        ...prevAccount,
        positions: newPositions,
        unrealizedPnL,
        realizedPnL,
        equity: calculateTotalEquity({ ...prevAccount, unrealizedPnL, realizedPnL }),
      };
    });
  }, []);

  const addTrade = useCallback((trade: Trade, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    setAccount((prevAccount) => ({
      ...prevAccount,
      trades: [...prevAccount.trades, trade],
    }));
  }, []);

  const updateFees = useCallback((fee: number, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    setAccount((prevAccount) => {
      const newTotalFees = prevAccount.totalFees + fee;
      return {
        ...prevAccount,
        totalFees: newTotalFees,
        cash: prevAccount.cash - fee,
        equity: calculateTotalEquity({ ...prevAccount, totalFees: newTotalFees }),
      };
    });
  }, []);

  const updateFundingCost = useCallback((cost: number, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    setAccount((prevAccount) => {
      const newTotalFunding = prevAccount.totalFundingCost + cost;
      return {
        ...prevAccount,
        totalFundingCost: newTotalFunding,
        cash: prevAccount.cash - cost,
        equity: calculateTotalEquity({ ...prevAccount, totalFundingCost: newTotalFunding }),
      };
    });
  }, []);

  const withdrawCash = useCallback((amount: number, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    const account = accountType === 'crypto' ? cryptoAccount : equityAccount;

    if (account.cash < amount) {
      return false;
    }

    setAccount((prevAccount) => ({
      ...prevAccount,
      cash: prevAccount.cash - amount,
    }));
    return true;
  }, [cryptoAccount, equityAccount]);

  const depositCash = useCallback((amount: number, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    setAccount((prevAccount) => ({
      ...prevAccount,
      cash: prevAccount.cash + amount,
    }));
  }, []);

  const getPositionBySymbol = useCallback((symbol: string, accountType: 'crypto' | 'equity'): Position | undefined => {
    const account = accountType === 'crypto' ? cryptoAccount : equityAccount;
    return account.positions.find((p) => p.symbol === symbol);
  }, [cryptoAccount, equityAccount]);

  const closePosition = useCallback((positionId: string, accountType: 'crypto' | 'equity') => {
    const setAccount = accountType === 'crypto' ? setCryptoAccount : setEquityAccount;
    setAccount((prevAccount) => {
      const position = prevAccount.positions.find((p) => p.id === positionId);
      if (!position) return prevAccount;

      const newPositions = prevAccount.positions.filter((p) => p.id !== positionId);
      const newRealizedPnL = prevAccount.realizedPnL + position.unrealizedPnL;

      return {
        ...prevAccount,
        positions: newPositions,
        realizedPnL: newRealizedPnL,
        equity: calculateTotalEquity({ ...prevAccount, positions: newPositions, realizedPnL: newRealizedPnL }),
      };
    });
  }, []);

  const validateMarginUsage = useCallback(
    (symbol: string, leverage: number, accountType: 'crypto' | 'equity'): { isValid: boolean; reason?: string } => {
      const maxLeverage = accountType === 'crypto' ? 20 : 5;
      if (leverage > maxLeverage) {
        return { isValid: false, reason: `${accountType === 'crypto' ? 'Crypto' : 'Equity'} max leverage is ${maxLeverage}x` };
      }

      // Check if trying to use margin across accounts (not allowed)
      const position = getPositionBySymbol(symbol, accountType);
      if (position && position.leverage > 1) {
        return { isValid: false, reason: `Cannot modify leverage on existing position for ${symbol}` };
      }

      return { isValid: true };
    },
    [getPositionBySymbol]
  );

  return (
    <AccountContext.Provider
      value={{
        cryptoAccount,
        equityAccount,
        totalEquity,
        updatePosition,
        addTrade,
        updateFees,
        updateFundingCost,
        withdrawCash,
        depositCash,
        getPositionBySymbol,
        closePosition,
        validateMarginUsage,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
};
