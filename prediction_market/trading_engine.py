"""
Trading Engine - Core engine for executing trades and managing markets
"""

from typing import Dict, List, Optional, Tuple
from .market import Market
from .order import Order, OrderSide, OrderType
from .order_book import OrderBook
import uuid
import time


class Trade:
    """Represents an executed trade"""
    def __init__(self, trade_id: str, market_id: str, outcome: str, 
                 buyer_id: str, seller_id: str, price: float, 
                 quantity: float, timestamp: float):
        self.trade_id = trade_id
        self.market_id = market_id
        self.outcome = outcome
        self.buyer_id = buyer_id
        self.seller_id = seller_id
        self.price = price
        self.quantity = quantity
        self.timestamp = timestamp


class TradingEngine:
    """
    High-frequency trading engine for prediction markets
    
    Manages markets, order books, and trade execution with low-latency performance.
    Supports automated market making and liquidity provision.
    """
    
    def __init__(self):
        self.markets: Dict[str, Market] = {}
        self.order_books: Dict[str, Dict[str, OrderBook]] = {}  # market_id -> outcome -> OrderBook
        self.trades: List[Trade] = []
        self.orders: Dict[str, Order] = {}
    
    def create_market(self, question: str, description: str, 
                     outcomes: List[str], resolution_time: float,
                     creator_id: str) -> Market:
        """Create a new prediction market"""
        market_id = str(uuid.uuid4())
        market = Market(
            market_id=market_id,
            question=question,
            description=description,
            outcomes=outcomes,
            resolution_time=resolution_time,
            creator_id=creator_id
        )
        
        self.markets[market_id] = market
        
        # Create order books for each outcome
        self.order_books[market_id] = {}
        for outcome in outcomes:
            self.order_books[market_id][outcome] = OrderBook(market_id, outcome)
        
        return market
    
    def get_market(self, market_id: str) -> Optional[Market]:
        """Get a market by ID"""
        return self.markets.get(market_id)
    
    def list_markets(self, active_only: bool = True) -> List[Market]:
        """List all markets"""
        markets = list(self.markets.values())
        if active_only:
            markets = [m for m in markets if m.is_active()]
        return markets
    
    def place_order(self, market_id: str, outcome: str, trader_id: str,
                   side: OrderSide, order_type: OrderType, 
                   quantity: float, price: Optional[float] = None) -> Tuple[Order, List[Trade]]:
        """
        Place an order in the market
        
        Returns:
            Tuple of (order, list of trades executed)
        """
        # Validate market exists and is active
        market = self.markets.get(market_id)
        if not market:
            raise ValueError(f"Market {market_id} not found")
        
        if not market.is_active():
            raise ValueError(f"Market {market_id} is not active")
        
        if outcome not in market.outcomes:
            raise ValueError(f"Invalid outcome {outcome} for market {market_id}")
        
        # Validate order parameters
        if order_type == OrderType.LIMIT and price is None:
            raise ValueError("Limit orders require a price")
        
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if price is not None and (price <= 0 or price >= 1):
            raise ValueError("Price must be between 0 and 1")
        
        # Create order
        order_id = str(uuid.uuid4())
        order = Order(
            order_id=order_id,
            market_id=market_id,
            trader_id=trader_id,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price
        )
        
        self.orders[order_id] = order
        
        # Execute order
        order_book = self.order_books[market_id][outcome]
        matches = order_book.add_order(order)
        
        # Convert matches to trades
        trades = []
        for buyer_order, seller_order, match_price, match_quantity in matches:
            trade_id = str(uuid.uuid4())
            trade = Trade(
                trade_id=trade_id,
                market_id=market_id,
                outcome=outcome,
                buyer_id=buyer_order.trader_id,
                seller_id=seller_order.trader_id,
                price=match_price,
                quantity=match_quantity,
                timestamp=time.time()
            )
            trades.append(trade)
            self.trades.append(trade)
            
            # Update market volume
            market.total_volume += match_quantity
        
        return order, trades
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an order"""
        if order_id not in self.orders:
            return False
        
        order = self.orders[order_id]
        market_id = order.market_id
        
        # Find which outcome this order is for
        for outcome, order_book in self.order_books[market_id].items():
            if order_book.cancel_order(order_id):
                del self.orders[order_id]
                return True
        
        return False
    
    def get_order_book_depth(self, market_id: str, outcome: str, 
                            levels: int = 5) -> Dict[str, List[Tuple[float, float]]]:
        """Get order book depth for a specific outcome"""
        if market_id not in self.order_books:
            raise ValueError(f"Market {market_id} not found")
        
        if outcome not in self.order_books[market_id]:
            raise ValueError(f"Outcome {outcome} not found in market {market_id}")
        
        return self.order_books[market_id][outcome].get_depth(levels)
    
    def get_market_prices(self, market_id: str) -> Dict[str, Optional[float]]:
        """Get current market prices (mid-price) for each outcome"""
        if market_id not in self.order_books:
            raise ValueError(f"Market {market_id} not found")
        
        prices = {}
        for outcome, order_book in self.order_books[market_id].items():
            best_bid = order_book.get_best_bid()
            best_ask = order_book.get_best_ask()
            
            if best_bid is not None and best_ask is not None:
                prices[outcome] = (best_bid + best_ask) / 2
            elif best_bid is not None:
                prices[outcome] = best_bid
            elif best_ask is not None:
                prices[outcome] = best_ask
            else:
                prices[outcome] = None
        
        return prices
    
    def resolve_market(self, market_id: str, winning_outcome: str) -> None:
        """Resolve a market with the winning outcome"""
        market = self.markets.get(market_id)
        if not market:
            raise ValueError(f"Market {market_id} not found")
        
        market.resolve(winning_outcome)
    
    def get_trader_orders(self, trader_id: str) -> List[Order]:
        """Get all orders for a specific trader"""
        return [order for order in self.orders.values() 
                if order.trader_id == trader_id and not order.is_filled]
    
    def get_market_trades(self, market_id: str, limit: int = 100) -> List[Trade]:
        """Get recent trades for a market"""
        market_trades = [t for t in self.trades if t.market_id == market_id]
        return sorted(market_trades, key=lambda t: t.timestamp, reverse=True)[:limit]
