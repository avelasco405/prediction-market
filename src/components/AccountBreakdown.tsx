import React, { useMemo } from 'react';
import { useAccount } from '../contexts/AccountContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface AccountBreakdownProps {
  accountType: 'crypto' | 'equity';
  showChart?: boolean;
}

export const AccountBreakdown: React.FC<AccountBreakdownProps> = ({ 
  accountType, 
  showChart = true 
}) => {
  const { cryptoAccount, equityAccount } = useAccount();
  const account = accountType === 'crypto' ? cryptoAccount : equityAccount;

  const breakdownData = useMemo(() => {
    return [
      { 
        name: 'Cash', 
        value: Math.max(account.cash, 0),
        color: '#3b82f6' 
      },
      { 
        name: 'Unrealized PnL', 
        value: Math.max(account.unrealizedPnL, 0),
        color: account.unrealizedPnL > 0 ? '#10b981' : '#ef4444' 
      },
      { 
        name: 'Realized PnL', 
        value: Math.max(account.realizedPnL, 0),
        color: account.realizedPnL > 0 ? '#059669' : '#dc2626' 
      },
    ].filter(item => item.value > 0);
  }, [account]);

  const totalMetrics = useMemo(() => {
    const equity = account.cash + account.unrealizedPnL + account.realizedPnL - 
                   account.totalFees - account.totalFundingCost;
    return {
      equity: Math.max(equity, 0),
      cash: account.cash,
      unrealized: account.unrealizedPnL,
      realized: account.realizedPnL,
      fees: account.totalFees,
      funding: account.totalFundingCost,
      netPnL: account.unrealizedPnL + account.realizedPnL - account.totalFees - account.totalFundingCost,
    };
  }, [account]);

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const accountLabel = accountType === 'crypto' ? 'Crypto Account' : 'Equity Account';

  return (
    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
      <h3 className="text-lg font-semibold text-white mb-4">{accountLabel}</h3>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-600 rounded p-3">
          <p className="text-xs text-slate-400">Total Equity</p>
          <p className="text-lg font-bold text-white">{formatUSD(totalMetrics.equity)}</p>
        </div>
        <div className="bg-slate-600 rounded p-3">
          <p className="text-xs text-slate-400">Available Cash</p>
          <p className="text-lg font-bold text-blue-400">{formatUSD(totalMetrics.cash)}</p>
        </div>
        <div className="bg-slate-600 rounded p-3">
          <p className="text-xs text-slate-400">Unrealized PnL</p>
          <p className={`text-lg font-bold ${totalMetrics.unrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatUSD(totalMetrics.unrealized)}
          </p>
        </div>
        <div className="bg-slate-600 rounded p-3">
          <p className="text-xs text-slate-400">Realized PnL</p>
          <p className={`text-lg font-bold ${totalMetrics.realized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatUSD(totalMetrics.realized)}
          </p>
        </div>
        <div className="bg-slate-600 rounded p-3">
          <p className="text-xs text-slate-400">Total Fees</p>
          <p className="text-lg font-bold text-orange-400">-{formatUSD(totalMetrics.fees)}</p>
        </div>
        <div className="bg-slate-600 rounded p-3">
          <p className="text-xs text-slate-400">Funding Cost</p>
          <p className="text-lg font-bold text-orange-400">-{formatUSD(totalMetrics.funding)}</p>
        </div>
      </div>

      {/* Net PnL Summary */}
      <div className="bg-slate-600 rounded p-3 mb-4">
        <p className="text-xs text-slate-400">Net PnL (with fees)</p>
        <p className={`text-xl font-bold ${totalMetrics.netPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {formatUSD(totalMetrics.netPnL)}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {totalMetrics.netPnL >= 0 ? '↑' : '↓'} {Math.abs((totalMetrics.netPnL / totalMetrics.equity) * 100).toFixed(2)}% of equity
        </p>
      </div>

      {/* Chart */}
      {showChart && breakdownData.length > 0 && (
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={breakdownData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {breakdownData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatUSD(value)}
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Closure Check */}
      <div className="mt-4 p-2 bg-slate-600 rounded text-xs text-slate-300">
        <p className="font-mono">
          Equity = {formatUSD(account.cash)} + {formatUSD(account.unrealizedPnL)} + {formatUSD(account.realizedPnL)} - {formatUSD(account.totalFees)} - {formatUSD(account.totalFundingCost)}
        </p>
        <p className="font-mono mt-1 text-white font-bold">
          = {formatUSD(totalMetrics.equity)} ✓
        </p>
      </div>
    </div>
  );
};

export default AccountBreakdown;
