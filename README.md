# Prediction Market - 预测市场

一个高频交易和自动预测市场的产品 (A high-frequency trading and automated prediction market product)

## 概述 (Overview)

这是一个功能完整的预测市场系统，支持高频交易和自动化市场操作。预测市场允许用户对未来事件的结果进行交易，市场价格反映了集体对事件发生概率的估计。

This is a fully-featured prediction market system that supports high-frequency trading and automated market operations. Prediction markets allow users to trade on outcomes of future events, with market prices reflecting the collective probability estimates.

## 主要特性 (Key Features)

- **高频交易引擎** - 低延迟订单匹配和执行
  - High-frequency trading engine with low-latency order matching
- **订单簿管理** - 使用高效的排序数据结构实现价格-时间优先
  - Order book management with efficient sorted containers for price-time priority
- **多种订单类型** - 支持限价单和市价单
  - Multiple order types: LIMIT and MARKET orders
- **自动化做市商** - 内置流动性池
  - Automated market maker with built-in liquidity pools
- **REST API** - 完整的HTTP API用于市场操作
  - Full REST API for market operations
- **实时交易数据** - 订单簿深度、最新成交、市场价格
  - Real-time trading data: order book depth, recent trades, market prices

## 快速开始 (Quick Start)

### 安装 (Installation)

```bash
# 克隆仓库
git clone https://github.com/avelasco405/prediction-market.git
cd prediction-market

# 安装依赖
pip install -r requirements.txt

# 或使用 setup.py 安装
pip install -e .
```

### 基本使用 (Basic Usage)

```python
from prediction_market import TradingEngine, OrderSide, OrderType
import time

# 初始化交易引擎
engine = TradingEngine()

# 创建预测市场
market = engine.create_market(
    question="Will it rain tomorrow?",
    description="This market resolves YES if there is any measurable precipitation.",
    outcomes=["YES", "NO"],
    resolution_time=time.time() + 86400,  # 24小时后
    creator_id="creator_001"
)

# 下单
order, trades = engine.place_order(
    market_id=market.market_id,
    outcome="YES",
    trader_id="trader_001",
    side=OrderSide.BUY,
    order_type=OrderType.LIMIT,
    quantity=100,
    price=0.6
)

# 查看订单簿
depth = engine.get_order_book_depth(market.market_id, "YES", levels=5)
print(f"Best bid: {depth['bids'][0] if depth['bids'] else 'None'}")
print(f"Best ask: {depth['asks'][0] if depth['asks'] else 'None'}")
```

### 运行示例 (Run Example)

```bash
cd examples
python demo.py
```

### 启动 API 服务器 (Start API Server)

```bash
python -m prediction_market.api
```

API 服务器将在 http://localhost:5000 运行

## API 端点 (API Endpoints)

### 市场操作 (Market Operations)

- `GET /api/markets` - 列出所有市场
- `POST /api/markets` - 创建新市场
- `GET /api/markets/<market_id>` - 获取市场详情
- `GET /api/markets/<market_id>/orderbook` - 获取订单簿深度
- `GET /api/markets/<market_id>/trades` - 获取最近成交
- `POST /api/markets/<market_id>/resolve` - 结算市场

### 交易操作 (Trading Operations)

- `POST /api/orders` - 下单
- `DELETE /api/orders/<order_id>` - 取消订单
- `GET /api/traders/<trader_id>/orders` - 获取交易者的订单

### 示例 API 请求 (Example API Requests)

创建市场:
```bash
curl -X POST http://localhost:5000/api/markets \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Will Bitcoin reach $100k in 2026?",
    "description": "Market resolves YES if BTC/USD >= 100000",
    "outcomes": ["YES", "NO"],
    "resolution_time": 1735689600,
    "creator_id": "creator_001"
  }'
```

下单:
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "market_id": "market-uuid",
    "outcome": "YES",
    "trader_id": "trader_001",
    "side": "BUY",
    "order_type": "LIMIT",
    "quantity": 100,
    "price": 0.65
  }'
```

## 架构 (Architecture)

系统由以下核心组件组成:

### 核心模块 (Core Modules)

- **Market** - 预测市场数据结构
- **Order** - 订单定义和管理
- **OrderBook** - 高性能订单簿实现
- **TradingEngine** - 交易引擎和市场管理
- **API** - REST API 服务器

### 数据结构 (Data Structures)

订单簿使用 `SortedDict` 实现 O(log n) 的插入和高效的价格-时间优先匹配。

### 订单匹配 (Order Matching)

- 价格-时间优先原则
- 限价单与市价单支持
- 自动匹配和成交执行
- 部分成交支持

## 技术栈 (Technology Stack)

- **Python 3.7+**
- **Flask** - Web 框架
- **sortedcontainers** - 高效排序数据结构
- **pandas** - 数据处理
- **numpy** - 数值计算

## 开发 (Development)

```bash
# 安装开发依赖
pip install -r requirements.txt

# 运行测试
python -m pytest tests/

# 代码格式化
black prediction_market/

# 类型检查
mypy prediction_market/
```

## 性能特点 (Performance Characteristics)

- **订单插入**: O(log n)
- **订单匹配**: O(k) where k = number of matches
- **订单取消**: O(log n)
- **获取最佳价格**: O(1)
- **获取订单簿深度**: O(n) where n = depth levels

## 安全特性 (Security Features)

- 订单验证和参数检查
- 市场状态验证
- 价格范围限制 (0 < price < 1)
- 数量正值检查

## 未来功能 (Future Features)

- [ ] 用户认证和授权
- [ ] 持久化存储 (数据库集成)
- [ ] WebSocket 实时数据推送
- [ ] 高级订单类型 (止损单、冰山单)
- [ ] 多货币支持
- [ ] 交易费用和结算
- [ ] 图表和分析工具
- [ ] 移动端应用

## 贡献 (Contributing)

欢迎提交 Pull Request 和 Issue！

## 许可证 (License)

MIT License

## 联系方式 (Contact)

- GitHub: [@avelasco405](https://github.com/avelasco405)
- Repository: [prediction-market](https://github.com/avelasco405/prediction-market)
