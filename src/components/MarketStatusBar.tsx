import React, { useState, useEffect } from 'react';
import { useMarketStatus } from '../contexts/MarketStatusContext';

interface MarketStatusBarProps {
  symbol: string;
}

export const MarketStatusBar: React.FC<MarketStatusBarProps> = ({ symbol }) => {
  const { getMarketStatus } = useMarketStatus();
  const [timeUntilStatusChange, setTimeUntilStatusChange] = useState<string>('');
  const marketStatus = getMarketStatus(symbol);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      // Time calculations are done by setting date hours directly

      let nextEventTime: Date;
      let eventLabel: string;

      if (marketStatus.status === 'OPEN') {
        // Open -> will close at 16:00 EST
        nextEventTime = new Date(estTime);
        nextEventTime.setHours(16, 0, 0, 0);
        eventLabel = 'Market closes in';
      } else if (marketStatus.status === 'AFTER_HOURS') {
        // After hours -> will open next day at 9:30 EST
        nextEventTime = new Date(estTime);
        nextEventTime.setDate(nextEventTime.getDate() + 1);
        nextEventTime.setHours(9, 30, 0, 0);
        eventLabel = 'Market opens in';
      } else if (marketStatus.status === 'PRE_MARKET') {
        // Pre-market -> will open at 9:30 EST
        nextEventTime = new Date(estTime);
        nextEventTime.setHours(9, 30, 0, 0);
        eventLabel = 'Market opens in';
      } else {
        // Closed (weekend)
        nextEventTime = new Date(estTime);
        const day = nextEventTime.getDay();
        const daysUntilMonday = day === 6 ? 2 : 1;
        nextEventTime.setDate(nextEventTime.getDate() + daysUntilMonday);
        nextEventTime.setHours(9, 30, 0, 0);
        eventLabel = 'Market opens in';
      }

      const diff = nextEventTime.getTime() - estTime.getTime();
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilStatusChange(`${eventLabel} ${hrs}h ${mins}m ${secs}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [marketStatus.status]);

  const getStatusColor = (): string => {
    switch (marketStatus.status) {
      case 'OPEN':
        return 'bg-green-900 border-green-700 text-green-300';
      case 'AFTER_HOURS':
        return 'bg-blue-900 border-blue-700 text-blue-300';
      case 'PRE_MARKET':
        return 'bg-purple-900 border-purple-700 text-purple-300';
      case 'CLOSED':
        return 'bg-red-900 border-red-700 text-red-300';
      default:
        return 'bg-slate-700 border-slate-600 text-slate-300';
    }
  };

  const getStatusIcon = (): string => {
    switch (marketStatus.status) {
      case 'OPEN':
        return '🟢';
      case 'AFTER_HOURS':
        return '🔵';
      case 'PRE_MARKET':
        return '🟣';
      case 'CLOSED':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getOrderPlacementStatus = (): string => {
    if (!marketStatus.canPlaceOrder) {
      return 'Order placement disabled';
    }
    return 'Orders allowed';
  };

  const isCrypto = ['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'LINK', 'MATIC', 'DOGE', 'SHIB', 'BNB', 'AVAX'].includes(symbol.toUpperCase());

  return (
    <div className={`rounded-lg p-4 border ${getStatusColor()}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getStatusIcon()}</span>
          <div>
            <h3 className="text-sm font-bold uppercase">{symbol} Market Status</h3>
            <p className="text-xs opacity-75">{marketStatus.status}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-75">{getOrderPlacementStatus()}</p>
          <p className="text-xs opacity-75">{isCrypto ? '24/7 Trading' : 'Stock Market Hours'}</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="text-sm font-mono opacity-90">
        {timeUntilStatusChange}
      </div>

      {/* Additional Info */}
      {marketStatus.reason && (
        <p className="text-xs mt-2 opacity-75">
          ℹ️ {marketStatus.reason}
        </p>
      )}

      {/* Order Placement Alert */}
      {!marketStatus.canPlaceOrder && (
        <div className="mt-3 p-2 bg-red-950 rounded border border-red-700">
          <p className="text-xs font-bold text-red-200">
            ⚠️ Order placement is currently disabled outside market hours
          </p>
        </div>
      )}
    </div>
  );
};

export default MarketStatusBar;
