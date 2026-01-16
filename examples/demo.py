"""
Example usage of the prediction market system
"""

from prediction_market import TradingEngine, OrderSide, OrderType
import time


def main():
    print("=== Prediction Market Demo ===\n")
    
    # Initialize trading engine
    engine = TradingEngine()
    
    # Create a prediction market
    print("1. Creating a prediction market...")
    resolution_time = time.time() + 86400  # Resolves in 24 hours
    market = engine.create_market(
        question="Will it rain tomorrow?",
        description="This market resolves YES if there is any measurable precipitation tomorrow, NO otherwise.",
        outcomes=["YES", "NO"],
        resolution_time=resolution_time,
        creator_id="creator_001"
    )
    print(f"   Market created: {market.market_id}")
    print(f"   Question: {market.question}")
    print(f"   Outcomes: {', '.join(market.outcomes)}\n")
    
    # Place some orders
    print("2. Placing orders...")
    
    # Trader 1 buys YES at 0.6
    order1, trades1 = engine.place_order(
        market_id=market.market_id,
        outcome="YES",
        trader_id="trader_001",
        side=OrderSide.BUY,
        order_type=OrderType.LIMIT,
        quantity=100,
        price=0.6
    )
    print(f"   Order 1: BUY 100 YES @ 0.6 - Order ID: {order1.order_id}")
    
    # Trader 2 sells YES at 0.65
    order2, trades2 = engine.place_order(
        market_id=market.market_id,
        outcome="YES",
        trader_id="trader_002",
        side=OrderSide.SELL,
        order_type=OrderType.LIMIT,
        quantity=50,
        price=0.65
    )
    print(f"   Order 2: SELL 50 YES @ 0.65 - Order ID: {order2.order_id}")
    
    # Trader 3 buys YES at market (will match with order2)
    order3, trades3 = engine.place_order(
        market_id=market.market_id,
        outcome="YES",
        trader_id="trader_003",
        side=OrderSide.BUY,
        order_type=OrderType.MARKET,
        quantity=30
    )
    print(f"   Order 3: BUY 30 YES @ MARKET - Order ID: {order3.order_id}")
    print(f"   Matched {len(trades3)} trades\n")
    
    # Show order book
    print("3. Order Book Depth (YES):")
    depth = engine.get_order_book_depth(market.market_id, "YES", levels=5)
    
    print("   Asks (Sell Orders):")
    for price, quantity in depth["asks"]:
        print(f"     {quantity:>8.2f} @ {price:.4f}")
    
    print("   Bids (Buy Orders):")
    for price, quantity in depth["bids"]:
        print(f"     {quantity:>8.2f} @ {price:.4f}")
    print()
    
    # Show current prices
    print("4. Current Market Prices:")
    prices = engine.get_market_prices(market.market_id)
    for outcome, price in prices.items():
        if price is not None:
            print(f"   {outcome}: {price:.4f} ({price*100:.2f}%)")
        else:
            print(f"   {outcome}: No market")
    print()
    
    # Show recent trades
    print("5. Recent Trades:")
    trades = engine.get_market_trades(market.market_id, limit=10)
    for trade in trades:
        print(f"   Trade {trade.trade_id[:8]}...")
        print(f"     Outcome: {trade.outcome}")
        print(f"     Price: {trade.price:.4f}")
        print(f"     Quantity: {trade.quantity}")
        print(f"     Buyer: {trade.buyer_id}, Seller: {trade.seller_id}")
    print()
    
    # Show market stats
    print("6. Market Statistics:")
    print(f"   Total Volume: {market.total_volume}")
    print(f"   Active: {market.is_active()}")
    print(f"   Resolved: {market.resolved}")
    print()
    
    print("=== Demo Complete ===")


if __name__ == "__main__":
    main()
