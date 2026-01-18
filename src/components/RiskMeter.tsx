import React, { useMemo } from 'react';
import { calculateRiskMetrics } from '../lib/tradingLogic';

interface RiskMeterProps {
  position: {
    avgCostPrice: number;
    currentPrice: number;
    quantity: number;
    leverage: number;
    equity: number;
    side: 'LONG' | 'SHORT';
  };
  showDetails?: boolean;
}

export const RiskMeter: React.FC<RiskMeterProps> = ({ 
  position, 
  showDetails = true 
}) => {
  const metrics = useMemo(() => {
    const totalPositionValue = position.quantity * position.avgCostPrice;
    return calculateRiskMetrics(
      position.avgCostPrice,
      position.currentPrice,
      position.quantity,
      position.leverage,
      position.equity,
      position.side,
      totalPositionValue
    );
  }, [position]);

  const getWarningColor = (level: string): string => {
    switch (level) {
      case 'SAFE':
        return 'text-green-400';
      case 'WARNING':
        return 'text-yellow-400';
      case 'CRITICAL':
        return 'text-red-400';
      case 'LIQUIDATED':
        return 'text-red-600';
      default:
        return 'text-white';
    }
  };

  const getBarColor = (level: string): string => {
    switch (level) {
      case 'SAFE':
        return 'bg-green-500';
      case 'WARNING':
        return 'bg-yellow-500';
      case 'CRITICAL':
        return 'bg-red-500';
      case 'LIQUIDATED':
        return 'bg-red-700';
      default:
        return 'bg-blue-500';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
      <h3 className="text-lg font-semibold text-white mb-4">Risk Metrics</h3>

      {/* Liquidation Price */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400">Liquidation Price</span>
          <span className={`text-lg font-bold ${getWarningColor(metrics.warningLevel)}`}>
            {formatPrice(metrics.liquidationPrice)}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Entry: {formatPrice(position.avgCostPrice)} | Current: {formatPrice(position.currentPrice)}
        </p>
        {position.side === 'LONG' ? (
          <p className="text-xs text-slate-500">
            Stop Loss Distance: {formatPrice(position.currentPrice - metrics.liquidationPrice)} ({
              ((((position.currentPrice - metrics.liquidationPrice) / position.currentPrice) * 100).toFixed(2))}%)
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Stop Loss Distance: {formatPrice(metrics.liquidationPrice - position.currentPrice)} ({
              ((((metrics.liquidationPrice - position.currentPrice) / position.currentPrice) * 100).toFixed(2))}%)
          </p>
        )}
      </div>

      {/* Risk Ratio with Visual Indicator */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-slate-400">Risk Ratio (Leverage Utilization)</span>
          <span className={`text-lg font-bold ${getWarningColor(metrics.warningLevel)}`}>
            {metrics.riskRatio.toFixed(1)}%
          </span>
        </div>
        
        {/* Risk Bar */}
        <div className="w-full h-6 bg-slate-600 rounded overflow-hidden flex items-center">
          <div
            className={`h-full transition-all ${getBarColor(metrics.warningLevel)}`}
            style={{ width: `${Math.min(metrics.riskRatio, 100)}%` }}
          />
          <span className="absolute text-xs font-bold text-white ml-2">
            {metrics.riskRatio > 30 ? `${metrics.riskRatio.toFixed(1)}%` : ''}
          </span>
        </div>

        {/* Risk Zones */}
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Safe (0-50%)</span>
          <span>Warning (50-75%)</span>
          <span>Critical (75-90%)</span>
          <span>Danger (&gt;90%)</span>
        </div>
      </div>

      {/* Warning Status */}
      <div className={`p-3 rounded ${
        metrics.warningLevel === 'SAFE' ? 'bg-green-900' :
        metrics.warningLevel === 'WARNING' ? 'bg-yellow-900' :
        metrics.warningLevel === 'CRITICAL' ? 'bg-red-900' :
        'bg-red-950'
      }`}>
        <p className={`text-sm font-bold ${
          metrics.warningLevel === 'SAFE' ? 'text-green-300' :
          metrics.warningLevel === 'WARNING' ? 'text-yellow-300' :
          metrics.warningLevel === 'CRITICAL' ? 'text-red-300' :
          'text-red-200'
        }`}>
          Status: {metrics.warningLevel}
        </p>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Margin Used:</span>
            <span className="text-white font-mono">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(metrics.marginUsed)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Margin Available:</span>
            <span className="text-white font-mono">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(metrics.marginAvailable)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Leverage:</span>
            <span className="text-white font-mono">{position.leverage.toFixed(2)}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Position Size:</span>
            <span className="text-white font-mono">{position.quantity.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskMeter;
