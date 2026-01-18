/**
 * Trading Logic Utilities
 * - Risk metrics calculations (liquidation price, risk ratio)
 * - PnL breakdown (fees, funding)
 * - Market event generation (anomalies)
 */

export interface RiskMetrics {
  liquidationPrice: number;
  riskRatio: number; // 0-100 percentage
  marginUsed: number;
  marginAvailable: number;
  warningLevel: 'SAFE' | 'WARNING' | 'CRITICAL' | 'LIQUIDATED';
}

export interface PnLBreakdown {
  unrealized: number;
  realized: number;
  fees: number;
  fundingCost: number;
  netPnL: number;
}

export interface MarketEvent {
  id: string;
  label: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  description?: string;
}

/**
 * Calculate liquidation price and risk metrics
 * Liquidation Price = Avg Cost ± (Equity / Qty × (1 - 1/Leverage))
 */
export const calculateRiskMetrics = (
  avgCostPrice: number,
  currentPrice: number,
  quantity: number,
  leverage: number,
  equity: number,
  side: 'LONG' | 'SHORT',
  totalPositionValue: number
): RiskMetrics => {
  const marginUsed = totalPositionValue / leverage;
  const marginAvailable = Math.max(equity - marginUsed, 0);
  const riskRatio = equity > 0 ? (marginUsed / equity) * 100 : 0;

  let liquidationPrice = avgCostPrice;
  if (leverage > 1 && quantity > 0) {
    const marginPerUnit = (equity / quantity) * (1 - 1 / leverage);
    if (side === 'LONG') {
      liquidationPrice = avgCostPrice - marginPerUnit;
    } else {
      liquidationPrice = avgCostPrice + marginPerUnit;
    }
  }

  let warningLevel: 'SAFE' | 'WARNING' | 'CRITICAL' | 'LIQUIDATED' = 'SAFE';
  if (side === 'LONG' && currentPrice <= liquidationPrice) {
    warningLevel = 'LIQUIDATED';
  } else if (side === 'SHORT' && currentPrice >= liquidationPrice) {
    warningLevel = 'LIQUIDATED';
  } else if (riskRatio > 90) {
    warningLevel = 'CRITICAL';
  } else if (riskRatio > 75) {
    warningLevel = 'CRITICAL';
  } else if (riskRatio > 50) {
    warningLevel = 'WARNING';
  }

  return {
    liquidationPrice: Math.max(liquidationPrice, 0),
    riskRatio: Math.min(riskRatio, 100),
    marginUsed,
    marginAvailable,
    warningLevel,
  };
};

/**
 * Calculate PnL breakdown
 */
export const calculatePnLBreakdown = (
  unrealizedPnL: number,
  realizedPnL: number,
  totalFees: number,
  fundingCost: number
): PnLBreakdown => {
  const netPnL = unrealizedPnL + realizedPnL - totalFees - fundingCost;

  return {
    unrealized: unrealizedPnL,
    realized: realizedPnL,
    fees: totalFees,
    fundingCost,
    netPnL,
  };
};

/**
 * Generate market events based on price volatility and market conditions
 */
export const generateMarketEvents = (
  _symbol: string,
  currentPrice: number,
  previousPrice: number,
  bid: number,
  ask: number,
  volume: number,
  fundingRate: number
): MarketEvent[] => {
  const events: MarketEvent[] = [];
  const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
  const spread = ask - bid;
  const spreadPercent = (spread / bid) * 100;
  const now = Date.now();

  // High volatility alert (>3% price change)
  if (Math.abs(priceChange) > 3) {
    events.push({
      id: `vol-${now}`,
      label: 'High Volatility Alert',
      severity: Math.abs(priceChange) > 5 ? 'critical' : 'warning',
      timestamp: now,
      description: `${Math.abs(priceChange).toFixed(2)}% price movement in short timeframe`,
    });
  }

  // Funding rate spike (crypto only)
  if (Math.abs(fundingRate) > 0.0005) {
    events.push({
      id: `funding-${now}`,
      label: 'Funding Rate Spike',
      severity: Math.abs(fundingRate) > 0.001 ? 'critical' : 'warning',
      timestamp: now,
      description: `Funding rate at ${(fundingRate * 100).toFixed(4)}%`,
    });
  }

  // Wide bid-ask spread (>0.5%)
  if (spreadPercent > 0.5) {
    events.push({
      id: `spread-${now}`,
      label: 'Wide Spread Alert',
      severity: spreadPercent > 1 ? 'warning' : 'info',
      timestamp: now,
      description: `Bid-ask spread ${spreadPercent.toFixed(3)}%`,
    });
  }

  // Large volume alert (unusual trading activity)
  if (volume > 1000000) {
    events.push({
      id: `vol-high-${now}`,
      label: 'High Volume Event',
      severity: 'info',
      timestamp: now,
      description: `Volume: ${(volume / 1000000).toFixed(2)}M`,
    });
  }

  return events;
};

/**
 * Calculate execution fee
 * Standard: 0.001% per trade
 */
export const calculateExecutionFee = (quantity: number, price: number, feePercent: number = 0.001): number => {
  return (quantity * price * feePercent) / 100;
};

/**
 * Calculate funding cost for leveraged positions (crypto)
 * Standard: 0.0001% per 8 hours
 */
export const calculateFundingCost = (
  positionSize: number,
  fundingRate: number = 0.0001,
  periods: number = 1
): number => {
  return positionSize * fundingRate * periods;
};

/**
 * Simulate order execution with potential failures and partial fills
 */
export interface OrderExecutionResult {
  success: boolean;
  executedQty: number;
  executedPrice: number;
  failureReason?: string;
  partialFill: boolean;
}

export const simulateOrderExecution = (
  quantity: number,
  limitPrice: number,
  currentBid: number,
  currentAsk: number,
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'IOC' | 'FOK',
  side: 'BUY' | 'SELL',
  liquidity: number = 0.8 // 0-1 scale
): OrderExecutionResult => {
  // Simulate execution latency (100-500ms) - handled by caller
  // const latency = Math.random() * 400 + 100;
  
  // Success probability based on liquidity
  const successProbability = 0.95 + (liquidity * 0.04); // 95-99% success rate
  const isSuccessful = Math.random() < successProbability;

  if (!isSuccessful) {
    const reasons = [
      'Insufficient liquidity',
      'Price moved away',
      'Connection timeout',
      'Request rejected',
    ];
    return {
      success: false,
      executedQty: 0,
      executedPrice: 0,
      failureReason: reasons[Math.floor(Math.random() * reasons.length)],
      partialFill: false,
    };
  }

  // Partial fill possibility (30% chance)
  const hasPartialFill = Math.random() < 0.3;
  const executedQty = hasPartialFill ? Math.floor(quantity * (0.5 + Math.random() * 0.5)) : quantity;

  // Determine execution price
  let executedPrice: number;
  if (orderType === 'MARKET') {
    executedPrice = side === 'BUY' ? currentAsk : currentBid;
    // Add slippage on market orders
    const slippage = (Math.random() * 2 + 1) / 10000; // 0.01-0.03%
    executedPrice = executedPrice * (1 + (side === 'BUY' ? slippage : -slippage));
  } else if (orderType === 'LIMIT') {
    if (side === 'BUY' && limitPrice >= currentAsk) {
      executedPrice = Math.min(limitPrice, currentAsk);
    } else if (side === 'SELL' && limitPrice <= currentBid) {
      executedPrice = Math.max(limitPrice, currentBid);
    } else {
      return {
        success: false,
        executedQty: 0,
        executedPrice: 0,
        failureReason: 'Limit price not reached',
        partialFill: false,
      };
    }
  } else if (orderType === 'STOP') {
    executedPrice = side === 'BUY' ? currentAsk : currentBid;
  } else {
    // IOC, FOK
    if (orderType === 'FOK' && hasPartialFill) {
      return {
        success: false,
        executedQty: 0,
        executedPrice: 0,
        failureReason: 'FOK: Unable to fill entire order',
        partialFill: true,
      };
    }
    executedPrice = side === 'BUY' ? currentAsk : currentBid;
  }

  return {
    success: true,
    executedQty,
    executedPrice,
    partialFill: hasPartialFill,
  };
};

/**
 * Generate realistic order book with cancellations, thick walls, and asymmetry
 */
export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface RealisticOrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  events: string[];
}

export const generateRealisticOrderBook = (
  basePrice: number,
  volatility: number
): RealisticOrderBook => {
  const events: string[] = [];
  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  // Base spread based on volatility
  const baseSpread = basePrice * (0.0002 + volatility * 0.001);

  for (let i = 1; i <= 20; i++) {
    const depth = i * 0.5;
    let bidSize = 100 - i * 3 + Math.random() * 40;
    let askSize = 100 - i * 3 + Math.random() * 40;

    // Thick walls (10-30% of levels have 5-10x size)
    if (Math.random() < 0.2) {
      bidSize *= 5 + Math.random() * 5;
      events.push(`Thick bid wall at ${(basePrice - depth * baseSpread).toFixed(2)}`);
    }
    if (Math.random() < 0.2) {
      askSize *= 5 + Math.random() * 5;
      events.push(`Thick ask wall at ${(basePrice + depth * baseSpread).toFixed(2)}`);
    }

    // Asymmetry based on volatility
    const asymmetry = 1 + (Math.random() - 0.5) * volatility;

    bids.push({
      price: basePrice - depth * baseSpread,
      size: Math.floor(bidSize * asymmetry),
      orders: Math.ceil(bidSize / 50),
    });

    asks.push({
      price: basePrice + depth * baseSpread,
      size: Math.floor(askSize / asymmetry),
      orders: Math.ceil(askSize / 50),
    });

    // Order cancellations (5-10% of orders)
    if (Math.random() < 0.07) {
      const side = Math.random() > 0.5 ? 'bid' : 'ask';
      events.push(`Order cancelled at ${side}`);
    }
  }

  return { bids, asks, events };
};
