"""
Order Book module - implements efficient order book for high-frequency trading
"""

from sortedcontainers import SortedDict
from typing import List, Optional, Dict, Tuple
from .order import Order, OrderSide, OrderType


class OrderBook:
    """
    High-performance order book implementation for prediction markets
    
    Uses sorted containers for O(log n) insertions and efficient price-time priority.
    Supports both limit and market orders with automatic matching.
    
    Attributes:
        market_id: ID of the market this order book belongs to
        outcome: The outcome this order book is for
        bids: Buy orders sorted by price (descending) and time (ascending)
        asks: Sell orders sorted by price (ascending) and time (ascending)
    """
    
    def __init__(self, market_id: str, outcome: str):
        self.market_id = market_id
        self.outcome = outcome
        # Bids: higher prices first (reversed), then by timestamp
        self.bids: SortedDict = SortedDict()
        # Asks: lower prices first, then by timestamp
        self.asks: SortedDict = SortedDict()
        # Order lookup by ID
        self.orders: Dict[str, Order] = {}
    
    def add_order(self, order: Order) -> List[Tuple[Order, Order, float, float]]:
        """
        Add an order to the book and return any matches
        
        Returns:
            List of (buyer_order, seller_order, price, quantity) tuples for matches
        """
        if order.market_id != self.market_id:
            raise ValueError(f"Order market_id {order.market_id} does not match book market_id {self.market_id}")
        
        matches = []
        
        # Try to match the order
        if order.order_type == OrderType.MARKET:
            matches = self._match_market_order(order)
        else:
            matches = self._match_limit_order(order)
        
        # If order not completely filled, add to book
        if not order.is_filled:
            self._add_to_book(order)
        
        return matches
    
    def _match_market_order(self, order: Order) -> List[Tuple[Order, Order, float, float]]:
        """Match a market order against existing orders"""
        matches = []
        
        if order.side == OrderSide.BUY:
            # Match against asks (sell orders)
            while not order.is_filled and self.asks:
                best_price = next(iter(self.asks))
                best_orders = self.asks[best_price]
                
                if not best_orders:
                    del self.asks[best_price]
                    continue
                
                matching_order = best_orders[0]
                match_quantity = min(order.remaining_quantity, matching_order.remaining_quantity)
                
                order.fill(match_quantity)
                matching_order.fill(match_quantity)
                
                matches.append((order, matching_order, best_price, match_quantity))
                
                if matching_order.is_filled:
                    best_orders.pop(0)
                    if not best_orders:
                        del self.asks[best_price]
        else:
            # Match against bids (buy orders)
            while not order.is_filled and self.bids:
                best_price = next(reversed(self.bids))
                best_orders = self.bids[best_price]
                
                if not best_orders:
                    del self.bids[best_price]
                    continue
                
                matching_order = best_orders[0]
                match_quantity = min(order.remaining_quantity, matching_order.remaining_quantity)
                
                order.fill(match_quantity)
                matching_order.fill(match_quantity)
                
                matches.append((matching_order, order, best_price, match_quantity))
                
                if matching_order.is_filled:
                    best_orders.pop(0)
                    if not best_orders:
                        del self.bids[best_price]
        
        return matches
    
    def _match_limit_order(self, order: Order) -> List[Tuple[Order, Order, float, float]]:
        """Match a limit order against existing orders"""
        matches = []
        
        if order.side == OrderSide.BUY:
            # Match against asks at or below our limit price
            while not order.is_filled and self.asks:
                best_price = next(iter(self.asks))
                
                if best_price > order.price:
                    break
                
                best_orders = self.asks[best_price]
                
                if not best_orders:
                    del self.asks[best_price]
                    continue
                
                matching_order = best_orders[0]
                match_quantity = min(order.remaining_quantity, matching_order.remaining_quantity)
                
                order.fill(match_quantity)
                matching_order.fill(match_quantity)
                
                matches.append((order, matching_order, best_price, match_quantity))
                
                if matching_order.is_filled:
                    best_orders.pop(0)
                    if not best_orders:
                        del self.asks[best_price]
        else:
            # Match against bids at or above our limit price
            while not order.is_filled and self.bids:
                best_price = next(reversed(self.bids))
                
                if best_price < order.price:
                    break
                
                best_orders = self.bids[best_price]
                
                if not best_orders:
                    del self.bids[best_price]
                    continue
                
                matching_order = best_orders[0]
                match_quantity = min(order.remaining_quantity, matching_order.remaining_quantity)
                
                order.fill(match_quantity)
                matching_order.fill(match_quantity)
                
                matches.append((matching_order, order, best_price, match_quantity))
                
                if matching_order.is_filled:
                    best_orders.pop(0)
                    if not best_orders:
                        del self.bids[best_price]
        
        return matches
    
    def _add_to_book(self, order: Order) -> None:
        """Add an unfilled order to the book"""
        self.orders[order.order_id] = order
        
        if order.side == OrderSide.BUY:
            if order.price not in self.bids:
                self.bids[order.price] = []
            self.bids[order.price].append(order)
        else:
            if order.price not in self.asks:
                self.asks[order.price] = []
            self.asks[order.price].append(order)
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an order by ID"""
        if order_id not in self.orders:
            return False
        
        order = self.orders[order_id]
        
        if order.side == OrderSide.BUY:
            if order.price in self.bids:
                self.bids[order.price] = [o for o in self.bids[order.price] if o.order_id != order_id]
                if not self.bids[order.price]:
                    del self.bids[order.price]
        else:
            if order.price in self.asks:
                self.asks[order.price] = [o for o in self.asks[order.price] if o.order_id != order_id]
                if not self.asks[order.price]:
                    del self.asks[order.price]
        
        del self.orders[order_id]
        return True
    
    def get_best_bid(self) -> Optional[float]:
        """Get the best (highest) bid price"""
        if not self.bids:
            return None
        return next(reversed(self.bids))
    
    def get_best_ask(self) -> Optional[float]:
        """Get the best (lowest) ask price"""
        if not self.asks:
            return None
        return next(iter(self.asks))
    
    def get_spread(self) -> Optional[float]:
        """Get the bid-ask spread"""
        best_bid = self.get_best_bid()
        best_ask = self.get_best_ask()
        
        if best_bid is None or best_ask is None:
            return None
        
        return best_ask - best_bid
    
    def get_depth(self, levels: int = 5) -> Dict[str, List[Tuple[float, float]]]:
        """
        Get order book depth (top N price levels)
        
        Returns:
            Dictionary with 'bids' and 'asks', each containing list of (price, quantity) tuples
        """
        bids = []
        asks = []
        
        # Get top bid levels
        for i, (price, orders) in enumerate(reversed(list(self.bids.items()))):
            if i >= levels:
                break
            total_quantity = sum(o.remaining_quantity for o in orders)
            bids.append((price, total_quantity))
        
        # Get top ask levels
        for i, (price, orders) in enumerate(self.asks.items()):
            if i >= levels:
                break
            total_quantity = sum(o.remaining_quantity for o in orders)
            asks.append((price, total_quantity))
        
        return {"bids": bids, "asks": asks}
