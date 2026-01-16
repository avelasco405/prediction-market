"""
REST API server for the prediction market
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from prediction_market import TradingEngine, OrderSide, OrderType
import time

app = Flask(__name__)
CORS(app)

# Initialize trading engine
engine = TradingEngine()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "timestamp": time.time()})


@app.route('/api/markets', methods=['GET'])
def list_markets():
    """List all markets"""
    active_only = request.args.get('active_only', 'true').lower() == 'true'
    markets = engine.list_markets(active_only=active_only)
    
    return jsonify({
        "markets": [
            {
                "market_id": m.market_id,
                "question": m.question,
                "description": m.description,
                "outcomes": m.outcomes,
                "resolution_time": m.resolution_time,
                "created_at": m.created_at,
                "resolved": m.resolved,
                "winning_outcome": m.winning_outcome,
                "total_volume": m.total_volume,
                "is_active": m.is_active()
            }
            for m in markets
        ]
    })


@app.route('/api/markets', methods=['POST'])
def create_market():
    """Create a new market"""
    data = request.json
    
    required_fields = ['question', 'description', 'outcomes', 'resolution_time', 'creator_id']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    market = engine.create_market(
        question=data['question'],
        description=data['description'],
        outcomes=data['outcomes'],
        resolution_time=data['resolution_time'],
        creator_id=data['creator_id']
    )
    
    return jsonify({
        "market_id": market.market_id,
        "question": market.question,
        "description": market.description,
        "outcomes": market.outcomes,
        "resolution_time": market.resolution_time,
        "created_at": market.created_at
    }), 201


@app.route('/api/markets/<market_id>', methods=['GET'])
def get_market(market_id):
    """Get market details"""
    market = engine.get_market(market_id)
    
    if not market:
        return jsonify({"error": "Market not found"}), 404
    
    # Get current prices
    prices = engine.get_market_prices(market_id)
    
    return jsonify({
        "market_id": market.market_id,
        "question": market.question,
        "description": market.description,
        "outcomes": market.outcomes,
        "resolution_time": market.resolution_time,
        "created_at": market.created_at,
        "resolved": market.resolved,
        "winning_outcome": market.winning_outcome,
        "total_volume": market.total_volume,
        "is_active": market.is_active(),
        "current_prices": prices
    })


@app.route('/api/markets/<market_id>/orderbook', methods=['GET'])
def get_order_book(market_id):
    """Get order book depth for a market"""
    outcome = request.args.get('outcome')
    levels = int(request.args.get('levels', 5))
    
    if not outcome:
        return jsonify({"error": "outcome parameter required"}), 400
    
    try:
        depth = engine.get_order_book_depth(market_id, outcome, levels)
        return jsonify({
            "market_id": market_id,
            "outcome": outcome,
            "bids": [{"price": p, "quantity": q} for p, q in depth["bids"]],
            "asks": [{"price": p, "quantity": q} for p, q in depth["asks"]]
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 404


@app.route('/api/markets/<market_id>/trades', methods=['GET'])
def get_market_trades(market_id):
    """Get recent trades for a market"""
    limit = int(request.args.get('limit', 100))
    
    trades = engine.get_market_trades(market_id, limit)
    
    return jsonify({
        "market_id": market_id,
        "trades": [
            {
                "trade_id": t.trade_id,
                "outcome": t.outcome,
                "buyer_id": t.buyer_id,
                "seller_id": t.seller_id,
                "price": t.price,
                "quantity": t.quantity,
                "timestamp": t.timestamp
            }
            for t in trades
        ]
    })


@app.route('/api/orders', methods=['POST'])
def place_order():
    """Place a new order"""
    data = request.json
    
    required_fields = ['market_id', 'outcome', 'trader_id', 'side', 'order_type', 'quantity']
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        side = OrderSide[data['side'].upper()]
        order_type = OrderType[data['order_type'].upper()]
        
        order, trades = engine.place_order(
            market_id=data['market_id'],
            outcome=data['outcome'],
            trader_id=data['trader_id'],
            side=side,
            order_type=order_type,
            quantity=data['quantity'],
            price=data.get('price')
        )
        
        return jsonify({
            "order": {
                "order_id": order.order_id,
                "market_id": order.market_id,
                "trader_id": order.trader_id,
                "side": order.side.value,
                "order_type": order.order_type.value,
                "quantity": order.quantity,
                "price": order.price,
                "filled_quantity": order.filled_quantity,
                "timestamp": order.timestamp
            },
            "trades": [
                {
                    "trade_id": t.trade_id,
                    "outcome": t.outcome,
                    "buyer_id": t.buyer_id,
                    "seller_id": t.seller_id,
                    "price": t.price,
                    "quantity": t.quantity,
                    "timestamp": t.timestamp
                }
                for t in trades
            ]
        }), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except KeyError as e:
        return jsonify({"error": f"Invalid value: {str(e)}"}), 400


@app.route('/api/orders/<order_id>', methods=['DELETE'])
def cancel_order(order_id):
    """Cancel an order"""
    success = engine.cancel_order(order_id)
    
    if not success:
        return jsonify({"error": "Order not found or already filled"}), 404
    
    return jsonify({"message": "Order cancelled successfully"})


@app.route('/api/traders/<trader_id>/orders', methods=['GET'])
def get_trader_orders(trader_id):
    """Get all open orders for a trader"""
    orders = engine.get_trader_orders(trader_id)
    
    return jsonify({
        "trader_id": trader_id,
        "orders": [
            {
                "order_id": o.order_id,
                "market_id": o.market_id,
                "side": o.side.value,
                "order_type": o.order_type.value,
                "quantity": o.quantity,
                "price": o.price,
                "filled_quantity": o.filled_quantity,
                "remaining_quantity": o.remaining_quantity,
                "timestamp": o.timestamp
            }
            for o in orders
        ]
    })


@app.route('/api/markets/<market_id>/resolve', methods=['POST'])
def resolve_market(market_id):
    """Resolve a market"""
    data = request.json
    
    if 'winning_outcome' not in data:
        return jsonify({"error": "winning_outcome required"}), 400
    
    try:
        engine.resolve_market(market_id, data['winning_outcome'])
        return jsonify({"message": "Market resolved successfully"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


def run_server(host='0.0.0.0', port=5000, debug=False):
    """Run the Flask server"""
    app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    run_server(debug=True)
