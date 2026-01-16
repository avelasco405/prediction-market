"""
Order module - defines order types and structures for the prediction market
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional
import time


class OrderSide(Enum):
    """Order side: BUY or SELL"""
    BUY = "BUY"
    SELL = "SELL"


class OrderType(Enum):
    """Order type: LIMIT or MARKET"""
    LIMIT = "LIMIT"
    MARKET = "MARKET"


@dataclass
class Order:
    """
    Represents a trading order in the prediction market
    
    Attributes:
        order_id: Unique identifier for the order
        market_id: ID of the market this order belongs to
        trader_id: ID of the trader placing the order
        side: BUY or SELL
        order_type: LIMIT or MARKET
        price: Limit price (for LIMIT orders)
        quantity: Number of shares to trade
        timestamp: When the order was created
        filled_quantity: Amount already filled
    """
    order_id: str
    market_id: str
    trader_id: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    timestamp: float = None
    filled_quantity: float = 0.0
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()
    
    @property
    def remaining_quantity(self) -> float:
        """Returns the unfilled quantity"""
        return self.quantity - self.filled_quantity
    
    @property
    def is_filled(self) -> bool:
        """Check if order is completely filled"""
        return self.filled_quantity >= self.quantity
    
    def fill(self, quantity: float) -> None:
        """Fill the order with the specified quantity"""
        self.filled_quantity += quantity
