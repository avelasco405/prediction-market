"""
Prediction Market - High-frequency trading and automated prediction market system
"""

__version__ = "0.1.0"

from .market import Market
from .order import Order, OrderSide, OrderType
from .order_book import OrderBook
from .trading_engine import TradingEngine

__all__ = [
    "Market",
    "Order",
    "OrderSide",
    "OrderType",
    "OrderBook",
    "TradingEngine",
]
