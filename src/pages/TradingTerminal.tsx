import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { 
  AlertTriangle, Activity, Bell,
  Search, X, Plus, Minus, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { CRYPTO_ASSETS, STOCK_ASSETS } from '@/config'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAccount } from '@/contexts/AccountContext'
import { useMarketStatus } from '@/contexts/MarketStatusContext'
import { GlobalNavbar } from '@/components/GlobalNavbar'
import { ProfessionalChart, ChartTypeSelector, getAssetIcon } from '@/components/ProfessionalChart'
import { AccountBreakdown } from '@/components/AccountBreakdown'
import { RiskMeter } from '@/components/RiskMeter'
import { MarketStatusBar } from '@/components/MarketStatusBar'
import { EventTags } from '@/components/EventTags'
import { 
  generateMarketEvents, 
  calculateExecutionFee,
  simulateOrderExecution,
  generateRealisticOrderBook,
  type MarketEvent
} from '@/lib/tradingLogic'

interface PriceData {
  [key: string]: {
    price: number
    change: number
    changePercent: number
    volume: number
    high24h: number
    low24h: number
    bid: number
    ask: number
    spread: number
  }
}

interface Order {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  type: 'LIMIT' | 'MARKET' | 'STOP' | 'IOC' | 'FOK'
  price: number
  qty: number
  filled: number
  status: 'NEW' | 'PARTIAL' | 'FILLED' | 'CANCELLED'
  time: string
}

interface Position {
  symbol: string
  qty: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  value: number
}

interface Trade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  price: number
  qty: number
  time: string
}

interface Alert {
  id: string
  symbol: string
  type: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'VOLUME_SPIKE'
  value: number
  active: boolean
}

export function TradingTerminal() {
  useTheme()
  const { addNotification } = useNotifications()
  const account = useAccount()
  const { getMarketStatus } = useMarketStatus()
  const [priceData, setPriceData] = useState<PriceData>({})
  const [selectedSymbol, setSelectedSymbol] = useState('BTC')
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY')
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP' | 'IOC' | 'FOK'>('LIMIT')
  const [orderPrice, setOrderPrice] = useState('')
  const [orderQty, setOrderQty] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [totalPnL, setTotalPnL] = useState(0)
  const [hotkeys, setHotkeys] = useState(true)
  const [marketEvents, setMarketEvents] = useState<MarketEvent[]>([])

  const [chartTimeframe, setChartTimeframe] = useState('1H')
  const [chartType, setChartType] = useState<string>('candle')
  const [leverage, setLeverage] = useState(1)
  const [riskPercent] = useState(2)
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'trades' | 'alerts' | 'account' | 'risk'>('positions')
  const [searchQuery, setSearchQuery] = useState('')
  const [accountBalance] = useState(1250000)
  const [dailyPnL] = useState(3650)
  const [weeklyPnL] = useState(28500)
  const [winRate] = useState(68.5)
  const [sharpeRatio] = useState(2.34)
  const priceRef = useRef<number>(0)
  const symbolRef = useRef<string>('')

  // 生成订单簿 - 使用真实数据
  const generateOrderBook = useCallback((basePrice: number) => {
    const volatility = (Math.random() * 0.02 + 0.005); // 0.5% - 2.5%
    const realisticBook = generateRealisticOrderBook(basePrice, volatility)
    
    // Convert to old format for compatibility
    const bids = realisticBook.bids.map((level, i) => ({
      price: level.price,
      qty: level.size,
      total: 0,
      myOrder: i === 3 || i === 7
    }))
    const asks = realisticBook.asks.map((level, i) => ({
      price: level.price,
      qty: level.size,
      total: 0,
      myOrder: i === 2
    }))
    
    let bidTotal = 0, askTotal = 0
    bids.forEach(b => { bidTotal += b.qty; b.total = bidTotal })
    asks.forEach(a => { askTotal += a.qty; a.total = askTotal })
    
    // Store market events
    if (realisticBook.events.length > 0) {
      setMarketEvents(prev => [...realisticBook.events.map((event, i) => ({
        id: `event-${Date.now()}-${i}`,
        label: event,
        severity: 'info' as const,
        timestamp: Date.now()
      })), ...prev].slice(0, 10))
    }
    
    return { bids, asks }
  }, [])

  const [orderBook, setOrderBook] = useState(() => generateOrderBook(95000))

  // ==================== 免费实时 API 集成 ====================
  // Free Real-time API Integration: CoinGecko (crypto) + Multiple Stock APIs
  
  // 股票价格缓存 - 用于平滑更新
  const stockPriceCache = useRef<Record<string, { price: number; lastUpdate: number }>>({})
  
  // 获取加密货币价格 - CoinGecko 免费 API
  const fetchCryptoPrices = async () => {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/coins/markets', {
          params: {
            vs_currency: 'usd',
            ids: 'bitcoin,ethereum,solana,binancecoin,ripple,cardano,dogecoin,polkadot,polygon,avalanche-2,chainlink,uniswap',
            order: 'market_cap_desc',
            per_page: 20,
            page: 1,
            sparkline: false,
            price_change_percentage: '24h'
          },
          timeout: 10000
        }
      )
      return response.data
    } catch (error) {
      console.warn('CoinGecko API error, using fallback data:', error)
      return null
    }
  }

  // ==================== 真实股票API集成 ====================
  // Real Stock API Integration: Yahoo Finance (via proxy) / Finnhub / Twelve Data
  
  // 方法1: Yahoo Finance 通过 AllOrigins 代理 (无需API key)
  const fetchYahooFinanceQuote = async (symbol: string) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      const response = await axios.get(proxyUrl, { timeout: 5000 })
      const result = response.data?.chart?.result?.[0]
      if (result) {
        const meta = result.meta
        return {
          symbol: symbol,
          price: meta.regularMarketPrice || meta.previousClose,
          change: (meta.regularMarketPrice || 0) - (meta.previousClose || 0),
          changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) || 0,
          high: meta.regularMarketDayHigh || meta.regularMarketPrice,
          low: meta.regularMarketDayLow || meta.regularMarketPrice,
          volume: meta.regularMarketVolume || 0,
          previousClose: meta.previousClose || 0,
          isRealData: true
        }
      }
    } catch (error) {
      console.warn(`Yahoo Finance error for ${symbol}:`, error)
    }
    return null
  }

  // 方法2: Finnhub 免费API (需要免费注册获取API key)
  // 免费获取: https://finnhub.io/register
  const FINNHUB_API_KEY = '' // 用户可以填入自己的免费API key
  
  const fetchFinnhubQuote = async (symbol: string) => {
    if (!FINNHUB_API_KEY) return null
    try {
      const response = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
        { timeout: 5000 }
      )
      const data = response.data
      if (data && data.c) {
        return {
          symbol: symbol,
          price: data.c, // Current price
          change: data.d, // Change
          changePercent: data.dp, // Change percent
          high: data.h, // High
          low: data.l, // Low
          volume: 0, // Finnhub quote doesn't include volume
          previousClose: data.pc,
          isRealData: true
        }
      }
    } catch (error) {
      console.warn(`Finnhub error for ${symbol}:`, error)
    }
    return null
  }

  // 方法3: Twelve Data 免费API (800次/天免费)
  // 免费获取: https://twelvedata.com/
  const TWELVE_DATA_API_KEY = '' // 用户可以填入自己的免费API key
  
  const fetchTwelveDataQuote = async (symbol: string) => {
    if (!TWELVE_DATA_API_KEY) return null
    try {
      const response = await axios.get(
        `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${TWELVE_DATA_API_KEY}`,
        { timeout: 5000 }
      )
      const data = response.data
      if (data && data.close) {
        return {
          symbol: symbol,
          price: parseFloat(data.close),
          change: parseFloat(data.change) || 0,
          changePercent: parseFloat(data.percent_change) || 0,
          high: parseFloat(data.high) || parseFloat(data.close),
          low: parseFloat(data.low) || parseFloat(data.close),
          volume: parseInt(data.volume) || 0,
          previousClose: parseFloat(data.previous_close) || parseFloat(data.close),
          isRealData: true
        }
      }
    } catch (error) {
      console.warn(`Twelve Data error for ${symbol}:`, error)
    }
    return null
  }

  // 智能股票数据获取 - 多源回退
  const fetchStockQuote = async (symbol: string) => {
    // 优先使用 Finnhub (如果有API key)
    let quote = await fetchFinnhubQuote(symbol)
    if (quote) return quote

    // 其次使用 Twelve Data (如果有API key)
    quote = await fetchTwelveDataQuote(symbol)
    if (quote) return quote

    // 最后使用 Yahoo Finance 代理
    quote = await fetchYahooFinanceQuote(symbol)
    if (quote) return quote

    // 回退到缓存或模拟数据
    return null
  }

  // 基于真实市场价格的高保真模拟
  const generateRealisticStockPrice = (symbol: string, basePrice: number) => {
    const cache = stockPriceCache.current[symbol]
    const now = Date.now()
    
    // 如果有缓存且未过期（30秒内），基于缓存价格微调
    if (cache && now - cache.lastUpdate < 30000) {
      // 模拟真实市场的微小波动 (±0.1%)
      const microMovement = (Math.random() - 0.5) * cache.price * 0.002
      const newPrice = cache.price + microMovement
      stockPriceCache.current[symbol] = { price: newPrice, lastUpdate: now }
      return newPrice
    }
    
    // 否则使用基准价格
    stockPriceCache.current[symbol] = { price: basePrice, lastUpdate: now }
    return basePrice
  }

  // 获取所有股票价格 - 优先真实数据，回退模拟
  const fetchStockPrices = async () => {
    const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'WMT', 'DIS', 'BA']
    
    // 2026年1月的真实基准价格估算
    const basePrices: Record<string, number> = {
      'AAPL': 188.50, 'MSFT': 425.30, 'GOOGL': 178.20, 'AMZN': 198.40,
      'TSLA': 252.80, 'NVDA': 512.60, 'META': 592.40, 'JPM': 198.50,
      'V': 288.70, 'WMT': 168.30, 'DIS': 118.40, 'BA': 188.90
    }

    const results = await Promise.all(
      stockSymbols.map(async (symbol) => {
        // 尝试获取真实数据
        const realQuote = await fetchStockQuote(symbol)
        
        if (realQuote) {
          return {
            symbol,
            price: realQuote.price,
            change: realQuote.change,
            changePercent: realQuote.changePercent,
            volume: realQuote.volume || Math.floor(Math.random() * 50000000) + 10000000,
            high: realQuote.high,
            low: realQuote.low,
            isRealData: true
          }
        }

        // 使用高保真模拟
        const price = generateRealisticStockPrice(symbol, basePrices[symbol] || 100)
        const dayChange = (Math.random() - 0.5) * price * 0.03 // ±1.5% 日波动
        
        return {
          symbol,
          price: price,
          change: dayChange,
          changePercent: (dayChange / price) * 100,
          volume: Math.floor(Math.random() * 50000000) + 10000000,
          high: price * (1 + Math.random() * 0.015),
          low: price * (1 - Math.random() * 0.015),
          isRealData: false
        }
      })
    )

    return results
  }

  // 合并获取价格数据
  const fetchPrices = async () => {
    try {
      const [cryptoData, stockData] = await Promise.all([
        fetchCryptoPrices(),
        fetchStockPrices()
      ])

      const newPrices: PriceData = {}

      // 处理加密货币数据
      if (cryptoData && Array.isArray(cryptoData)) {
        cryptoData.forEach((c: any) => {
          const price = c.current_price ?? 0
          const spread = price * 0.0001
          const symbol = c.symbol?.toUpperCase() || 'UNKNOWN'
          newPrices[symbol] = {
            price: price,
            change: c.price_change_24h ?? 0,
            changePercent: c.price_change_percentage_24h ?? 0,
            volume: c.total_volume ?? 0,
            high24h: c.high_24h ?? price,
            low24h: c.low_24h ?? price,
            bid: price - spread/2,
            ask: price + spread/2,
            spread: spread
          }
        })
      } else {
        // 回退数据
        const fallbackCrypto = [
          { symbol: 'BTC', price: 95000 + Math.random() * 2000 },
          { symbol: 'ETH', price: 3500 + Math.random() * 100 },
          { symbol: 'SOL', price: 180 + Math.random() * 10 },
          { symbol: 'BNB', price: 620 + Math.random() * 20 },
          { symbol: 'XRP', price: 2.2 + Math.random() * 0.2 },
          { symbol: 'ADA', price: 0.95 + Math.random() * 0.1 },
          { symbol: 'DOGE', price: 0.32 + Math.random() * 0.05 },
          { symbol: 'DOT', price: 7.5 + Math.random() * 0.5 },
          { symbol: 'MATIC', price: 0.85 + Math.random() * 0.1 },
          { symbol: 'AVAX', price: 38 + Math.random() * 3 },
          { symbol: 'LINK', price: 22 + Math.random() * 2 },
          { symbol: 'UNI', price: 12 + Math.random() * 1 },
        ]
        fallbackCrypto.forEach(c => {
          const spread = c.price * 0.0001
          newPrices[c.symbol] = {
            price: c.price,
            change: (Math.random() - 0.5) * c.price * 0.05,
            changePercent: (Math.random() - 0.5) * 5,
            volume: Math.floor(Math.random() * 5000000000) + 1000000000,
            high24h: c.price * 1.03,
            low24h: c.price * 0.97,
            bid: c.price - spread/2,
            ask: c.price + spread/2,
            spread: spread
          }
        })
      }

      // 处理股票数据
      stockData.forEach((s: any) => {
        const price = s.price ?? 0
        const spread = price * 0.0001
        newPrices[s.symbol] = {
          price: price,
          change: s.change ?? 0,
          changePercent: s.changePercent ?? 0,
          volume: s.volume ?? 0,
          high24h: s.high ?? price,
          low24h: s.low ?? price,
          bid: price - spread/2,
          ask: price + spread/2,
          spread: spread
        }
      })

      setPriceData(newPrices)
      
      // Generate market events for current symbol - NEW
      if (newPrices[selectedSymbol]) {
        const currentData = newPrices[selectedSymbol]
        const prevData = priceData[selectedSymbol]
        const previousPrice = prevData?.price || currentData.price
        
        const events = generateMarketEvents(
          selectedSymbol,
          currentData.price,
          previousPrice,
          currentData.bid,
          currentData.ask,
          currentData.volume,
          Math.random() * 0.0002 - 0.0001 // Random funding rate for demo
        )
        
        if (events.length > 0) {
          setMarketEvents(prev => [...events, ...prev].slice(0, 10))
        }
      }
      
      // 更新持仓的当前价格
      setPositions(prev => prev.map(pos => {
        const currentPrice = newPrices[pos.symbol]?.price || pos.currentPrice
        const pnl = (currentPrice - pos.avgPrice) * pos.qty
        const pnlPercent = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100
        return { ...pos, currentPrice, pnl, pnlPercent, value: currentPrice * Math.abs(pos.qty) }
      }))
    } catch (error) {
      console.error('Price fetch error:', error)
    }
  }

  // 初始化
  useEffect(() => {
    setPositions([
      { symbol: 'BTC', qty: 2.5, avgPrice: 94500, currentPrice: 95200, pnl: 1750, pnlPercent: 0.74, value: 238000 },
      { symbol: 'ETH', qty: 15, avgPrice: 3450, currentPrice: 3520, pnl: 1050, pnlPercent: 2.03, value: 52800 },
      { symbol: 'SOL', qty: 100, avgPrice: 175, currentPrice: 182, pnl: 700, pnlPercent: 4.0, value: 18200 },
      { symbol: 'AAPL', qty: -50, avgPrice: 188, currentPrice: 185, pnl: 150, pnlPercent: 1.6, value: 9250 },
      { symbol: 'NVDA', qty: 20, avgPrice: 495, currentPrice: 505, pnl: 200, pnlPercent: 2.02, value: 10100 },
    ])
    setTotalPnL(3850)

    setOrders([
      { id: 'ORD001', symbol: 'BTC', side: 'BUY', type: 'LIMIT', price: 94800, qty: 0.5, filled: 0, status: 'NEW', time: '10:32:15' },
      { id: 'ORD002', symbol: 'ETH', side: 'SELL', type: 'LIMIT', price: 3580, qty: 5, filled: 2, status: 'PARTIAL', time: '10:31:42' },
      { id: 'ORD003', symbol: 'SOL', side: 'BUY', type: 'STOP', price: 190, qty: 25, filled: 0, status: 'NEW', time: '10:28:03' },
    ])

    setTrades([
      { id: 'T001', symbol: 'BTC', side: 'BUY', price: 95150, qty: 0.25, time: '10:45:32' },
      { id: 'T002', symbol: 'ETH', side: 'SELL', price: 3515, qty: 3, time: '10:42:18' },
      { id: 'T003', symbol: 'SOL', side: 'BUY', price: 181.5, qty: 50, time: '10:38:55' },
      { id: 'T004', symbol: 'AAPL', side: 'SELL', price: 185.2, qty: 25, time: '10:35:12' },
      { id: 'T005', symbol: 'NVDA', side: 'BUY', price: 504, qty: 10, time: '10:30:45' },
    ])

    setAlerts([
      { id: 'A001', symbol: 'BTC', type: 'PRICE_ABOVE', value: 100000, active: true },
      { id: 'A002', symbol: 'ETH', type: 'PRICE_BELOW', value: 3000, active: true },
      { id: 'A003', symbol: 'SOL', type: 'VOLUME_SPIKE', value: 5000000000, active: false },
    ])
  }, [])

  useEffect(() => {
    fetchPrices()
    // 每2秒刷新一次价格 / Refresh prices every 2 seconds
    const interval = setInterval(fetchPrices, 2000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const currentPrice = priceData[selectedSymbol]?.price || 95000
    // 当资产切换或价格变化超过阈值时更新订单簿
    const symbolChanged = symbolRef.current !== selectedSymbol
    const priceThreshold = currentPrice * 0.0001 // 0.01% 阈值
    const priceChanged = Math.abs(currentPrice - priceRef.current) > priceThreshold
    
    if (symbolChanged || priceChanged) {
      setOrderBook(generateOrderBook(currentPrice))
      setOrderPrice((currentPrice ?? 0).toFixed(2))
      priceRef.current = currentPrice
      symbolRef.current = selectedSymbol
    }
  }, [selectedSymbol, priceData, generateOrderBook])

  // 键盘快捷键
  useEffect(() => {
    if (!hotkeys) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      
      switch(e.key.toUpperCase()) {
        case 'B': setOrderSide('BUY'); break
        case 'S': setOrderSide('SELL'); break
        case 'M': setOrderType('MARKET'); break
        case 'L': setOrderType('LIMIT'); break
        case 'ENTER': handlePlaceOrder(); break
        case 'ESCAPE': handleCancelAll(); break
        case '1': setLeverage(1); break
        case '2': setLeverage(2); break
        case '5': setLeverage(5); break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hotkeys, orderPrice, orderQty, orderSide, orderType, selectedSymbol])

  // 生产级订单提交 / Production-grade order submission
  const handlePlaceOrder = async () => {
    if (!orderQty) {
      addNotification('warning', 'Invalid Order / 无效订单', 'Please enter quantity / 请输入数量')
      return
    }
    
    const price = parseFloat(orderPrice) || priceData[selectedSymbol]?.price || 0
    const qty = parseFloat(orderQty)
    
    if (qty <= 0) {
      addNotification('warning', 'Invalid Quantity / 无效数量', 'Quantity must be positive / 数量必须大于0')
      return
    }
    
    if (orderType === 'LIMIT' && (!orderPrice || parseFloat(orderPrice) <= 0)) {
      addNotification('warning', 'Invalid Price / 无效价格', 'Limit order requires price / 限价单需要价格')
      return
    }

    // Check market status - NEW
    const marketStatus = getMarketStatus(selectedSymbol)
    if (!marketStatus.canPlaceOrder) {
      addNotification('warning', 'Market Closed / 市场关闭', 
        `${selectedSymbol} market is ${marketStatus.status}. ${marketStatus.reason || 'Orders not allowed'}`)
      return
    }

    // Determine account type
    const isCrypto = CRYPTO_ASSETS.some(a => a.symbol === selectedSymbol)
    const accountType = isCrypto ? 'crypto' : 'equity'
    const selectedAccount = accountType === 'crypto' ? account.cryptoAccount : account.equityAccount

    const orderValue = price * qty
    const maxLeverage = accountType === 'crypto' ? 20 : 5
    
    // Validate leverage limit
    if (leverage > maxLeverage) {
      addNotification('warning', 'Leverage Limit / 杠杆限制', 
        `${accountType === 'crypto' ? 'Crypto' : 'Equity'} max leverage is ${maxLeverage}x`)
      return
    }
    
    // Validate margin usage - NEW
    const marginValidation = account.validateMarginUsage(selectedSymbol, leverage, accountType)
    if (!marginValidation.isValid) {
      addNotification('warning', 'Margin Validation Failed / 保证金验证失败', marginValidation.reason || '')
      return
    }

    const marginRequired = orderValue / leverage
    if (selectedAccount.cash < marginRequired) {
      addNotification('warning', 'Insufficient Margin / 保证金不足', 
        `Required: ${formatCurrency(marginRequired)}, Available: ${formatCurrency(selectedAccount.cash)}`)
      return
    }
    
    const newOrder: Order = {
      id: `ORD${Date.now()}`,
      symbol: selectedSymbol,
      side: orderSide,
      type: orderType,
      price: price,
      qty: qty,
      filled: 0,
      status: 'NEW',
      time: new Date().toLocaleTimeString('en-US', { hour12: false })
    }
    
    setOrders(prev => [newOrder, ...prev])
    addNotification('info', 'Order Placed / 订单已提交', `Executing with simulated delays and realistic fills...`)

    // Simulate order execution with delays, failures, and partial fills - NEW
    const executionDelay = Math.random() * 400 + 100 // 100-500ms
    
    setTimeout(async () => {
      const currentBid = priceData[selectedSymbol]?.bid || price
      const currentAsk = priceData[selectedSymbol]?.ask || price
      
      // Simulate execution with possible failures and partial fills
      const execution = simulateOrderExecution(
        qty,
        price,
        currentBid,
        currentAsk,
        orderType,
        orderSide,
        0.85 // 85% liquidity default
      )

      if (!execution.success) {
        // Order failed
        setOrders(prev => prev.map(o => 
          o.id === newOrder.id ? { ...o, status: 'CANCELLED' as const } : o
        ))
        addNotification('error', 'Order Failed / 订单失败', execution.failureReason || 'Unknown error')
        return
      }

      // Calculate fees
      const executionFee = calculateExecutionFee(execution.executedQty, execution.executedPrice, 0.001)
      account.updateFees(executionFee, accountType)

      // Update order status
      const isFilled = execution.executedQty === qty
      setOrders(prev => prev.map(o => 
        o.id === newOrder.id 
          ? { 
              ...o, 
              filled: execution.executedQty, 
              status: isFilled ? 'FILLED' as const : 'PARTIAL' as const,
              price: execution.executedPrice
            } 
          : o
      ))

      // Record trade
      const newTrade: Trade = {
        id: `T${Date.now()}`,
        symbol: selectedSymbol,
        side: orderSide,
        price: execution.executedPrice,
        qty: execution.executedQty,
        time: new Date().toLocaleTimeString('en-US', { hour12: false })
      }
      setTrades(prev => [newTrade, ...prev].slice(0, 100))

      // Add to account context
      account.addTrade({
        id: newTrade.id,
        symbol: selectedSymbol,
        quantity: execution.executedQty,
        executionPrice: execution.executedPrice,
        side: orderSide,
        fee: executionFee,
        timestamp: Date.now(),
      }, accountType)

      // Update position
      updatePosition(selectedSymbol, orderSide, execution.executedQty, execution.executedPrice, accountType)

      addNotification(
        'trade',
        `Order ${isFilled ? 'Filled' : 'Partially Filled'} / 订单${isFilled ? '成交' : '部分成交'}`,
        `${orderSide} ${execution.executedQty.toFixed(4)} ${selectedSymbol} @ ${formatCurrency(execution.executedPrice)}`,
        { symbol: selectedSymbol, side: orderSide, qty: execution.executedQty, price: execution.executedPrice }
      )

      if (execution.partialFill) {
        addNotification('warning', 'Partial Fill / 部分成交', 
          `Only ${execution.executedQty.toFixed(4)} of ${qty} filled. Remaining ${(qty - execution.executedQty).toFixed(4)} cancelled.`)
      }
    }, executionDelay)
    
    setOrderQty('')
    if (orderType !== 'LIMIT') setOrderPrice('')
  }
  
  // Enhanced position update with account context
  const updatePosition = (symbol: string, side: 'BUY' | 'SELL', qty: number, price: number, _accountType: 'crypto' | 'equity') => {
    setPositions(prev => {
      const existing = prev.find(p => p.symbol === symbol)
      if (existing) {
        const newQty = side === 'BUY' ? existing.qty + qty : existing.qty - qty
        if (Math.abs(newQty) < 0.0001) {
          // Close position
          return prev.filter(p => p.symbol !== symbol)
        }
        const newAvgPrice = side === 'BUY' 
          ? (existing.avgPrice * existing.qty + price * qty) / (existing.qty + qty)
          : existing.avgPrice
        
        const currentPrice = priceData[symbol]?.price || price
        const unrealizedPnL = (currentPrice - newAvgPrice) * newQty

        return prev.map(p => p.symbol === symbol ? {
          ...p,
          qty: newQty,
          avgPrice: newAvgPrice,
          currentPrice: currentPrice,
          pnl: unrealizedPnL,
          pnlPercent: ((currentPrice - newAvgPrice) / newAvgPrice) * 100,
          value: Math.abs(newQty * currentPrice)
        } : p)
      } else if (side === 'BUY') {
        const currentPrice = priceData[symbol]?.price || price
        return [...prev, {
          symbol,
          qty,
          avgPrice: price,
          currentPrice,
          pnl: 0,
          pnlPercent: 0,
          value: qty * currentPrice
        }]
      }
      return prev
    })
  }

  const handleCancelOrder = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' as const } : o))
    addNotification('info', 'Order Cancelled / 订单已取消', `Order ${orderId.slice(-6)} cancelled / 订单 ${orderId.slice(-6)} 已取消`)
  }

  const handleCancelAll = () => {
    const activeOrders = orders.filter(o => o.status === 'NEW' || o.status === 'PARTIAL')
    setOrders(prev => prev.map(o => 
      o.status === 'NEW' || o.status === 'PARTIAL' 
        ? { ...o, status: 'CANCELLED' as const } 
        : o
    ))
    if (activeOrders.length > 0) {
      addNotification('info', 'All Orders Cancelled / 全部订单已取消', `${activeOrders.length} orders cancelled / ${activeOrders.length} 个订单已取消`)
    }
  }

  const handleClosePosition = (symbol: string) => {
    const position = positions.find(p => p.symbol === symbol)
    if (position) {
      setPositions(prev => prev.filter(p => p.symbol !== symbol))
      addNotification('trade', 'Position Closed / 持仓已平', 
        `${symbol} ${position.qty > 0 ? 'LONG' : 'SHORT'} closed, P&L: ${formatCurrency(position.pnl)}`)
    }
  }

  const calculatePositionSize = () => {
    const currentPrice = priceData[selectedSymbol]?.price || 0
    if (!currentPrice) return 0
    const riskAmount = accountBalance * (riskPercent / 100)
    return (riskAmount * leverage) / currentPrice
  }

  const currentData = priceData[selectedSymbol]
  const allAssets = [...CRYPTO_ASSETS, ...STOCK_ASSETS]
  const filteredAssets = searchQuery 
    ? allAssets.filter(a => a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allAssets

  const totalPositionValue = positions.reduce((sum, p) => sum + p.value, 0)
  const activeOrdersCount = orders.filter(o => o.status === 'NEW' || o.status === 'PARTIAL').length

  // Get market status for selected symbol
  const currentMarketStatus = getMarketStatus(selectedSymbol)
  
  // Determine account type based on selected asset
  const isCryptoAsset = CRYPTO_ASSETS.some(a => a.symbol === selectedSymbol)
  const currentAccountType = isCryptoAsset ? 'crypto' : 'equity'
  const selectedAccount = isCryptoAsset ? account.cryptoAccount : account.equityAccount
  
  // Calculate risk metrics for active position
  const activePosition = positions.find(p => p.symbol === selectedSymbol)

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#e0e0e0] font-mono text-xs flex flex-col overflow-hidden">
      {/* 全局导航栏 / Global Navigation */}
      <GlobalNavbar 
        accountBalance={accountBalance}
        dailyPnL={dailyPnL}
        weeklyPnL={weeklyPnL}
        winRate={winRate}
        sharpeRatio={sharpeRatio}
        showMetrics={true}
        compact={true}
      />

      {/* 交易工具栏 / Trading Toolbar */}
      <div className="h-8 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-[#00ff88] animate-pulse" />
            <span className="text-[#00ff88]">LIVE / 实时</span>
          </div>
          <span className="text-[#888]">SELECTED / 已选: <span className="text-white font-bold">{selectedSymbol}</span></span>
          <span className="text-[#888]">LEVERAGE / 杠杆: <span className="text-[#00aaff]">{leverage}x</span></span>
          
          {/* Market Status Badge - NEW */}
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
            currentMarketStatus.status === 'OPEN' ? 'bg-[#00ff8830] text-[#00ff88]' : 
            currentMarketStatus.status === 'AFTER_HOURS' ? 'bg-[#00aaff30] text-[#00aaff]' : 
            currentMarketStatus.status === 'PRE_MARKET' ? 'bg-[#aa00ff30] text-[#aa00ff]' : 
            'bg-[#ff444430] text-[#ff4444]'
          }`}>
            {currentMarketStatus.status.replace('_', ' ')}
          </span>
          
          {/* Account Type Badge - NEW */}
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
            currentAccountType === 'crypto' ? 'bg-[#ffaa0030] text-[#ffaa00]' : 'bg-[#00aaff30] text-[#00aaff]'
          }`}>
            {currentAccountType.toUpperCase()} ACCT
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Account Equity Display - NEW */}
          <span className="text-[#888]">EQUITY / 资产: <span className="text-[#00ff88]">{formatCurrency(selectedAccount.equity)}</span></span>
          <span className="text-[#888]">CASH / 现金: <span className="text-white">{formatCurrency(selectedAccount.cash)}</span></span>
          <span className="text-[#888]">HOTKEYS / 快捷键: 
            <button onClick={() => setHotkeys(!hotkeys)} className={`ml-1 ${hotkeys ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
              {hotkeys ? 'ON / 开' : 'OFF / 关'}
            </button>
          </span>
          <span className="text-[#888]">POSITIONS / 持仓: <span className="text-white">{positions.length}</span></span>
          <span className="text-[#888]">ORDERS / 订单: <span className="text-white">{activeOrdersCount}</span></span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧市场列表 */}
        <div className="w-52 border-r border-[#1a1a1a] flex flex-col bg-[#0d0d0d]">
          <div className="h-8 border-b border-[#1a1a1a] flex items-center px-2 gap-2">
            <Search className="h-3 w-3 text-[#666]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-[#888] focus:outline-none text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredAssets.slice(0, 24).map((asset) => {
              const data = priceData[asset.symbol]
              const isSelected = selectedSymbol === asset.symbol
              const hasPosition = positions.some(p => p.symbol === asset.symbol)
              return (
                <div
                  key={asset.id}
                  onClick={() => setSelectedSymbol(asset.symbol)}
                  className={`flex items-center justify-between px-2 py-1.5 cursor-pointer border-b border-[#151515] hover:bg-[#151515] ${
                    isSelected ? 'bg-[#0a1a0a] border-l-2 border-l-[#00ff88]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* 专业资产图标 */}
                    {getAssetIcon(asset.symbol)}
                    <div className="flex flex-col">
                      <span className={`font-semibold ${isSelected ? 'text-[#00ff88]' : 'text-[#ccc]'}`}>{asset.symbol}</span>
                      {hasPosition && <span className="text-[8px] text-[#00aaff]">● POSITION</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#fff] text-[10px] font-mono">{data ? formatCurrency(data.price, 2) : '--'}</div>
                    {data && (
                      <div className={`text-[9px] font-mono ${(data.changePercent ?? 0) >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                        {(data.changePercent ?? 0) >= 0 ? '+' : ''}{formatPercentage(data.changePercent ?? 0)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 中间主区域 */}
        <div className="flex-1 flex flex-col">
          {/* 资产信息条 */}
          <div className="h-14 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center px-4 gap-6">
            <div className="flex items-center gap-3">
              {/* 大图标 */}
              <div className="scale-150">{getAssetIcon(selectedSymbol)}</div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-[#00ff88]">{selectedSymbol}</span>
                  <span className="text-[#555]">/USD</span>
                </div>
                <span className="text-[9px] text-[#666]">{CRYPTO_ASSETS.find(a => a.symbol === selectedSymbol)?.name || STOCK_ASSETS.find(a => a.symbol === selectedSymbol)?.name || selectedSymbol}</span>
              </div>
            </div>
            {currentData && (
              <>
                <div>
                  <div className="text-[10px] text-[#666]">LAST</div>
                  <div className="text-[#fff] text-lg font-bold">{formatCurrency(currentData.price)}</div>
                </div>
                <div className={currentData.changePercent >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}>
                  <div className="text-[10px] text-[#666]">24H CHG</div>
                  <div className="flex items-center gap-1 text-sm">
                    {currentData.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {formatPercentage(currentData.changePercent)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#666]">BID</div>
                  <div className="text-[#00ff88]">{formatCurrency(currentData.bid)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#666]">ASK</div>
                  <div className="text-[#ff4444]">{formatCurrency(currentData.ask)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#666]">SPREAD</div>
                  <div className="text-[#ffaa00]">{(currentData.spread ?? 0).toFixed(4)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#666]">24H VOL</div>
                  <div className="text-[#fff]">${((currentData.volume ?? 0) / 1e9).toFixed(2)}B</div>
                </div>
              </>
            )}
            {/* 图表类型选择器 */}
            <div className="ml-auto flex items-center gap-3">
              <ChartTypeSelector value={chartType} onChange={setChartType} />
              <div className="flex items-center gap-1">
                {['1M', '5M', '15M', '1H', '4H', '1D'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setChartTimeframe(tf)}
                    className={`px-2 py-0.5 text-[10px] rounded ${chartTimeframe === tf ? 'bg-[#333] text-[#fff]' : 'text-[#666] hover:text-[#888]'}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 专业图表区域 */}
          <div className="h-56 bg-[#0a0a0a] border-b border-[#1a1a1a]">
            <ProfessionalChart
              key={`${selectedSymbol}-${currentData?.price?.toFixed(0) || 0}`}
              symbol={selectedSymbol}
              basePrice={currentData?.price || 95000}
              chartType={chartType as any}
              timeframe={chartTimeframe}
              height={220}
              showIndicators={true}
            />
          </div>

          {/* Market Events Tags Row - NEW */}
          {marketEvents.length > 0 && (
            <div className="h-8 bg-[#0d0d0d] border-b border-[#1a1a1a] flex items-center px-3 gap-2 overflow-x-auto">
              <span className="text-[#666] text-[9px]">EVENTS:</span>
              <EventTags events={marketEvents} compact={true} />
            </div>
          )}

          {/* 订单簿 + 交易面板 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 订单簿 */}
            <div className="w-64 border-r border-[#1a1a1a] flex flex-col bg-[#0d0d0d]">
              <div className="h-6 bg-[#111] border-b border-[#1a1a1a] flex items-center justify-between px-2 text-[#666]">
                <span>ORDER BOOK</span>
                <span className="text-[9px]">DEPTH</span>
              </div>
              
              {/* 卖单 */}
              <div className="flex-1 overflow-hidden flex flex-col-reverse">
                {orderBook.asks.slice(0, 12).reverse().map((ask, i) => (
                  <div key={i} className="flex items-center px-2 py-0.5 hover:bg-[#151515] relative cursor-pointer" onClick={() => setOrderPrice((ask.price ?? 0).toFixed(2))}>
                    <div className="absolute left-0 top-0 bottom-0 bg-[#ff444415]" style={{ width: `${Math.min((ask.total ?? 0) / 300 * 100, 100)}%` }} />
                    <span className={`w-20 text-[10px] relative z-10 ${ask.myOrder ? 'text-[#ffaa00]' : 'text-[#ff4444]'}`}>{formatCurrency(ask.price ?? 0, 2)}</span>
                    <span className="w-14 text-right text-[10px] text-[#888] relative z-10">{(ask.qty ?? 0).toFixed(3)}</span>
                    <span className="w-14 text-right text-[9px] text-[#555] relative z-10">{(ask.total ?? 0).toFixed(1)}</span>
                    {ask.myOrder && <span className="absolute right-1 text-[8px] text-[#ffaa00]">★</span>}
                  </div>
                ))}
              </div>

              {/* 中间价格 */}
              <div className="h-8 bg-[#111] border-y border-[#222] flex items-center justify-center gap-2">
                <span className="text-[#fff] font-bold text-sm">{currentData ? formatCurrency(currentData.price) : '--'}</span>
                {currentData && (
                  <span className={`text-[10px] ${currentData.changePercent >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
                    {currentData.changePercent >= 0 ? '▲' : '▼'} {Math.abs(currentData.change || 0).toFixed(2)}
                  </span>
                )}
              </div>

              {/* 买单 */}
              <div className="flex-1 overflow-hidden">
                {orderBook.bids.slice(0, 12).map((bid, i) => (
                  <div key={i} className="flex items-center px-2 py-0.5 hover:bg-[#151515] relative cursor-pointer" onClick={() => setOrderPrice((bid.price ?? 0).toFixed(2))}>
                    <div className="absolute left-0 top-0 bottom-0 bg-[#00ff8815]" style={{ width: `${Math.min((bid.total ?? 0) / 300 * 100, 100)}%` }} />
                    <span className={`w-20 text-[10px] relative z-10 ${bid.myOrder ? 'text-[#ffaa00]' : 'text-[#00ff88]'}`}>{formatCurrency(bid.price ?? 0, 2)}</span>
                    <span className="w-14 text-right text-[10px] text-[#888] relative z-10">{(bid.qty ?? 0).toFixed(3)}</span>
                    <span className="w-14 text-right text-[9px] text-[#555] relative z-10">{(bid.total ?? 0).toFixed(1)}</span>
                    {bid.myOrder && <span className="absolute right-1 text-[8px] text-[#ffaa00]">★</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* 交易面板 */}
            <div className="w-64 border-r border-[#1a1a1a] flex flex-col bg-[#0d0d0d]">
              <div className="h-6 bg-[#111] border-b border-[#1a1a1a] flex items-center px-2 text-[#666]">ORDER ENTRY</div>
              
              <div className="p-2 space-y-2 flex-1">
                {/* 买卖切换 */}
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => setOrderSide('BUY')} className={`py-1.5 font-bold text-xs ${orderSide === 'BUY' ? 'bg-[#00ff88] text-[#000]' : 'bg-[#1a1a1a] text-[#666] hover:bg-[#222]'}`}>BUY [B]</button>
                  <button onClick={() => setOrderSide('SELL')} className={`py-1.5 font-bold text-xs ${orderSide === 'SELL' ? 'bg-[#ff4444] text-[#fff]' : 'bg-[#1a1a1a] text-[#666] hover:bg-[#222]'}`}>SELL [S]</button>
                </div>

                {/* 订单类型 */}
                <div className="grid grid-cols-5 gap-0.5">
                  {(['LIMIT', 'MARKET', 'STOP', 'IOC', 'FOK'] as const).map((type) => (
                    <button key={type} onClick={() => setOrderType(type)} className={`py-0.5 text-[9px] ${orderType === type ? 'bg-[#333] text-[#fff]' : 'bg-[#1a1a1a] text-[#555] hover:bg-[#222]'}`}>{type}</button>
                  ))}
                </div>

                {/* 杠杆 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#555] text-[9px]">LEVERAGE</span>
                    <span className="text-[#00aaff] text-[9px]">{leverage}x</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 5, 10, 20].map((lev) => (
                      <button key={lev} onClick={() => setLeverage(lev)} className={`flex-1 py-0.5 text-[9px] ${leverage === lev ? 'bg-[#00aaff] text-[#000]' : 'bg-[#1a1a1a] text-[#666] hover:bg-[#222]'}`}>{lev}x</button>
                    ))}
                  </div>
                </div>

                {/* 价格 */}
                <div>
                  <label className="text-[#555] text-[9px]">PRICE</label>
                  <div className="flex">
                    <button onClick={() => setOrderPrice((p) => ((parseFloat(p) || 0) - 1).toFixed(2))} className="px-2 bg-[#1a1a1a] text-[#888] hover:bg-[#222]"><Minus className="h-3 w-3" /></button>
                    <input type="text" value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} className="flex-1 bg-[#111] border-y border-[#222] px-2 py-1 text-[#fff] text-center text-xs focus:outline-none" disabled={orderType === 'MARKET'} />
                    <button onClick={() => setOrderPrice((p) => ((parseFloat(p) || 0) + 1).toFixed(2))} className="px-2 bg-[#1a1a1a] text-[#888] hover:bg-[#222]"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>

                {/* 数量 */}
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#555] text-[9px]">QUANTITY</span>
                    <button onClick={() => setOrderQty((calculatePositionSize() || 0).toFixed(4))} className="text-[8px] text-[#00aaff] hover:underline">RISK {riskPercent}%</button>
                  </div>
                  <input type="text" value={orderQty} onChange={(e) => setOrderQty(e.target.value)} className="w-full bg-[#111] border border-[#222] px-2 py-1 text-[#fff] text-xs focus:outline-none focus:border-[#00ff88]" placeholder="0.00" />
                </div>

                {/* 快速数量 */}
                <div className="grid grid-cols-4 gap-0.5">
                  {['0.01', '0.1', '0.5', '1'].map((qty) => (
                    <button key={qty} onClick={() => setOrderQty(qty)} className="py-0.5 text-[9px] bg-[#1a1a1a] text-[#666] hover:bg-[#222]">{qty}</button>
                  ))}
                </div>

                {/* 订单预览 */}
                <div className="bg-[#111] p-2 border border-[#1a1a1a] space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-[#555]">NOTIONAL</span>
                    <span className="text-[#fff]">{formatCurrency((parseFloat(orderPrice) || 0) * (parseFloat(orderQty) || 0))}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-[#555]">MARGIN REQ</span>
                    <span className="text-[#888]">{formatCurrency((parseFloat(orderPrice) || 0) * (parseFloat(orderQty) || 0) / leverage)}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span className="text-[#555]">FEE (0.02%)</span>
                    <span className="text-[#666]">{formatCurrency((parseFloat(orderPrice) || 0) * (parseFloat(orderQty) || 0) * 0.0002)}</span>
                  </div>
                </div>

                {/* 下单按钮 */}
                <button onClick={handlePlaceOrder} disabled={!orderQty} className={`w-full py-2.5 font-bold text-sm ${orderSide === 'BUY' ? 'bg-[#00ff88] text-[#000] hover:bg-[#00dd77]' : 'bg-[#ff4444] text-[#fff] hover:bg-[#dd3333]'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                  {orderType === 'MARKET' ? 'MARKET ' : ''}{orderSide} {selectedSymbol}
                </button>

                <button onClick={handleCancelAll} className="w-full py-1.5 text-[10px] bg-[#1a1a1a] text-[#ff4444] border border-[#ff444430] hover:bg-[#201515]">CANCEL ALL [{activeOrdersCount}]</button>
              </div>
            </div>

            {/* 右侧面板 */}
            <div className="flex-1 flex flex-col bg-[#0d0d0d]">
              {/* 标签页 */}
              <div className="h-6 bg-[#111] border-b border-[#1a1a1a] flex items-center px-2 gap-4 text-[10px]">
                {[
                  { key: 'positions', label: 'POSITIONS', count: positions.length },
                  { key: 'orders', label: 'ORDERS', count: activeOrdersCount },
                  { key: 'trades', label: 'TRADES', count: trades.length },
                  { key: 'alerts', label: 'ALERTS', count: alerts.filter(a => a.active).length },
                  { key: 'account', label: 'ACCOUNT', count: 0 },
                  { key: 'risk', label: 'RISK', count: activePosition ? 1 : 0 }
                ].map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`flex items-center gap-1 ${activeTab === tab.key ? 'text-[#fff]' : 'text-[#666] hover:text-[#888]'}`}>
                    {tab.label}
                    {tab.count > 0 && <span className={`px-1 rounded text-[8px] ${activeTab === tab.key ? 'bg-[#00ff88] text-[#000]' : 'bg-[#333]'}`}>{tab.count}</span>}
                  </button>
                ))}
                <div className="ml-auto text-[#888]">VALUE: <span className="text-[#fff]">{formatCurrency(totalPositionValue)}</span></div>
              </div>

              {/* 内容区域 */}
              <div className="flex-1 overflow-auto">
                {activeTab === 'positions' && (
                  <table className="w-full">
                    <thead className="bg-[#111] sticky top-0">
                      <tr className="text-[#555] text-left text-[9px]">
                        <th className="px-2 py-1">SYMBOL</th>
                        <th className="px-2 py-1 text-right">SIZE</th>
                        <th className="px-2 py-1 text-right">ENTRY</th>
                        <th className="px-2 py-1 text-right">MARK</th>
                        <th className="px-2 py-1 text-right">VALUE</th>
                        <th className="px-2 py-1 text-right">P&L</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr key={pos.symbol} className="border-b border-[#151515] hover:bg-[#111] text-[10px]">
                          <td className="px-2 py-1.5 text-[#fff] font-bold">{pos.symbol}</td>
                          <td className={`px-2 py-1.5 text-right ${pos.qty >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{pos.qty >= 0 ? '+' : ''}{pos.qty}</td>
                          <td className="px-2 py-1.5 text-right text-[#888]">{formatCurrency(pos.avgPrice)}</td>
                          <td className="px-2 py-1.5 text-right text-[#fff]">{formatCurrency(pos.currentPrice)}</td>
                          <td className="px-2 py-1.5 text-right text-[#888]">{formatCurrency(pos.value)}</td>
                          <td className={`px-2 py-1.5 text-right ${(pos.pnl ?? 0) >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{(pos.pnl ?? 0) >= 0 ? '+' : ''}{formatCurrency(pos.pnl ?? 0)} ({(pos.pnlPercent ?? 0).toFixed(2)}%)</td>
                          <td className="px-2 py-1.5"><button onClick={() => handleClosePosition(pos.symbol)} className="text-[#ff4444] hover:text-[#ff6666]"><X className="h-3 w-3" /></button></td>
                        </tr>
                      ))}
                      {positions.length > 0 && (
                        <tr className="bg-[#111] font-bold text-[10px]">
                          <td className="px-2 py-1.5 text-[#fff]" colSpan={4}>TOTAL</td>
                          <td className="px-2 py-1.5 text-right text-[#fff]">{formatCurrency(totalPositionValue)}</td>
                          <td className={`px-2 py-1.5 text-right ${totalPnL >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}</td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {activeTab === 'orders' && (
                  <table className="w-full">
                    <thead className="bg-[#111] sticky top-0">
                      <tr className="text-[#555] text-left text-[9px]">
                        <th className="px-2 py-1">TIME</th>
                        <th className="px-2 py-1">SYMBOL</th>
                        <th className="px-2 py-1">SIDE</th>
                        <th className="px-2 py-1">TYPE</th>
                        <th className="px-2 py-1 text-right">PRICE</th>
                        <th className="px-2 py-1 text-right">QTY</th>
                        <th className="px-2 py-1">STATUS</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id} className="border-b border-[#151515] hover:bg-[#111] text-[10px]">
                          <td className="px-2 py-1.5 text-[#555]">{order.time}</td>
                          <td className="px-2 py-1.5 text-[#fff]">{order.symbol}</td>
                          <td className={`px-2 py-1.5 ${order.side === 'BUY' ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{order.side}</td>
                          <td className="px-2 py-1.5 text-[#666]">{order.type}</td>
                          <td className="px-2 py-1.5 text-right text-[#fff]">{formatCurrency(order.price)}</td>
                          <td className="px-2 py-1.5 text-right text-[#888]">{order.filled}/{order.qty}</td>
                          <td className="px-2 py-1.5">
                            <span className={`px-1 py-0.5 text-[8px] ${order.status === 'FILLED' ? 'bg-[#00ff8830] text-[#00ff88]' : order.status === 'PARTIAL' ? 'bg-[#ffaa0030] text-[#ffaa00]' : order.status === 'CANCELLED' ? 'bg-[#ff444430] text-[#ff4444]' : 'bg-[#33333330] text-[#888]'}`}>{order.status}</span>
                          </td>
                          <td className="px-2 py-1.5">{(order.status === 'NEW' || order.status === 'PARTIAL') && <button onClick={() => handleCancelOrder(order.id)} className="text-[#ff4444] hover:text-[#ff6666]"><X className="h-3 w-3" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'trades' && (
                  <table className="w-full">
                    <thead className="bg-[#111] sticky top-0">
                      <tr className="text-[#555] text-left text-[9px]">
                        <th className="px-2 py-1">TIME</th>
                        <th className="px-2 py-1">SYMBOL</th>
                        <th className="px-2 py-1">SIDE</th>
                        <th className="px-2 py-1 text-right">PRICE</th>
                        <th className="px-2 py-1 text-right">QTY</th>
                        <th className="px-2 py-1 text-right">VALUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-[#151515] hover:bg-[#111] text-[10px]">
                          <td className="px-2 py-1.5 text-[#555]">{trade.time}</td>
                          <td className="px-2 py-1.5 text-[#fff]">{trade.symbol}</td>
                          <td className={`px-2 py-1.5 ${trade.side === 'BUY' ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>{trade.side}</td>
                          <td className="px-2 py-1.5 text-right text-[#fff]">{formatCurrency(trade.price)}</td>
                          <td className="px-2 py-1.5 text-right text-[#888]">{trade.qty}</td>
                          <td className="px-2 py-1.5 text-right text-[#888]">{formatCurrency(trade.price * trade.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'alerts' && (
                  <div className="p-2 space-y-2">
                    {alerts.map((alert) => (
                      <div key={alert.id} className={`flex items-center justify-between p-2 border ${alert.active ? 'border-[#00ff8830] bg-[#00ff8810]' : 'border-[#222] bg-[#111]'}`}>
                        <div className="flex items-center gap-2">
                          <Bell className={`h-3 w-3 ${alert.active ? 'text-[#00ff88]' : 'text-[#555]'}`} />
                          <span className="text-[#fff]">{alert.symbol}</span>
                          <span className="text-[#888] text-[10px]">{alert.type === 'PRICE_ABOVE' ? '>' : alert.type === 'PRICE_BELOW' ? '<' : 'VOL'} {formatCurrency(alert.value)}</span>
                        </div>
                        <button className="text-[#ff4444] hover:text-[#ff6666]"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <button className="w-full py-2 border border-dashed border-[#333] text-[#555] hover:border-[#555] hover:text-[#888] text-[10px] flex items-center justify-center gap-1"><Plus className="h-3 w-3" /> ADD ALERT</button>
                  </div>
                )}

                {/* Account Breakdown Tab - NEW */}
                {activeTab === 'account' && (
                  <div className="p-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <AccountBreakdown accountType="crypto" showChart={false} />
                      <AccountBreakdown accountType="equity" showChart={false} />
                    </div>
                    
                    {/* Market Status Section */}
                    <div className="mt-4">
                      <h4 className="text-[#888] text-[10px] mb-2">MARKET STATUS</h4>
                      <MarketStatusBar symbol={selectedSymbol} />
                    </div>
                  </div>
                )}

                {/* Risk Metrics Tab - NEW */}
                {activeTab === 'risk' && (
                  <div className="p-3 space-y-3">
                    {activePosition ? (
                      <RiskMeter 
                        position={{
                          avgCostPrice: activePosition.avgPrice,
                          currentPrice: activePosition.currentPrice,
                          quantity: Math.abs(activePosition.qty),
                          leverage: leverage,
                          equity: selectedAccount.equity,
                          side: activePosition.qty > 0 ? 'LONG' : 'SHORT'
                        }}
                        showDetails={true}
                      />
                    ) : (
                      <div className="text-center text-[#666] py-8">
                        <p className="text-sm mb-2">No active position for {selectedSymbol}</p>
                        <p className="text-[10px]">Open a position to see risk metrics</p>
                      </div>
                    )}
                    
                    {/* PnL Breakdown for current account */}
                    <div className="bg-[#111] p-3 border border-[#1a1a1a]">
                      <h4 className="text-[#888] text-[10px] mb-3">PNL BREAKDOWN ({currentAccountType.toUpperCase()})</h4>
                      <div className="space-y-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-[#666]">Unrealized PnL:</span>
                          <span className={selectedAccount.unrealizedPnL >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}>
                            {formatCurrency(selectedAccount.unrealizedPnL)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#666]">Realized PnL:</span>
                          <span className={selectedAccount.realizedPnL >= 0 ? 'text-[#00ff88]' : 'text-[#ff4444]'}>
                            {formatCurrency(selectedAccount.realizedPnL)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#666]">Total Fees:</span>
                          <span className="text-[#ffaa00]">-{formatCurrency(selectedAccount.totalFees)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#666]">Funding Cost:</span>
                          <span className="text-[#ffaa00]">-{formatCurrency(selectedAccount.totalFundingCost)}</span>
                        </div>
                        <div className="border-t border-[#222] pt-2 flex justify-between font-bold">
                          <span className="text-[#888]">Net PnL:</span>
                          <span className={
                            (selectedAccount.unrealizedPnL + selectedAccount.realizedPnL - selectedAccount.totalFees - selectedAccount.totalFundingCost) >= 0 
                              ? 'text-[#00ff88]' : 'text-[#ff4444]'
                          }>
                            {formatCurrency(
                              selectedAccount.unrealizedPnL + selectedAccount.realizedPnL - 
                              selectedAccount.totalFees - selectedAccount.totalFundingCost
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部快捷键提示 */}
      <div className="h-6 bg-[#0f0f0f] border-t border-[#1a1a1a] flex items-center justify-between px-4 text-[9px]">
        <div className="flex items-center gap-6 text-[#555]">
          <span><span className="text-[#888]">[B]</span> Buy</span>
          <span><span className="text-[#888]">[S]</span> Sell</span>
          <span><span className="text-[#888]">[L]</span> Limit</span>
          <span><span className="text-[#888]">[M]</span> Market</span>
          <span><span className="text-[#888]">[ENTER]</span> Place</span>
          <span><span className="text-[#888]">[ESC]</span> Cancel</span>
          <span><span className="text-[#888]">[1/2/5]</span> Leverage</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#ffaa00] flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> RISK: {riskPercent}%</span>
          <span className="text-[#888]">MARGIN: <span className="text-[#fff]">{(((totalPositionValue ?? 0) / (accountBalance || 1)) * 100).toFixed(1)}%</span></span>
        </div>
      </div>
    </div>
  )
}
