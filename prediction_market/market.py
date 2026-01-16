"""
Market module - defines prediction market structure
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from datetime import datetime
import time


@dataclass
class Market:
    """
    Represents a prediction market
    
    A prediction market allows traders to bet on the outcome of future events.
    Prices reflect the collective probability estimate of the outcome.
    
    Attributes:
        market_id: Unique identifier for the market
        question: The question being predicted
        description: Detailed description of the market
        outcomes: List of possible outcomes (e.g., ["YES", "NO"])
        resolution_time: When the market resolves
        creator_id: ID of the market creator
        created_at: Timestamp of market creation
        resolved: Whether the market has been resolved
        winning_outcome: The winning outcome (if resolved)
        total_volume: Total trading volume
        liquidity_pool: Liquidity available for automated market making
    """
    market_id: str
    question: str
    description: str
    outcomes: List[str]
    resolution_time: float
    creator_id: str
    created_at: float = field(default_factory=time.time)
    resolved: bool = False
    winning_outcome: Optional[str] = None
    total_volume: float = 0.0
    liquidity_pool: Dict[str, float] = field(default_factory=dict)
    
    def __post_init__(self):
        """Initialize liquidity pools for each outcome"""
        if not self.liquidity_pool:
            # Initialize equal liquidity for each outcome
            initial_liquidity = 1000.0
            self.liquidity_pool = {outcome: initial_liquidity for outcome in self.outcomes}
    
    def is_active(self) -> bool:
        """Check if market is still active for trading"""
        return not self.resolved and time.time() < self.resolution_time
    
    def resolve(self, winning_outcome: str) -> None:
        """Resolve the market with the winning outcome"""
        if winning_outcome not in self.outcomes:
            raise ValueError(f"Invalid outcome: {winning_outcome}")
        self.resolved = True
        self.winning_outcome = winning_outcome
    
    def get_probability(self, outcome: str) -> float:
        """
        Calculate the implied probability for an outcome using constant product market maker
        
        Uses the formula: P(outcome) = liquidity[outcome] / sum(all_liquidity)
        """
        if outcome not in self.outcomes:
            raise ValueError(f"Invalid outcome: {outcome}")
        
        total_liquidity = sum(self.liquidity_pool.values())
        if total_liquidity == 0:
            return 0.0
        
        return self.liquidity_pool[outcome] / total_liquidity
