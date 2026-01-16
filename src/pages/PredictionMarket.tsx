import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, DollarSign, CheckCircle, TrendingUp, 
  Clock, Flame, Star, Zap, BarChart3, History, Wallet,
  Search, Newspaper, RefreshCw, ExternalLink, Bell, BellRing,
  Trophy, Eye, X
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, Legend, ReferenceLine } from 'recharts'
import { GlobalNavbar } from '@/components/GlobalNavbar'

// ==================== 价格提醒接口 / Price Alert Interface ====================
interface PriceAlert {
  id: string
  marketId: string
  marketName: string
  targetPrice: number
  condition: 'above' | 'below'
  isTriggered: boolean
  createdAt: string
}

// ==================== 双语显示组件 / Bilingual Display Component ====================
const Bilingual = ({ en, zh, className = '' }: { en: string; zh: string; className?: string }) => (
  <span className={className}>
    <span className="text-white">{en}</span>
    <span className="text-gray-400 ml-1">/ {zh}</span>
  </span>
)

const BilingualBlock = ({ en, zh, enClass = '', zhClass = '' }: { en: string; zh: string; enClass?: string; zhClass?: string }) => (
  <div>
    <div className={enClass || 'text-white'}>{en}</div>
    <div className={zhClass || 'text-gray-400 text-sm'}>{zh}</div>
  </div>
)

interface Market {
  ID: string
  Name: string
  NameZh: string
  Description: string
  DescriptionZh: string
  Outcomes: string[]
  State: string
  CreatedAt: string
  Volume?: number
  Participants?: number
  EndDate?: string
  Category?: string
  YesPrice?: number
  NoPrice?: number
  // 实时数据
  dataSource?: string
  livePrice?: number
  priceChange24h?: number
  // Polymarket 数据
  polymarketId?: string
  isRealData?: boolean
  // 外部平台标识 - 扩展支持社交媒体平台
  externalPlatform?: 'polymarket' | 'metaculus' | 'manifold' | 'kalshi' | 'predictit' | 'insight' | 'twitter' | 'reddit' | 'youtube' | 'tiktok' | 'discord' | 'telegram' | 'local'
  externalUrl?: string
  // 社交媒体热度数据
  trendingScore?: number
  engagementCount?: number
  sourcePlatform?: string
}

interface NewsItem {
  id: string
  title: string
  titleZh: string
  source: string
  url: string
  publishedAt: string
  category: string
  relatedMarkets: string[]
}

interface BetHistory {
  id: string
  market: string
  outcome: string
  amount: number
  odds: number
  status: 'active' | 'won' | 'lost'
  pnl: number
  time: string
}

interface PolymarketEvent {
  id: string
  title: string
  slug: string
  volume: number
  liquidity: number
  endDate: string
  markets: {
    id: string
    question: string
    outcomePrices: string
    volume: string
  }[]
}

const generatePriceHistory = (basePrice: number = 0.5) => {
  const data = []
  let price = basePrice
  for (let i = 0; i < 30; i++) {
    price = Math.max(0.05, Math.min(0.95, price + (Math.random() - 0.5) * 0.06))
    data.push({ day: `${i + 1}`, yes: price, no: 1 - price })
  }
  // 最后一天使用实际价格
  data[data.length - 1] = { day: '30', yes: basePrice, no: 1 - basePrice }
  return data
}

// 生成增强历史数据（多个时间段对比）
const generateEnhancedHistory = (basePrice: number = 0.5) => {
  const data = []
  let price7d = basePrice * 0.85
  let price30d = basePrice * 0.7
  let priceCurrent = basePrice
  
  for (let i = 0; i < 30; i++) {
    price7d = Math.max(0.05, Math.min(0.95, price7d + (Math.random() - 0.45) * 0.04))
    price30d = Math.max(0.05, Math.min(0.95, price30d + (Math.random() - 0.4) * 0.03))
    priceCurrent = Math.max(0.05, Math.min(0.95, priceCurrent + (Math.random() - 0.5) * 0.05))
    
    data.push({ 
      day: `Day ${i + 1}`, 
      current: priceCurrent,
      week: price7d,
      month: price30d,
    })
  }
  // 最后使用实际价格
  data[data.length - 1].current = basePrice
  return data
}

// 翻译映射 - 将英文市场名翻译为中文
const translateToZh = (title: string): string => {
  const translations: Record<string, string> = {
    // 政治
    'trump': 'Trump相关',
    'biden': 'Biden相关',
    'president': '总统',
    'election': '选举',
    'republican': '共和党',
    'democrat': '民主党',
    // 加密
    'bitcoin': '比特币',
    'btc': 'BTC',
    'ethereum': '以太坊',
    'eth': 'ETH',
    'crypto': '加密货币',
    'solana': 'Solana',
    // 科技
    'ai': '人工智能',
    'openai': 'OpenAI',
    'apple': '苹果',
    'google': '谷歌',
    'microsoft': '微软',
    // 体育
    'super bowl': '超级碗',
    'nba': 'NBA',
    'world cup': '世界杯',
  }
  
  let result = title
  Object.entries(translations).forEach(([en, zh]) => {
    if (result.toLowerCase().includes(en.toLowerCase())) {
      result = `${result} (${zh})`
      return
    }
  })
  return result === title ? `${title} (预测市场)` : result
}

// 分类映射
const categorizeMarket = (title: string): string => {
  const lower = title.toLowerCase()
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president') || lower.includes('congress')) return 'politics'
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('ethereum') || lower.includes('eth') || lower.includes('crypto') || lower.includes('solana')) return 'crypto'
  if (lower.includes('ai') || lower.includes('openai') || lower.includes('apple') || lower.includes('google') || lower.includes('tech')) return 'tech'
  if (lower.includes('stock') || lower.includes('nvidia') || lower.includes('tesla') || lower.includes('aapl')) return 'stocks'
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('gdp')) return 'finance'
  if (lower.includes('super bowl') || lower.includes('nba') || lower.includes('nfl') || lower.includes('world cup')) return 'sports'
  return 'other'
}

// 模拟新闻数据 - 中英双语 (2026年1月全球热门新闻)
// Simulated News Data - Bilingual (January 2026 Global Hot News)
// 每个类别至少10条新闻，用于智能匹配市场
const mockNews: NewsItem[] = [
  // ==================== 加密货币新闻 Crypto ====================
  { id: 'c1', title: 'Bitcoin ETF inflows hit record $2B in single day', titleZh: '比特币ETF单日流入创纪录达20亿美元', source: 'CoinDesk', url: 'https://coindesk.com', publishedAt: '2026-01-16 08:30', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'btc'] },
  { id: 'c2', title: 'Bitcoin price surges past $95,000 amid ETF optimism', titleZh: '比特币在ETF乐观情绪下突破9.5万美元', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-16 07:15', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'btc', '$150'] },
  { id: 'c3', title: 'Analysts predict Bitcoin could reach $150K by year end', titleZh: '分析师预测比特币年底可能达到15万美元', source: 'CoinTelegraph', url: 'https://cointelegraph.com', publishedAt: '2026-01-16 06:00', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'btc', '$150'] },
  { id: 'c4', title: 'Ethereum Layer 2 TVL surpasses $50 billion', titleZh: '以太坊Layer 2总锁仓价值突破500亿美元', source: 'The Block', url: 'https://theblock.co', publishedAt: '2026-01-16 05:15', category: 'crypto', relatedMarkets: ['crypto', 'ethereum', 'eth'] },
  { id: 'c5', title: 'Ethereum staking yields hit 5.2% as network activity rises', titleZh: '以太坊质押收益率达5.2%，网络活动增加', source: 'Decrypt', url: 'https://decrypt.co', publishedAt: '2026-01-15 23:30', category: 'crypto', relatedMarkets: ['crypto', 'ethereum', 'eth', '$10,000'] },
  { id: 'c6', title: 'ETH/BTC ratio shows signs of recovery', titleZh: 'ETH/BTC比率显示复苏迹象', source: 'CoinDesk', url: 'https://coindesk.com', publishedAt: '2026-01-15 22:00', category: 'crypto', relatedMarkets: ['crypto', 'ethereum', 'eth'] },
  { id: 'c7', title: 'Solana breaks daily transaction record at 150M TPS', titleZh: 'Solana日交易量达1.5亿TPS创记录', source: 'Decrypt', url: 'https://decrypt.co', publishedAt: '2026-01-15 21:45', category: 'crypto', relatedMarkets: ['crypto', 'solana', 'sol'] },
  { id: 'c8', title: 'Solana DeFi ecosystem surpasses $20B TVL', titleZh: 'Solana DeFi生态TVL突破200亿美元', source: 'The Block', url: 'https://theblock.co', publishedAt: '2026-01-15 20:30', category: 'crypto', relatedMarkets: ['crypto', 'solana', 'sol', 'ethereum'] },
  { id: 'c9', title: 'Institutional crypto adoption accelerates in 2026', titleZh: '2026年机构加密货币采用加速', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-15 19:00', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'ethereum'] },
  { id: 'c10', title: 'Crypto market cap reaches $5 trillion milestone', titleZh: '加密市场总市值达到5万亿美元里程碑', source: 'CoinMarketCap', url: 'https://coinmarketcap.com', publishedAt: '2026-01-15 18:00', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'ethereum'] },
  { id: 'c11', title: 'BlackRock Bitcoin ETF sees $500M daily inflows', titleZh: 'BlackRock比特币ETF日流入5亿美元', source: 'WSJ', url: 'https://wsj.com', publishedAt: '2026-01-15 16:30', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'btc'] },
  { id: 'c12', title: 'SEC approves new wave of crypto ETF applications', titleZh: 'SEC批准新一批加密ETF申请', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-15 15:00', category: 'crypto', relatedMarkets: ['crypto', 'bitcoin', 'ethereum'] },
  
  // ==================== 政治新闻 Politics ====================
  { id: 'p1', title: 'Trump announces 2028 campaign strategy and key policies', titleZh: 'Trump宣布2028竞选策略和关键政策', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-15 14:20', category: 'politics', relatedMarkets: ['politics', 'trump', '2028'] },
  { id: 'p2', title: 'Trump leads early 2028 presidential polls', titleZh: 'Trump在2028年总统早期民调中领先', source: 'Politico', url: 'https://politico.com', publishedAt: '2026-01-15 13:45', category: 'politics', relatedMarkets: ['politics', 'trump', '2028', 'election'] },
  { id: 'p3', title: 'GOP strategists outline Trump 2028 victory path', titleZh: '共和党策略师勾画Trump 2028胜利路径', source: 'Fox News', url: 'https://foxnews.com', publishedAt: '2026-01-15 12:30', category: 'politics', relatedMarkets: ['politics', 'trump', '2028', 'republican'] },
  { id: 'p4', title: 'Biden administration unveils new China policy framework', titleZh: 'Biden政府公布新的中国政策框架', source: 'WSJ', url: 'https://wsj.com', publishedAt: '2026-01-15 11:30', category: 'politics', relatedMarkets: ['politics', 'biden', 'china'] },
  { id: 'p5', title: 'Democrats strategize for 2026 midterm elections', titleZh: '民主党为2026年中期选举制定策略', source: 'CNN', url: 'https://cnn.com', publishedAt: '2026-01-15 10:00', category: 'politics', relatedMarkets: ['politics', 'democrat', 'congress', 'midterm'] },
  { id: 'p6', title: 'Senate balance of power in focus for 2026 midterms', titleZh: '2026年中期选举聚焦参议院权力平衡', source: 'NBC News', url: 'https://nbcnews.com', publishedAt: '2026-01-14 22:00', category: 'politics', relatedMarkets: ['politics', 'congress', 'democrat', 'republican'] },
  { id: 'p7', title: 'Taiwan Strait tensions rise amid diplomatic standoff', titleZh: '台海紧张局势因外交僵局升级', source: 'Financial Times', url: 'https://ft.com', publishedAt: '2026-01-14 20:30', category: 'politics', relatedMarkets: ['politics', 'taiwan', 'china'] },
  { id: 'p8', title: 'China reaffirms Taiwan reunification as national priority', titleZh: '中国重申台湾统一为国家优先事项', source: 'SCMP', url: 'https://scmp.com', publishedAt: '2026-01-14 18:00', category: 'politics', relatedMarkets: ['politics', 'taiwan', 'china', 'reunification'] },
  { id: 'p9', title: 'EU announces stricter tech regulation framework', titleZh: '欧盟宣布更严格的科技监管框架', source: 'Financial Times', url: 'https://ft.com', publishedAt: '2026-01-14 16:00', category: 'politics', relatedMarkets: ['politics', 'tech', 'regulation'] },
  { id: 'p10', title: 'Ukraine-Russia peace talks resume in Geneva', titleZh: '乌俄和谈在日内瓦恢复', source: 'AP News', url: 'https://apnews.com', publishedAt: '2026-01-15 09:00', category: 'politics', relatedMarkets: ['politics', 'russia', 'ukraine', 'conflict'] },
  { id: 'p11', title: 'Russia-Ukraine ceasefire talks show progress', titleZh: '俄乌停火谈判取得进展', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-14 14:00', category: 'politics', relatedMarkets: ['politics', 'russia', 'ukraine', 'conflict'] },
  { id: 'p12', title: 'International mediators push for Ukraine peace deal', titleZh: '国际调解人推动乌克兰和平协议', source: 'BBC', url: 'https://bbc.com', publishedAt: '2026-01-13 10:00', category: 'politics', relatedMarkets: ['politics', 'russia', 'ukraine', 'conflict'] },

  // ==================== 科技新闻 Tech ====================
  { id: 't1', title: 'OpenAI claims major breakthrough in reasoning capabilities', titleZh: 'OpenAI宣称在推理能力上取得重大突破', source: 'TechCrunch', url: 'https://techcrunch.com', publishedAt: '2026-01-15 10:15', category: 'tech', relatedMarkets: ['tech', 'openai', 'gpt', 'ai'] },
  { id: 't2', title: 'GPT-5 development reportedly in final stages', titleZh: 'GPT-5开发据报进入最后阶段', source: 'The Information', url: 'https://theinformation.com', publishedAt: '2026-01-15 09:00', category: 'tech', relatedMarkets: ['tech', 'openai', 'gpt-5', 'gpt'] },
  { id: 't3', title: 'OpenAI valuation soars to $200 billion', titleZh: 'OpenAI估值飙升至2000亿美元', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-14 16:00', category: 'tech', relatedMarkets: ['tech', 'openai', 'gpt', 'ai'] },
  { id: 't4', title: 'Apple Vision Pro 2 leaks suggest major AR improvements', titleZh: 'Apple Vision Pro 2泄露显示AR重大改进', source: 'MacRumors', url: 'https://macrumors.com', publishedAt: '2026-01-14 09:30', category: 'tech', relatedMarkets: ['tech', 'apple', 'ar', 'glasses'] },
  { id: 't5', title: 'Apple AR glasses patents hint at 2026 release', titleZh: 'Apple AR眼镜专利暗示2026年发布', source: 'AppleInsider', url: 'https://appleinsider.com', publishedAt: '2026-01-13 18:00', category: 'tech', relatedMarkets: ['tech', 'apple', 'ar', 'glasses'] },
  { id: 't6', title: 'Anthropic announces Claude 4 with enhanced reasoning', titleZh: 'Anthropic宣布具备增强推理的Claude 4', source: 'Wired', url: 'https://wired.com', publishedAt: '2026-01-11 09:00', category: 'tech', relatedMarkets: ['tech', 'anthropic', 'agi', 'ai'] },
  { id: 't7', title: 'AGI research accelerates across major AI labs', titleZh: 'AGI研究在主要AI实验室加速', source: 'MIT Tech Review', url: 'https://technologyreview.com', publishedAt: '2026-01-12 11:00', category: 'tech', relatedMarkets: ['tech', 'agi', 'ai', 'anthropic', 'openai'] },
  { id: 't8', title: 'Tesla Optimus robot enters advanced testing phase', titleZh: 'Tesla Optimus机器人进入高级测试阶段', source: 'Electrek', url: 'https://electrek.co', publishedAt: '2026-01-12 14:30', category: 'tech', relatedMarkets: ['tech', 'tesla', 'optimus', 'robot'] },
  { id: 't9', title: 'Tesla reveals Optimus production timeline', titleZh: 'Tesla披露Optimus生产时间表', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-11 16:00', category: 'tech', relatedMarkets: ['tech', 'tesla', 'optimus', 'robot'] },
  { id: 't10', title: 'SpaceX Starship completes successful Mars trajectory test', titleZh: 'SpaceX星舰成功完成火星轨道测试', source: 'Space.com', url: 'https://space.com', publishedAt: '2026-01-14 20:00', category: 'tech', relatedMarkets: ['tech', 'spacex', 'starship', 'mars'] },
  { id: 't11', title: 'SpaceX announces accelerated Mars mission timeline', titleZh: 'SpaceX宣布加速火星任务时间表', source: 'Ars Technica', url: 'https://arstechnica.com', publishedAt: '2026-01-13 14:00', category: 'tech', relatedMarkets: ['tech', 'spacex', 'starship', 'mars'] },
  { id: 't12', title: 'China announces Moon mission crewed landing for late 2026', titleZh: '中国宣布2026年底载人登月', source: 'SpaceNews', url: 'https://spacenews.com', publishedAt: '2026-01-12 15:30', category: 'tech', relatedMarkets: ['tech', 'china', 'moon', 'crewed'] },
  { id: 't13', title: 'China Moon mission enters final preparation phase', titleZh: '中国登月任务进入最后准备阶段', source: 'CGTN', url: 'https://cgtn.com', publishedAt: '2026-01-11 10:00', category: 'tech', relatedMarkets: ['tech', 'china', 'moon', 'crewed'] },
  { id: 't14', title: 'NVIDIA unveils next-gen AI chips at CES 2026', titleZh: 'NVIDIA在CES 2026发布下一代AI芯片', source: 'The Verge', url: 'https://theverge.com', publishedAt: '2026-01-13 11:00', category: 'tech', relatedMarkets: ['tech', 'nvidia', 'ai', 'chips'] },

  // ==================== 股票新闻 Stocks ====================
  { id: 's1', title: 'NVIDIA market cap surpasses $4 trillion milestone', titleZh: 'NVIDIA市值突破4万亿美元里程碑', source: 'Yahoo Finance', url: 'https://finance.yahoo.com', publishedAt: '2026-01-14 15:30', category: 'stocks', relatedMarkets: ['stocks', 'nvidia', '$800'] },
  { id: 's2', title: 'NVIDIA stock rallies on AI chip demand surge', titleZh: 'NVIDIA股票因AI芯片需求激增上涨', source: 'CNBC', url: 'https://cnbc.com', publishedAt: '2026-01-14 14:00', category: 'stocks', relatedMarkets: ['stocks', 'nvidia', '$800', 'ai'] },
  { id: 's3', title: 'Analysts raise NVIDIA price target to $850', titleZh: '分析师将NVIDIA目标价上调至850美元', source: 'Barrons', url: 'https://barrons.com', publishedAt: '2026-01-13 16:00', category: 'stocks', relatedMarkets: ['stocks', 'nvidia', '$800'] },
  { id: 's4', title: 'Tesla announces expansion of Gigafactory network', titleZh: 'Tesla宣布扩展超级工厂网络', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-13 10:00', category: 'stocks', relatedMarkets: ['stocks', 'tesla', '$500'] },
  { id: 's5', title: 'Tesla stock surges on robotaxi announcement', titleZh: 'Tesla股票因robotaxi公告上涨', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-12 15:00', category: 'stocks', relatedMarkets: ['stocks', 'tesla', '$500'] },
  { id: 's6', title: 'Tesla FSD reaches 99.9% safety milestone', titleZh: 'Tesla FSD达到99.9%安全里程碑', source: 'Electrek', url: 'https://electrek.co', publishedAt: '2026-01-11 12:00', category: 'stocks', relatedMarkets: ['stocks', 'tesla', '$500'] },
  { id: 's7', title: 'S&P 500 continues record-breaking rally', titleZh: '标普500继续创纪录上涨', source: 'MarketWatch', url: 'https://marketwatch.com', publishedAt: '2026-01-14 16:00', category: 'stocks', relatedMarkets: ['stocks', 's&p', '6500', 'sp500'] },
  { id: 's8', title: 'S&P 500 eyes 6500 target amid strong earnings', titleZh: '标普500在强劲财报下剑指6500点', source: 'WSJ', url: 'https://wsj.com', publishedAt: '2026-01-13 17:00', category: 'stocks', relatedMarkets: ['stocks', 's&p', '6500', 'sp500'] },
  { id: 's9', title: 'Tech stocks lead market rally in 2026', titleZh: '科技股引领2026年市场上涨', source: 'CNBC', url: 'https://cnbc.com', publishedAt: '2026-01-12 16:00', category: 'stocks', relatedMarkets: ['stocks', 'tech', 's&p'] },
  { id: 's10', title: 'Magnificent 7 stocks post strong Q4 results', titleZh: '七巨头Q4业绩强劲', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-10 14:00', category: 'stocks', relatedMarkets: ['stocks', 'nvidia', 'tesla', 'apple'] },

  // ==================== 金融新闻 Finance ====================
  { id: 'f1', title: 'Fed officials signal potential rate cuts ahead', titleZh: '美联储官员暗示可能进一步降息', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-14 16:45', category: 'finance', relatedMarkets: ['finance', 'fed', 'rate', 'cut'] },
  { id: 'f2', title: 'Fed minutes show dovish tilt on interest rates', titleZh: '美联储会议纪要显示利率鸽派倾向', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-14 14:00', category: 'finance', relatedMarkets: ['finance', 'fed', 'rate', 'cut', '3%'] },
  { id: 'f3', title: 'Markets price in Fed rate cuts to 2.75% by year end', titleZh: '市场预期美联储年底降息至2.75%', source: 'WSJ', url: 'https://wsj.com', publishedAt: '2026-01-13 15:00', category: 'finance', relatedMarkets: ['finance', 'fed', 'rate', 'cut', '3%'] },
  { id: 'f4', title: 'US inflation drops to 2.1% in December', titleZh: '美国12月通胀降至2.1%', source: 'CNBC', url: 'https://cnbc.com', publishedAt: '2026-01-12 08:30', category: 'finance', relatedMarkets: ['finance', 'inflation', '2%'] },
  { id: 'f5', title: 'Core PCE inflation continues downward trend', titleZh: '核心PCE通胀继续下行趋势', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-11 10:00', category: 'finance', relatedMarkets: ['finance', 'inflation', '2%'] },
  { id: 'f6', title: 'US GDP growth beats expectations at 3.2%', titleZh: '美国GDP增长超预期达3.2%', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-10 08:30', category: 'finance', relatedMarkets: ['finance', 'gdp', '3%', 'growth'] },
  { id: 'f7', title: 'Strong jobs report boosts GDP outlook', titleZh: '强劲就业报告提振GDP预期', source: 'CNBC', url: 'https://cnbc.com', publishedAt: '2026-01-09 09:00', category: 'finance', relatedMarkets: ['finance', 'gdp', '3%', 'growth'] },
  { id: 'f8', title: 'Consumer spending drives Q4 economic growth', titleZh: '消费者支出推动Q4经济增长', source: 'WSJ', url: 'https://wsj.com', publishedAt: '2026-01-08 14:00', category: 'finance', relatedMarkets: ['finance', 'gdp', 'growth'] },
  { id: 'f9', title: 'Treasury yields fall on rate cut expectations', titleZh: '国债收益率因降息预期下跌', source: 'Bloomberg', url: 'https://bloomberg.com', publishedAt: '2026-01-07 16:00', category: 'finance', relatedMarkets: ['finance', 'fed', 'rate'] },
  { id: 'f10', title: 'Dollar weakens as Fed signals policy pivot', titleZh: '美元因美联储政策转向信号走弱', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-06 12:00', category: 'finance', relatedMarkets: ['finance', 'fed', 'rate'] },

  // ==================== 体育新闻 Sports ====================
  { id: 'sp1', title: 'Chiefs favored to win Super Bowl 2027', titleZh: '酋长队被看好赢得2027超级碗', source: 'ESPN', url: 'https://espn.com', publishedAt: '2026-01-14 08:20', category: 'sports', relatedMarkets: ['sports', 'super bowl', 'chiefs', 'kansas city'] },
  { id: 'sp2', title: 'Super Bowl 2027 predictions: Chiefs vs Eagles rematch?', titleZh: '2027超级碗预测：酋长队vs老鹰队再战？', source: 'CBS Sports', url: 'https://cbssports.com', publishedAt: '2026-01-13 16:00', category: 'sports', relatedMarkets: ['sports', 'super bowl', 'chiefs', '2027'] },
  { id: 'sp3', title: 'NFL playoff picture takes shape for Super Bowl run', titleZh: 'NFL季后赛格局为超级碗成型', source: 'NFL.com', url: 'https://nfl.com', publishedAt: '2026-01-12 20:00', category: 'sports', relatedMarkets: ['sports', 'super bowl', 'nfl'] },
  { id: 'sp4', title: 'Patrick Mahomes eyes record 4th Super Bowl ring', titleZh: 'Patrick Mahomes瞄准创纪录第4枚超级碗戒指', source: 'ESPN', url: 'https://espn.com', publishedAt: '2026-01-11 14:00', category: 'sports', relatedMarkets: ['sports', 'super bowl', 'chiefs', 'kansas city'] },
  { id: 'sp5', title: 'FIFA World Cup 2026 preparations in final stage', titleZh: 'FIFA 2026世界杯准备进入最后阶段', source: 'BBC Sport', url: 'https://bbc.com/sport', publishedAt: '2026-01-11 12:00', category: 'sports', relatedMarkets: ['sports', 'world cup', 'fifa', '2026'] },
  { id: 'sp6', title: 'Messi confirms participation in World Cup 2026', titleZh: '梅西确认参加2026世界杯', source: 'Goal', url: 'https://goal.com', publishedAt: '2026-01-09 18:00', category: 'sports', relatedMarkets: ['sports', 'world cup', 'messi', 'argentina'] },
  { id: 'sp7', title: 'Argentina squad for World Cup 2026 takes shape', titleZh: '阿根廷2026世界杯阵容成型', source: 'ESPN', url: 'https://espn.com', publishedAt: '2026-01-08 10:00', category: 'sports', relatedMarkets: ['sports', 'world cup', 'messi', 'argentina'] },
  { id: 'sp8', title: 'World Cup 2026 stadiums pass final inspections', titleZh: '2026世界杯体育场通过最终检验', source: 'AP Sports', url: 'https://apnews.com', publishedAt: '2026-01-07 15:00', category: 'sports', relatedMarkets: ['sports', 'world cup', 'fifa'] },
  { id: 'sp9', title: 'Betting odds favor France in World Cup 2026', titleZh: '博彩赔率看好法国2026世界杯', source: 'The Athletic', url: 'https://theathletic.com', publishedAt: '2026-01-06 11:00', category: 'sports', relatedMarkets: ['sports', 'world cup', 'fifa'] },
  { id: 'sp10', title: 'World Cup 2026 ticket sales break records', titleZh: '2026世界杯门票销售打破纪录', source: 'FIFA.com', url: 'https://fifa.com', publishedAt: '2026-01-05 09:00', category: 'sports', relatedMarkets: ['sports', 'world cup', 'fifa'] },

  // ==================== 其他新闻 Other ====================
  { id: 'o1', title: 'WHO releases global health preparedness report', titleZh: '世卫组织发布全球健康准备报告', source: 'WHO', url: 'https://who.int', publishedAt: '2026-01-10 10:00', category: 'other', relatedMarkets: ['other', 'who', 'pandemic', 'health'] },
  { id: 'o2', title: 'WHO warns of emerging viral threats in 2026', titleZh: '世卫组织警告2026年新兴病毒威胁', source: 'Reuters', url: 'https://reuters.com', publishedAt: '2026-01-09 14:00', category: 'other', relatedMarkets: ['other', 'who', 'pandemic', 'health'] },
  { id: 'o3', title: 'Avatar 3 release date confirmed for December 2026', titleZh: '阿凡达3确认2026年12月上映', source: 'Variety', url: 'https://variety.com', publishedAt: '2026-01-08 14:00', category: 'other', relatedMarkets: ['other', 'avatar', 'movie', 'billion'] },
  { id: 'o4', title: 'Avatar 3 pre-sales break advance ticket records', titleZh: '阿凡达3预售打破预售票记录', source: 'Deadline', url: 'https://deadline.com', publishedAt: '2026-01-07 10:00', category: 'other', relatedMarkets: ['other', 'avatar', 'movie', 'billion'] },
  { id: 'o5', title: 'Taylor Swift Eras Tour grosses $3 billion worldwide', titleZh: 'Taylor Swift时代巡演全球票房30亿美元', source: 'Billboard', url: 'https://billboard.com', publishedAt: '2026-01-06 16:00', category: 'other', relatedMarkets: ['other', 'taylor swift', 'streaming', 'record'] },
  { id: 'o6', title: 'Taylor Swift breaks Spotify streaming records again', titleZh: 'Taylor Swift再次打破Spotify流媒体记录', source: 'Variety', url: 'https://variety.com', publishedAt: '2026-01-05 12:00', category: 'other', relatedMarkets: ['other', 'taylor swift', 'streaming', 'record'] },
]

const mockBetHistory: BetHistory[] = [
  { id: '1', market: 'BTC $150K', outcome: 'YES', amount: 2500, odds: 1.54, status: 'active', pnl: 450, time: '2026-01-15' },
  { id: '2', market: 'ETH $10K', outcome: 'YES', amount: 1000, odds: 2.38, status: 'active', pnl: -120, time: '2026-01-14' },
  { id: '3', market: 'Fed Rate Cut', outcome: 'YES', amount: 3000, odds: 1.82, status: 'won', pnl: 2460, time: '2026-01-10' },
  { id: '4', market: 'Trump 2028', outcome: 'NO', amount: 500, odds: 1.61, status: 'active', pnl: 80, time: '2026-01-12' },
  { id: '5', market: 'AAPL $250', outcome: 'YES', amount: 1500, odds: 1.95, status: 'lost', pnl: -1500, time: '2025-12-28' },
]

export function PredictionMarket() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [betAmount, setBetAmount] = useState('')
  const [selectedOutcome, setSelectedOutcome] = useState<'YES' | 'NO' | ''>('')
  const [userBalance, setUserBalance] = useState(125000)
  const [priceHistory, setPriceHistory] = useState(generatePriceHistory())
  const [betHistory] = useState<BetHistory[]>(mockBetHistory)
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [news] = useState<NewsItem[]>(mockNews)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  
  // ===== 新功能状态 / New Feature States =====
  // 1. 悬停新闻预览
  const [hoveredMarket, setHoveredMarket] = useState<Market | null>(null)
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })
  
  // 2. 排行榜排序
  const [sortBy, setSortBy] = useState<'volume' | 'participants' | 'change'>('volume')
  const [showRankings, setShowRankings] = useState(false)
  
  // 3. 增强图表视图
  const [chartView, setChartView] = useState<'simple' | 'compare'>('simple')
  const [enhancedHistory, setEnhancedHistory] = useState(generateEnhancedHistory())
  
  // 4. 价格提醒系统
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([])
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertTargetPrice, setAlertTargetPrice] = useState('')
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above')
  const [notifications, setNotifications] = useState<string[]>([])

  // 计算各平台市场数量统计 - Calculate platform stats
  const platformStats = {
    // 预测市场平台
    polymarket: markets.filter(m => m.externalPlatform === 'polymarket').length,
    manifold: markets.filter(m => m.externalPlatform === 'manifold').length,
    metaculus: markets.filter(m => m.externalPlatform === 'metaculus').length,
    kalshi: markets.filter(m => m.externalPlatform === 'kalshi').length,
    predictit: markets.filter(m => m.externalPlatform === 'predictit').length,
    insight: markets.filter(m => m.externalPlatform === 'insight').length,
    // 社交媒体平台
    twitter: markets.filter(m => m.externalPlatform === 'twitter').length,
    reddit: markets.filter(m => m.externalPlatform === 'reddit').length,
    youtube: markets.filter(m => m.externalPlatform === 'youtube').length,
    tiktok: markets.filter(m => m.externalPlatform === 'tiktok').length,
    discord: markets.filter(m => m.externalPlatform === 'discord').length,
    telegram: markets.filter(m => m.externalPlatform === 'telegram').length,
    // 本地
    local: markets.filter(m => m.externalPlatform === 'local').length,
    // 汇总
    external: markets.filter(m => m.externalPlatform && m.externalPlatform !== 'local').length,
    social: markets.filter(m => ['twitter', 'reddit', 'youtube', 'tiktok', 'discord', 'telegram'].includes(m.externalPlatform || '')).length,
  }

  // 获取所有预测市场平台数据 - Fetch all prediction market platform data
  const fetchAllPlatformsData = async () => {
    setLoading(true)
    const allMarkets: Market[] = []
    
    // ===== 1. Polymarket (区块链预测市场) =====
    try {
      const polyResponse = await axios.get('https://clob.polymarket.com/markets', {
        params: { limit: 15, active: true, closed: false },
        timeout: 5000,
      })
      
      if (polyResponse.data && Array.isArray(polyResponse.data)) {
        polyResponse.data.forEach((item: any, index: number) => {
          let yesPrice = 0.5, noPrice = 0.5
          try {
            if (item.outcomePrices) {
              const prices = JSON.parse(item.outcomePrices)
              yesPrice = parseFloat(prices[0]) || 0.5
              noPrice = parseFloat(prices[1]) || 0.5
            }
          } catch { /* use defaults */ }

          allMarkets.push({
            ID: `poly_${item.condition_id || index}`,
            Name: item.question || 'Unknown Market',
            NameZh: translateToZh(item.question || ''),
            Description: item.description || item.question || '',
            DescriptionZh: translateToZh(item.description || ''),
            Outcomes: ['YES', 'NO'],
            State: 'open',
            CreatedAt: new Date().toISOString().split('T')[0],
            Volume: parseFloat(item.volume || '0') || Math.random() * 5000000,
            Participants: Math.floor(Math.random() * 3000) + 500,
            EndDate: item.end_date_iso?.split('T')[0] || '2026-12-31',
            Category: categorizeMarket(item.question || ''),
            YesPrice: yesPrice,
            NoPrice: noPrice,
            isRealData: true,
            dataSource: '🟣 Polymarket',
            externalPlatform: 'polymarket',
            externalUrl: `https://polymarket.com/event/${item.condition_id}`,
          })
        })
      }
      console.log(`✅ Polymarket: ${allMarkets.filter(m => m.externalPlatform === 'polymarket').length} markets`)
    } catch {
      console.log('⚠️ Polymarket CLOB API unavailable')
    }

    // ===== 2. Polymarket Gamma API (备用) =====
    if (allMarkets.filter(m => m.externalPlatform === 'polymarket').length === 0) {
      try {
        const gammaResponse = await axios.get('https://gamma-api.polymarket.com/events', {
          params: { limit: 15, active: true },
          timeout: 5000,
        })
        
        if (gammaResponse.data && Array.isArray(gammaResponse.data)) {
          gammaResponse.data.forEach((event: PolymarketEvent, eventIndex: number) => {
            if (event.markets) {
              event.markets.forEach((market, marketIndex) => {
                let yesPrice = 0.5, noPrice = 0.5
                try {
                  if (market.outcomePrices) {
                    const prices = JSON.parse(market.outcomePrices)
                    yesPrice = parseFloat(prices[0]) || 0.5
                    noPrice = parseFloat(prices[1]) || 0.5
                  }
                } catch { /* use defaults */ }

                allMarkets.push({
                  ID: `gamma_${market.id || `${eventIndex}_${marketIndex}`}`,
                  Name: market.question || event.title,
                  NameZh: translateToZh(market.question || event.title),
                  Description: market.question || event.title,
                  DescriptionZh: translateToZh(market.question || event.title),
                  Outcomes: ['YES', 'NO'],
                  State: 'open',
                  CreatedAt: new Date().toISOString().split('T')[0],
                  Volume: parseFloat(market.volume) || event.volume || Math.random() * 5000000,
                  Participants: Math.floor(Math.random() * 3000) + 500,
                  EndDate: event.endDate?.split('T')[0] || '2026-12-31',
                  Category: categorizeMarket(market.question || event.title),
                  YesPrice: yesPrice,
                  NoPrice: noPrice,
                  isRealData: true,
                  dataSource: '🟣 Polymarket (Gamma)',
                  externalPlatform: 'polymarket',
                  externalUrl: `https://polymarket.com/event/${market.id}`,
                })
              })
            }
          })
        }
        console.log(`✅ Polymarket Gamma: ${allMarkets.filter(m => m.externalPlatform === 'polymarket').length} markets`)
      } catch {
        console.log('⚠️ Polymarket Gamma API unavailable')
      }
    }

    // ===== 3. Manifold Markets (开源预测市场) =====
    try {
      const manifoldResponse = await axios.get('https://api.manifold.markets/v0/markets', {
        params: { limit: 15, sort: 'liquidity' },
        timeout: 5000,
      })
      
      if (manifoldResponse.data && Array.isArray(manifoldResponse.data)) {
        manifoldResponse.data.forEach((item: any) => {
          if (item.outcomeType === 'BINARY') {
            allMarkets.push({
              ID: `manifold_${item.id}`,
              Name: item.question || 'Unknown',
              NameZh: translateToZh(item.question || ''),
              Description: item.description || item.question || '',
              DescriptionZh: translateToZh(item.description || ''),
              Outcomes: ['YES', 'NO'],
              State: item.isResolved ? 'resolved' : 'open',
              CreatedAt: new Date(item.createdTime).toISOString().split('T')[0],
              Volume: item.volume || item.totalLiquidity || 0,
              Participants: item.uniqueBettorCount || Math.floor(Math.random() * 500) + 50,
              EndDate: item.closeTime ? new Date(item.closeTime).toISOString().split('T')[0] : '2026-12-31',
              Category: categorizeMarket(item.question || ''),
              YesPrice: item.probability || 0.5,
              NoPrice: 1 - (item.probability || 0.5),
              isRealData: true,
              dataSource: '🩷 Manifold',
              externalPlatform: 'manifold',
              externalUrl: item.url || `https://manifold.markets/${item.creatorUsername}/${item.slug}`,
            })
          }
        })
      }
      console.log(`✅ Manifold: ${allMarkets.filter(m => m.externalPlatform === 'manifold').length} markets`)
    } catch {
      console.log('⚠️ Manifold API unavailable')
    }

    // ===== 4. Metaculus (科学预测) =====
    try {
      const metaculusResponse = await axios.get('https://www.metaculus.com/api2/questions/', {
        params: { limit: 12, status: 'open', order_by: '-activity' },
        timeout: 5000,
      })
      
      if (metaculusResponse.data?.results && Array.isArray(metaculusResponse.data.results)) {
        metaculusResponse.data.results.forEach((item: any) => {
          const prediction = item.community_prediction?.full?.q2 || item.my_prediction?.full?.q2 || 0.5
          allMarkets.push({
            ID: `metaculus_${item.id}`,
            Name: item.title || 'Unknown',
            NameZh: translateToZh(item.title || ''),
            Description: item.description_html?.replace(/<[^>]*>/g, '').substring(0, 200) || item.title || '',
            DescriptionZh: translateToZh(item.description_html?.replace(/<[^>]*>/g, '').substring(0, 200) || ''),
            Outcomes: ['YES', 'NO'],
            State: item.active_state === 'OPEN' ? 'open' : 'closed',
            CreatedAt: item.created_time?.split('T')[0] || new Date().toISOString().split('T')[0],
            Volume: item.votes_count * 1000 || Math.random() * 100000,
            Participants: item.predictions_count || item.forecasts_count || Math.floor(Math.random() * 200) + 20,
            EndDate: item.resolve_time?.split('T')[0] || item.close_time?.split('T')[0] || '2026-12-31',
            Category: categorizeMarket(item.title || ''),
            YesPrice: prediction,
            NoPrice: 1 - prediction,
            isRealData: true,
            dataSource: '🔵 Metaculus',
            externalPlatform: 'metaculus',
            externalUrl: `https://www.metaculus.com/questions/${item.id}`,
          })
        })
      }
      console.log(`✅ Metaculus: ${allMarkets.filter(m => m.externalPlatform === 'metaculus').length} markets`)
    } catch {
      console.log('⚠️ Metaculus API unavailable')
    }

    // ===== 5. Kalshi (美国合规事件合约) =====
    try {
      const kalshiResponse = await axios.get('https://trading-api.kalshi.com/trade-api/v2/markets', {
        params: { limit: 12, status: 'open' },
        timeout: 5000,
        headers: { 'Accept': 'application/json' }
      })
      
      if (kalshiResponse.data?.markets && Array.isArray(kalshiResponse.data.markets)) {
        kalshiResponse.data.markets.forEach((item: any) => {
          allMarkets.push({
            ID: `kalshi_${item.ticker}`,
            Name: item.title || item.subtitle || 'Unknown',
            NameZh: translateToZh(item.title || item.subtitle || ''),
            Description: item.rules || item.title || '',
            DescriptionZh: translateToZh(item.rules || item.title || ''),
            Outcomes: ['YES', 'NO'],
            State: item.status === 'active' ? 'open' : 'closed',
            CreatedAt: new Date().toISOString().split('T')[0],
            Volume: item.volume || item.open_interest * 100 || Math.random() * 500000,
            Participants: Math.floor(Math.random() * 1000) + 100,
            EndDate: item.expiration_time?.split('T')[0] || item.close_time?.split('T')[0] || '2026-12-31',
            Category: categorizeMarket(item.title || item.category || ''),
            YesPrice: (item.yes_bid + item.yes_ask) / 200 || 0.5,
            NoPrice: 1 - ((item.yes_bid + item.yes_ask) / 200 || 0.5),
            isRealData: true,
            dataSource: '🟠 Kalshi',
            externalPlatform: 'kalshi',
            externalUrl: `https://kalshi.com/markets/${item.ticker}`,
          })
        })
      }
      console.log(`✅ Kalshi: ${allMarkets.filter(m => m.externalPlatform === 'kalshi').length} markets`)
    } catch {
      console.log('⚠️ Kalshi API unavailable')
    }

    // ===== 6. PredictIt (政治预测市场 - 需要代理) =====
    try {
      const predictItResponse = await axios.get('https://www.predictit.org/api/marketdata/all/', {
        timeout: 5000,
      })
      
      if (predictItResponse.data?.markets && Array.isArray(predictItResponse.data.markets)) {
        predictItResponse.data.markets.slice(0, 10).forEach((market: any) => {
          if (market.contracts && market.contracts.length > 0) {
            const contract = market.contracts[0]
            allMarkets.push({
              ID: `predictit_${market.id}`,
              Name: market.shortName || market.name || 'Unknown',
              NameZh: translateToZh(market.shortName || market.name || ''),
              Description: market.name || '',
              DescriptionZh: translateToZh(market.name || ''),
              Outcomes: ['YES', 'NO'],
              State: market.status === 'Open' ? 'open' : 'closed',
              CreatedAt: new Date().toISOString().split('T')[0],
              Volume: Math.random() * 1000000,
              Participants: Math.floor(Math.random() * 2000) + 200,
              EndDate: market.dateEnd?.split('T')[0] || '2026-12-31',
              Category: 'politics',
              YesPrice: contract.lastTradePrice || contract.bestBuyYesCost || 0.5,
              NoPrice: 1 - (contract.lastTradePrice || contract.bestBuyYesCost || 0.5),
              isRealData: true,
              dataSource: '🔷 PredictIt',
              externalPlatform: 'predictit',
              externalUrl: market.url || `https://www.predictit.org/markets/detail/${market.id}`,
            })
          }
        })
      }
      console.log(`✅ PredictIt: ${allMarkets.filter(m => m.externalPlatform === 'predictit').length} markets`)
    } catch {
      console.log('⚠️ PredictIt API unavailable')
    }

    // ===== 7. Insight Prediction (洞察预测) =====
    try {
      const insightResponse = await axios.get('https://insightprediction.com/api/markets', {
        params: { limit: 10, status: 'open' },
        timeout: 5000,
      })
      
      if (insightResponse.data && Array.isArray(insightResponse.data)) {
        insightResponse.data.forEach((item: any) => {
          allMarkets.push({
            ID: `insight_${item.id}`,
            Name: item.title || 'Unknown',
            NameZh: translateToZh(item.title || ''),
            Description: item.description || item.title || '',
            DescriptionZh: translateToZh(item.description || ''),
            Outcomes: ['YES', 'NO'],
            State: item.status === 'active' ? 'open' : 'closed',
            CreatedAt: new Date().toISOString().split('T')[0],
            Volume: item.volume || Math.random() * 200000,
            Participants: item.traders || Math.floor(Math.random() * 300) + 30,
            EndDate: item.close_date?.split('T')[0] || '2026-12-31',
            Category: categorizeMarket(item.title || ''),
            YesPrice: item.probability || 0.5,
            NoPrice: 1 - (item.probability || 0.5),
            isRealData: true,
            dataSource: '🩵 Insight',
            externalPlatform: 'insight',
            externalUrl: `https://insightprediction.com/m/${item.slug || item.id}`,
          })
        })
      }
      console.log(`✅ Insight: ${allMarkets.filter(m => m.externalPlatform === 'insight').length} markets`)
    } catch {
      console.log('⚠️ Insight API unavailable')
    }

    // ===== 8. 社交媒体热门趋势自动生成预测市场 =====
    // Social Media Trending Topics Auto-Generated Markets
    console.log('🔥 Generating markets from social media trends...')
    const socialMediaMarkets = generateSocialMediaTrendingMarkets()
    allMarkets.push(...socialMediaMarkets)
    console.log(`✅ Social Media: ${socialMediaMarkets.length} trending markets generated`)

    // ===== 检查是否有足够的市场数据 =====
    if (allMarkets.length < 5) {
      console.log('🔥 Not enough external data, adding auto-generated markets')
      const fallback = generateFallbackMarkets()
      allMarkets.push(...fallback)
    }

    // 按交易量排序
    allMarkets.sort((a, b) => (b.Volume || 0) - (a.Volume || 0))
    
    setMarkets(allMarkets)
    if (allMarkets.length > 0) {
      setSelectedMarket(allMarkets[0])
      setPriceHistory(generatePriceHistory(allMarkets[0].YesPrice || 0.5))
    }
    setLastUpdate(new Date())
    setLoading(false)
    
    // 统计各平台市场数量
    const stats = {
      polymarket: allMarkets.filter(m => m.externalPlatform === 'polymarket').length,
      manifold: allMarkets.filter(m => m.externalPlatform === 'manifold').length,
      metaculus: allMarkets.filter(m => m.externalPlatform === 'metaculus').length,
      kalshi: allMarkets.filter(m => m.externalPlatform === 'kalshi').length,
      predictit: allMarkets.filter(m => m.externalPlatform === 'predictit').length,
      insight: allMarkets.filter(m => m.externalPlatform === 'insight').length,
      twitter: allMarkets.filter(m => m.externalPlatform === 'twitter').length,
      reddit: allMarkets.filter(m => m.externalPlatform === 'reddit').length,
      youtube: allMarkets.filter(m => m.externalPlatform === 'youtube').length,
      tiktok: allMarkets.filter(m => m.externalPlatform === 'tiktok').length,
      discord: allMarkets.filter(m => m.externalPlatform === 'discord').length,
      telegram: allMarkets.filter(m => m.externalPlatform === 'telegram').length,
      local: allMarkets.filter(m => m.externalPlatform === 'local').length,
    }
    console.log('📊 Platform stats:', stats, `Total: ${allMarkets.length}`)
  }

  // ==================== 社交媒体热门趋势生成预测市场 ====================
  // Generate Prediction Markets from Social Media Trending Topics
  const generateSocialMediaTrendingMarkets = (): Market[] => {
    // 模拟来自各社交平台的热门话题并生成预测市场
    // Simulate trending topics from various social platforms and generate prediction markets
    return [
      // 𝕏 Twitter/X 热门话题 - Trending Topics
      { 
        ID: 'x_1', 
        Name: '#AIWinter2026 - Will AI investment decline by 30% in 2026?', 
        NameZh: '#AI寒冬2026 - AI投资会在2026年下降30%吗？', 
        Description: 'Trending on X: Discussion about potential AI bubble burst and investment slowdown.',
        DescriptionZh: 'X上热门话题：关于AI泡沫破裂和投资放缓的讨论。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 8750000, Participants: 45230, EndDate: '2026-12-31', 
        Category: 'tech', YesPrice: 0.22, NoPrice: 0.78, 
        isRealData: false, dataSource: '𝕏 Twitter Trending',
        externalPlatform: 'twitter', externalUrl: 'https://x.com/search?q=%23AIWinter2026',
        trendingScore: 98, engagementCount: 2340000
      },
      { 
        ID: 'x_2', 
        Name: '#ElonMars - Will Elon Musk announce personal Mars trip in 2026?', 
        NameZh: '#马斯克火星 - Elon Musk会在2026年宣布个人火星之旅吗？', 
        Description: 'Viral thread on X about Musk\'s potential personal Mars mission announcement.',
        DescriptionZh: 'X上病毒式传播：马斯克可能宣布个人火星任务。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 12450000, Participants: 67890, EndDate: '2026-12-31', 
        Category: 'tech', YesPrice: 0.15, NoPrice: 0.85, 
        isRealData: false, dataSource: '𝕏 Twitter Trending',
        externalPlatform: 'twitter', externalUrl: 'https://x.com/search?q=%23ElonMars',
        trendingScore: 95, engagementCount: 1890000
      },
      { 
        ID: 'x_3', 
        Name: '#CryptoSupercycle - Will BTC hit $200K before crash?', 
        NameZh: '#加密超级周期 - BTC会在崩盘前达到20万美元吗？', 
        Description: 'Heated debate on X about crypto supercycle theory and potential crash.',
        DescriptionZh: 'X上激烈辩论：加密超级周期理论和潜在崩盘。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', 
        Volume: 15670000, Participants: 89123, EndDate: '2026-12-31', 
        Category: 'crypto', YesPrice: 0.35, NoPrice: 0.65, 
        isRealData: false, dataSource: '𝕏 Twitter Trending',
        externalPlatform: 'twitter', externalUrl: 'https://x.com/search?q=%23CryptoSupercycle',
        trendingScore: 92, engagementCount: 3450000
      },

      // 📺 Reddit 热门话题 - Hot Topics
      { 
        ID: 'reddit_1', 
        Name: 'r/wallstreetbets - Will GME reach $1000 in 2026?', 
        NameZh: 'r/wallstreetbets - GME会在2026年达到1000美元吗？', 
        Description: 'Top post on WSB discussing GameStop potential with massive engagement.',
        DescriptionZh: 'WSB热帖讨论GameStop潜力，互动量巨大。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 9870000, Participants: 156789, EndDate: '2026-12-31', 
        Category: 'stocks', YesPrice: 0.08, NoPrice: 0.92, 
        isRealData: false, dataSource: '🔴 Reddit Hot',
        externalPlatform: 'reddit', externalUrl: 'https://reddit.com/r/wallstreetbets',
        trendingScore: 96, engagementCount: 89000
      },
      { 
        ID: 'reddit_2', 
        Name: 'r/technology - Will quantum computing break Bitcoin by 2030?', 
        NameZh: 'r/technology - 量子计算会在2030年前破解比特币吗？', 
        Description: 'Viral discussion on r/technology about quantum threat to cryptocurrency.',
        DescriptionZh: 'r/technology病毒式讨论：量子威胁加密货币。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', 
        Volume: 6540000, Participants: 78456, EndDate: '2030-12-31', 
        Category: 'tech', YesPrice: 0.18, NoPrice: 0.82, 
        isRealData: false, dataSource: '🔴 Reddit Hot',
        externalPlatform: 'reddit', externalUrl: 'https://reddit.com/r/technology',
        trendingScore: 88, engagementCount: 45000
      },
      { 
        ID: 'reddit_3', 
        Name: 'r/CryptoCurrency - Will Ethereum flip Bitcoin in 2026?', 
        NameZh: 'r/CryptoCurrency - 以太坊会在2026年市值超越比特币吗？', 
        Description: 'Hot debate on crypto subreddit about the flippening possibility.',
        DescriptionZh: '加密货币子版热门辩论：Flippening的可能性。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-14', 
        Volume: 11230000, Participants: 98765, EndDate: '2026-12-31', 
        Category: 'crypto', YesPrice: 0.12, NoPrice: 0.88, 
        isRealData: false, dataSource: '🔴 Reddit Hot',
        externalPlatform: 'reddit', externalUrl: 'https://reddit.com/r/CryptoCurrency',
        trendingScore: 91, engagementCount: 67000
      },

      // 📹 YouTube 热门话题 - Trending Videos
      { 
        ID: 'youtube_1', 
        Name: 'YouTube Trending: Will MrBeast reach 500M subscribers in 2026?', 
        NameZh: 'YouTube热门: MrBeast会在2026年达到5亿订阅吗？', 
        Description: 'MrBeast latest video sparks discussion about reaching 500M milestone.',
        DescriptionZh: 'MrBeast最新视频引发关于达到5亿里程碑的讨论。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 4560000, Participants: 234567, EndDate: '2026-12-31', 
        Category: 'other', YesPrice: 0.72, NoPrice: 0.28, 
        isRealData: false, dataSource: '▶️ YouTube Trending',
        externalPlatform: 'youtube', externalUrl: 'https://youtube.com/c/MrBeast',
        trendingScore: 99, engagementCount: 45000000
      },
      { 
        ID: 'youtube_2', 
        Name: 'YouTube Tech: Will iPhone 18 have no notch or dynamic island?', 
        NameZh: 'YouTube科技: iPhone 18会取消刘海和灵动岛吗？', 
        Description: 'Leaked Apple concepts going viral on tech YouTube channels.',
        DescriptionZh: '泄露的苹果概念在科技YouTube频道上疯传。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', 
        Volume: 7890000, Participants: 123456, EndDate: '2026-09-30', 
        Category: 'tech', YesPrice: 0.45, NoPrice: 0.55, 
        isRealData: false, dataSource: '▶️ YouTube Trending',
        externalPlatform: 'youtube', externalUrl: 'https://youtube.com/results?search_query=iPhone+18+leak',
        trendingScore: 87, engagementCount: 8900000
      },

      // 🎵 TikTok 热门话题 - Viral Trends
      { 
        ID: 'tiktok_1', 
        Name: 'TikTok Viral: Will #SilentWalking become bigger than gym?', 
        NameZh: 'TikTok病毒: #静默行走会比健身房更流行吗？', 
        Description: '#SilentWalking trend exploding on TikTok as new wellness movement.',
        DescriptionZh: '#静默行走趋势在TikTok上爆发成为新的健康运动。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 3450000, Participants: 567890, EndDate: '2026-06-30', 
        Category: 'other', YesPrice: 0.38, NoPrice: 0.62, 
        isRealData: false, dataSource: '🎵 TikTok Viral',
        externalPlatform: 'tiktok', externalUrl: 'https://tiktok.com/tag/silentwalking',
        trendingScore: 94, engagementCount: 234000000
      },
      { 
        ID: 'tiktok_2', 
        Name: 'TikTok Finance: Will "loud budgeting" replace "quiet luxury"?', 
        NameZh: 'TikTok金融: "大声预算"会取代"静奢"吗？', 
        Description: 'Gen Z finance trend "loud budgeting" challenging quiet luxury movement.',
        DescriptionZh: 'Z世代金融趋势"大声预算"挑战静奢运动。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', 
        Volume: 2340000, Participants: 345678, EndDate: '2026-12-31', 
        Category: 'finance', YesPrice: 0.55, NoPrice: 0.45, 
        isRealData: false, dataSource: '🎵 TikTok Viral',
        externalPlatform: 'tiktok', externalUrl: 'https://tiktok.com/tag/loudbudgeting',
        trendingScore: 89, engagementCount: 178000000
      },

      // 💬 Discord 热门话题 - Server Trends
      { 
        ID: 'discord_1', 
        Name: 'Discord Gaming: Will GTA 6 break 100M sales in first month?', 
        NameZh: 'Discord游戏: GTA 6首月销量会突破1亿吗？', 
        Description: 'Gaming Discord servers buzzing about GTA 6 release predictions.',
        DescriptionZh: '游戏Discord服务器热议GTA 6发布预测。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 8760000, Participants: 456789, EndDate: '2026-12-31', 
        Category: 'other', YesPrice: 0.68, NoPrice: 0.32, 
        isRealData: false, dataSource: '💬 Discord Trending',
        externalPlatform: 'discord', externalUrl: 'https://discord.gg/gaming',
        trendingScore: 97, engagementCount: 5600000
      },
      { 
        ID: 'discord_2', 
        Name: 'Discord Crypto: Will Solana DeFi TVL exceed Ethereum in 2026?', 
        NameZh: 'Discord加密: Solana DeFi TVL会在2026年超越以太坊吗？', 
        Description: 'Crypto Discord communities debating Solana vs Ethereum DeFi dominance.',
        DescriptionZh: '加密Discord社区辩论Solana vs 以太坊DeFi主导地位。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', 
        Volume: 5670000, Participants: 234567, EndDate: '2026-12-31', 
        Category: 'crypto', YesPrice: 0.25, NoPrice: 0.75, 
        isRealData: false, dataSource: '💬 Discord Trending',
        externalPlatform: 'discord', externalUrl: 'https://discord.gg/defi',
        trendingScore: 86, engagementCount: 890000
      },

      // ✈️ Telegram 热门话题 - Channel Trends  
      { 
        ID: 'telegram_1', 
        Name: 'Telegram Crypto: Will TON reach top 5 by market cap in 2026?', 
        NameZh: 'Telegram加密: TON会在2026年市值进入前5吗？', 
        Description: 'Telegram crypto channels hyping TON ecosystem growth potential.',
        DescriptionZh: 'Telegram加密频道炒作TON生态系统增长潜力。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 6780000, Participants: 345678, EndDate: '2026-12-31', 
        Category: 'crypto', YesPrice: 0.32, NoPrice: 0.68, 
        isRealData: false, dataSource: '✈️ Telegram Hot',
        externalPlatform: 'telegram', externalUrl: 'https://t.me/toncoin',
        trendingScore: 93, engagementCount: 4500000
      },
      { 
        ID: 'telegram_2', 
        Name: 'Telegram News: Will Russia-Ukraine ceasefire happen in Q1 2026?', 
        NameZh: 'Telegram新闻: 俄乌会在2026年Q1停火吗？', 
        Description: 'Breaking news channels discussing potential ceasefire negotiations.',
        DescriptionZh: '突发新闻频道讨论可能的停火谈判。',
        Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-16', 
        Volume: 9870000, Participants: 567890, EndDate: '2026-03-31', 
        Category: 'politics', YesPrice: 0.28, NoPrice: 0.72, 
        isRealData: false, dataSource: '✈️ Telegram Hot',
        externalPlatform: 'telegram', externalUrl: 'https://t.me/worldnews',
        trendingScore: 98, engagementCount: 12000000
      },
    ]
  }

  // 生成备用市场数据
  const generateFallbackMarkets = (): Market[] => {
    return [
      // 🔥 加密货币 Crypto - Hot Topics
      { ID: 'local_1', Name: 'Will Bitcoin reach $150,000 by end of 2026?', NameZh: 'BTC能否在2026年底前达到15万美元？', Description: 'Bitcoin ETF inflows continue to break records. This market resolves YES if BTC reaches $150,000.', DescriptionZh: '比特币ETF资金持续创纪录流入。如果BTC达到15万美元，解决为YES。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', Volume: 18540000, Participants: 12345, EndDate: '2026-12-31', Category: 'crypto', YesPrice: 0.42, NoPrice: 0.58, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_2', Name: 'Will Ethereum break $10,000 in 2026?', NameZh: 'ETH能否在2026年突破1万美元？', Description: 'Ethereum L2 ecosystem expanding rapidly. Resolves YES if ETH reaches $10,000.', DescriptionZh: '以太坊L2生态快速扩张。如果ETH达到1万美元，解决为YES。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-14', Volume: 9340000, Participants: 5987, EndDate: '2026-12-31', Category: 'crypto', YesPrice: 0.35, NoPrice: 0.65, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_3', Name: 'Will Solana surpass Ethereum in daily transactions by Q2 2026?', NameZh: 'Solana能否在2026年Q2日交易量超越以太坊？', Description: 'Solana experiencing massive adoption in DeFi and NFTs.', DescriptionZh: 'Solana在DeFi和NFT领域经历大规模采用。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-12', Volume: 6780000, Participants: 4123, EndDate: '2026-06-30', Category: 'crypto', YesPrice: 0.28, NoPrice: 0.72, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      
      // 🏛️ 政治 Politics - Global Elections & Policy
      { ID: 'local_4', Name: 'Will Trump win the 2028 Presidential Election?', NameZh: 'Trump能否赢得2028年总统大选？', Description: 'Trump announces new 2028 campaign strategy. Resolves YES if Trump wins.', DescriptionZh: 'Trump宣布新的2028竞选策略。如果Trump获胜，解决为YES。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', Volume: 25230000, Participants: 18876, EndDate: '2028-11-05', Category: 'politics', YesPrice: 0.38, NoPrice: 0.62, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_5', Name: 'Will Democrats retain control of Congress in 2026 midterms?', NameZh: '民主党能否在2026年中期选举中保持国会控制权？', Description: 'Critical midterm elections ahead with multiple swing states in play.', DescriptionZh: '关键的中期选举即将到来，多个摇摆州竞争激烈。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-10', Volume: 12560000, Participants: 8765, EndDate: '2026-11-03', Category: 'politics', YesPrice: 0.45, NoPrice: 0.55, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_6', Name: 'Will China announce Taiwan reunification timeline in 2026?', NameZh: '中国会在2026年宣布统一台湾时间表吗？', Description: 'Cross-strait relations remain a major geopolitical focus.', DescriptionZh: '两岸关系仍是主要地缘政治焦点。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-08', Volume: 8900000, Participants: 6543, EndDate: '2026-12-31', Category: 'politics', YesPrice: 0.15, NoPrice: 0.85, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 🤖 科技 AI & Tech - Breakthrough News
      { ID: 'local_7', Name: 'Will OpenAI release GPT-5 in 2026?', NameZh: 'OpenAI会在2026年发布GPT-5吗？', Description: 'OpenAI claims major breakthrough in reasoning capabilities.', DescriptionZh: 'OpenAI宣称在推理能力上取得重大突破。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-15', Volume: 14500000, Participants: 9532, EndDate: '2026-12-31', Category: 'tech', YesPrice: 0.72, NoPrice: 0.28, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_8', Name: 'Will Apple release AR glasses in 2026?', NameZh: 'Apple会在2026年发布AR眼镜吗？', Description: 'Apple Vision Pro 2 leaks suggest major AR focus.', DescriptionZh: 'Apple Vision Pro 2泄露信息显示主要AR方向。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-14', Volume: 7560000, Participants: 4567, EndDate: '2026-12-31', Category: 'tech', YesPrice: 0.58, NoPrice: 0.42, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_9', Name: 'Will Anthropic reach AGI milestone in 2026?', NameZh: 'Anthropic能否在2026年达到AGI里程碑？', Description: 'Anthropic racing with OpenAI on AGI research.', DescriptionZh: 'Anthropic与OpenAI在AGI研究上展开竞赛。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-12', Volume: 5890000, Participants: 3456, EndDate: '2026-12-31', Category: 'tech', YesPrice: 0.22, NoPrice: 0.78, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_10', Name: 'Will Tesla launch Optimus robot commercially in 2026?', NameZh: 'Tesla会在2026年商业发布Optimus机器人吗？', Description: 'Tesla Optimus humanoid robot in advanced testing.', DescriptionZh: 'Tesla Optimus人形机器人进入高级测试阶段。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-10', Volume: 8120000, Participants: 5678, EndDate: '2026-12-31', Category: 'tech', YesPrice: 0.48, NoPrice: 0.52, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 📈 股票 Stocks - Market Predictions
      { ID: 'local_11', Name: 'Will NVIDIA stock reach $800 in 2026?', NameZh: 'NVIDIA股价能否在2026年达到800美元？', Description: 'NVIDIA unveils next-gen AI chips at CES 2026.', DescriptionZh: 'NVIDIA在CES 2026发布下一代AI芯片。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-13', Volume: 11890000, Participants: 7890, EndDate: '2026-12-31', Category: 'stocks', YesPrice: 0.52, NoPrice: 0.48, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_12', Name: 'Will Tesla stock reach $500 in 2026?', NameZh: 'Tesla股价能否在2026年达到500美元？', Description: 'Tesla expanding autonomous driving and energy businesses.', DescriptionZh: 'Tesla扩展自动驾驶和能源业务。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-11', Volume: 9560000, Participants: 6543, EndDate: '2026-12-31', Category: 'stocks', YesPrice: 0.38, NoPrice: 0.62, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_13', Name: 'Will S&P 500 break 6500 in 2026?', NameZh: '标普500能否在2026年突破6500点？', Description: 'US markets continue bull run amid rate cut expectations.', DescriptionZh: '在降息预期下，美国市场继续牛市。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-09', Volume: 15670000, Participants: 9876, EndDate: '2026-12-31', Category: 'stocks', YesPrice: 0.62, NoPrice: 0.38, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 💰 金融 Finance - Fed & Economy
      { ID: 'local_14', Name: 'Will Fed cut rates below 3% in 2026?', NameZh: '美联储会在2026年将利率降至3%以下吗？', Description: 'Fed officials signal potential rate cuts ahead.', DescriptionZh: '美联储官员暗示可能进一步降息。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-14', Volume: 13780000, Participants: 8156, EndDate: '2026-12-31', Category: 'finance', YesPrice: 0.55, NoPrice: 0.45, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_15', Name: 'Will US GDP growth exceed 3% in 2026?', NameZh: '美国2026年GDP增长能否超过3%？', Description: 'Strong economic indicators support growth expectations.', DescriptionZh: '强劲的经济指标支持增长预期。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-08', Volume: 7890000, Participants: 4567, EndDate: '2026-12-31', Category: 'finance', YesPrice: 0.42, NoPrice: 0.58, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_16', Name: 'Will inflation fall below 2% in US by end of 2026?', NameZh: '美国通胀能否在2026年底降至2%以下？', Description: 'Fed targeting 2% inflation rate as key policy goal.', DescriptionZh: '美联储以2%通胀率为关键政策目标。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-06', Volume: 6540000, Participants: 3890, EndDate: '2026-12-31', Category: 'finance', YesPrice: 0.48, NoPrice: 0.52, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 🏈 体育 Sports - Major Events
      { ID: 'local_17', Name: 'Will Kansas City Chiefs win Super Bowl 2027?', NameZh: '堪萨斯城酋长队能否赢得2027年超级碗？', Description: 'Chiefs dynasty continues with strong playoff performance.', DescriptionZh: '酋长队王朝以强劲的季后赛表现继续。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-13', Volume: 16120000, Participants: 12456, EndDate: '2027-02-14', Category: 'sports', YesPrice: 0.32, NoPrice: 0.68, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_18', Name: 'Will Lionel Messi win 2026 World Cup with Argentina?', NameZh: '梅西能否带领阿根廷赢得2026年世界杯？', Description: 'FIFA World Cup 2026 hosted by US, Canada, and Mexico.', DescriptionZh: 'FIFA 2026世界杯由美国、加拿大和墨西哥联合举办。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-10', Volume: 28900000, Participants: 45678, EndDate: '2026-07-19', Category: 'sports', YesPrice: 0.18, NoPrice: 0.82, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 🚀 太空 Space - Exploration
      { ID: 'local_19', Name: 'Will SpaceX Starship reach Mars orbit in 2026?', NameZh: 'SpaceX星舰能否在2026年到达火星轨道？', Description: 'SpaceX accelerating Mars mission preparations.', DescriptionZh: 'SpaceX加速火星任务准备工作。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-12', Volume: 8450000, Participants: 5678, EndDate: '2026-12-31', Category: 'tech', YesPrice: 0.12, NoPrice: 0.88, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_20', Name: 'Will China complete crewed Moon landing in 2026?', NameZh: '中国能否在2026年完成载人登月？', Description: 'China announces Moon mission timeline update.', DescriptionZh: '中国更新载人登月任务时间表。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-12', Volume: 7230000, Participants: 4890, EndDate: '2026-12-31', Category: 'tech', YesPrice: 0.08, NoPrice: 0.92, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 🌍 全球事件 Global Events
      { ID: 'local_21', Name: 'Will Russia-Ukraine conflict end in 2026?', NameZh: '俄乌冲突能否在2026年结束？', Description: 'Peace negotiations ongoing with international mediation.', DescriptionZh: '在国际调解下和平谈判正在进行。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-08', Volume: 14560000, Participants: 9876, EndDate: '2026-12-31', Category: 'politics', YesPrice: 0.25, NoPrice: 0.75, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_22', Name: 'Will WHO declare new pandemic emergency in 2026?', NameZh: '世卫组织会在2026年宣布新的大流行紧急状态吗？', Description: 'Global health surveillance remains heightened.', DescriptionZh: '全球健康监测保持高度警戒。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-05', Volume: 5670000, Participants: 3456, EndDate: '2026-12-31', Category: 'other', YesPrice: 0.15, NoPrice: 0.85, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },

      // 🎬 娱乐 Entertainment
      { ID: 'local_23', Name: 'Will Avatar 3 gross over $2 billion worldwide?', NameZh: '阿凡达3全球票房能否突破20亿美元？', Description: 'Avatar franchise continues with highly anticipated sequel.', DescriptionZh: '阿凡达系列推出备受期待的续集。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-10', Volume: 4890000, Participants: 2345, EndDate: '2026-12-31', Category: 'other', YesPrice: 0.68, NoPrice: 0.32, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
      { ID: 'local_24', Name: 'Will Taylor Swift break streaming records in 2026?', NameZh: 'Taylor Swift能否在2026年打破流媒体记录？', Description: 'Taylor Swift Eras Tour continues global domination.', DescriptionZh: 'Taylor Swift时代巡回演唱会继续全球统治。', Outcomes: ['YES', 'NO'], State: 'open', CreatedAt: '2026-01-09', Volume: 3560000, Participants: 8765, EndDate: '2026-12-31', Category: 'other', YesPrice: 0.78, NoPrice: 0.22, isRealData: false, dataSource: '🟢 Local', externalPlatform: 'local' },
    ]
  }

  useEffect(() => {
    fetchAllPlatformsData()
    // 每5分钟刷新一次
    const interval = setInterval(fetchAllPlatformsData, 300000)
    return () => clearInterval(interval)
  }, [])

  // 当选中市场改变时更新价格历史
  useEffect(() => {
    if (selectedMarket) {
      setPriceHistory(generatePriceHistory(selectedMarket.YesPrice || 0.5))
    }
  }, [selectedMarket?.ID])

  const fetchMarkets = async () => {
    try {
      const response = await axios.get('/v1/markets')
      if (response.data && response.data.length > 0) {
        // 合并后端数据
      }
    } catch {
      console.log('Backend API not available')
    }
  }

  useEffect(() => {
    fetchMarkets()
  }, [])

  const placeBet = async () => {
    if (!selectedMarket || !selectedOutcome || !betAmount) {
      alert('Please select market, outcome and amount / 请选择市场、结果和金额')
      return
    }
    const amount = parseFloat(betAmount)
    if (amount > userBalance) {
      alert('Insufficient balance / 余额不足')
      return
    }
    try {
      await axios.post('/v1/intents', { user_id: 'user_001', market_id: selectedMarket.ID, outcome: selectedOutcome, amount: amount * 100 })
    } catch { /* mock */ }
    const odds = selectedOutcome === 'YES' ? (1 / (selectedMarket.YesPrice || 0.5)).toFixed(2) : (1 / (selectedMarket.NoPrice || 0.5)).toFixed(2)
    alert(`✅ Bet placed successfully! / 下注成功!\nMarket / 市场: ${selectedMarket.Name}\nOutcome / 结果: ${selectedOutcome}\nAmount / 金额: $${betAmount}\nOdds / 赔率: ${odds}x`)
    setUserBalance(prev => prev - amount)
    setBetAmount('')
  }

  const filteredMarkets = markets.filter(m => {
    const matchCategory = activeCategory === 'all' || m.Category === activeCategory
    const matchSearch = m.Name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        m.NameZh.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  // 智能过滤与选中市场相关的新闻 - 前10条最相关
  // Smart filter news related to selected market - Top 10 most relevant
  const filteredNews = (() => {
    if (!selectedMarket) return news.slice(0, 10)
    
    const marketName = selectedMarket.Name.toLowerCase()
    const marketCategory = selectedMarket.Category || ''
    
    // 提取市场名称中的关键词
    const keywords: string[] = []
    
    // 加密货币相关关键词
    if (marketName.includes('bitcoin') || marketName.includes('btc')) keywords.push('bitcoin', 'btc')
    if (marketName.includes('ethereum') || marketName.includes('eth')) keywords.push('ethereum', 'eth')
    if (marketName.includes('solana') || marketName.includes('sol')) keywords.push('solana', 'sol')
    if (marketName.includes('$150')) keywords.push('$150', 'bitcoin')
    if (marketName.includes('$10,000') || marketName.includes('$10000')) keywords.push('$10,000', 'ethereum')
    
    // 政治相关关键词
    if (marketName.includes('trump')) keywords.push('trump', '2028', 'election')
    if (marketName.includes('biden')) keywords.push('biden')
    if (marketName.includes('congress') || marketName.includes('democrat') || marketName.includes('midterm')) keywords.push('congress', 'democrat', 'midterm')
    if (marketName.includes('taiwan') || marketName.includes('china') && marketName.includes('reunification')) keywords.push('taiwan', 'china', 'reunification')
    if (marketName.includes('russia') || marketName.includes('ukraine')) keywords.push('russia', 'ukraine', 'conflict')
    
    // 科技相关关键词
    if (marketName.includes('openai') || marketName.includes('gpt')) keywords.push('openai', 'gpt')
    if (marketName.includes('apple') || marketName.includes('ar glasses')) keywords.push('apple', 'ar', 'glasses')
    if (marketName.includes('anthropic') || marketName.includes('agi')) keywords.push('anthropic', 'agi', 'ai')
    if (marketName.includes('tesla') && marketName.includes('optimus')) keywords.push('tesla', 'optimus', 'robot')
    if (marketName.includes('spacex') || marketName.includes('starship') || marketName.includes('mars')) keywords.push('spacex', 'starship', 'mars')
    if (marketName.includes('moon') && marketName.includes('china')) keywords.push('china', 'moon', 'crewed')
    
    // 股票相关关键词
    if (marketName.includes('nvidia') || marketName.includes('nvda')) keywords.push('nvidia', '$800')
    if (marketName.includes('tesla') && marketName.includes('$500')) keywords.push('tesla', '$500')
    if (marketName.includes('s&p') || marketName.includes('sp500') || marketName.includes('6500')) keywords.push('s&p', '6500', 'sp500')
    
    // 金融相关关键词
    if (marketName.includes('fed') || marketName.includes('rate')) keywords.push('fed', 'rate', 'cut')
    if (marketName.includes('inflation')) keywords.push('inflation', '2%')
    if (marketName.includes('gdp')) keywords.push('gdp', 'growth', '3%')
    
    // 体育相关关键词
    if (marketName.includes('super bowl') || marketName.includes('chiefs') || marketName.includes('kansas')) keywords.push('super bowl', 'chiefs', 'kansas city')
    if (marketName.includes('world cup') || marketName.includes('messi') || marketName.includes('argentina')) keywords.push('world cup', 'messi', 'argentina', 'fifa')
    
    // 其他关键词
    if (marketName.includes('who') || marketName.includes('pandemic')) keywords.push('who', 'pandemic', 'health')
    if (marketName.includes('avatar')) keywords.push('avatar', 'movie', 'billion')
    if (marketName.includes('taylor swift')) keywords.push('taylor swift', 'streaming', 'record')
    
    // 计算每条新闻的相关性得分
    const scoredNews = news.map(item => {
      let score = 0
      
      // 类别匹配 +2分
      if (item.category === marketCategory) score += 2
      
      // 关键词匹配
      keywords.forEach(keyword => {
        // 新闻 relatedMarkets 包含关键词 +3分
        if (item.relatedMarkets.some(rm => rm.toLowerCase().includes(keyword.toLowerCase()))) {
          score += 3
        }
        // 新闻标题包含关键词 +2分
        if (item.title.toLowerCase().includes(keyword.toLowerCase())) {
          score += 2
        }
      })
      
      return { item, score }
    })
    
    // 按得分排序，取前10条
    return scoredNews
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => s.item)
  })()

  // ===== 悬停时获取相关新闻预览 / Get news preview on hover =====
  const getHoverNews = useCallback((market: Market | null) => {
    if (!market) return []
    const marketName = market.Name.toLowerCase()
    const marketCategory = market.Category || ''
    
    return news.filter(item => {
      if (item.category === marketCategory) return true
      return item.relatedMarkets.some(rm => 
        marketName.includes(rm.toLowerCase()) || rm.toLowerCase().includes(marketName.slice(0, 10))
      )
    }).slice(0, 3) // 悬停只显示3条
  }, [news])

  // ===== 市场排行榜排序 / Market Rankings Sorting =====
  const rankedMarkets = [...markets].sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return (b.Volume || 0) - (a.Volume || 0)
      case 'participants':
        return (b.Participants || 0) - (a.Participants || 0)
      case 'change':
        return Math.abs((b.YesPrice || 0.5) - 0.5) - Math.abs((a.YesPrice || 0.5) - 0.5)
      default:
        return 0
    }
  })

  // ===== 价格提醒功能 / Price Alert Functions =====
  const addPriceAlert = () => {
    if (!selectedMarket || !alertTargetPrice) return
    
    const newAlert: PriceAlert = {
      id: `alert_${Date.now()}`,
      marketId: selectedMarket.ID,
      marketName: selectedMarket.Name,
      targetPrice: parseFloat(alertTargetPrice) / 100,
      condition: alertCondition,
      isTriggered: false,
      createdAt: new Date().toISOString(),
    }
    
    setPriceAlerts(prev => [...prev, newAlert])
    setShowAlertModal(false)
    setAlertTargetPrice('')
    
    // 添加通知
    const message = `🔔 Alert set: ${selectedMarket.Name.slice(0, 30)}... ${alertCondition} ${alertTargetPrice}%`
    setNotifications(prev => [message, ...prev].slice(0, 5))
    
    // 3秒后移除通知
    setTimeout(() => {
      setNotifications(prev => prev.slice(0, -1))
    }, 3000)
  }

  const removeAlert = (alertId: string) => {
    setPriceAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  // 检查价格提醒触发
  useEffect(() => {
    if (!selectedMarket) return
    
    priceAlerts.forEach(alert => {
      if (alert.isTriggered) return
      const currentPrice = selectedMarket.YesPrice || 0.5
      
      if (
        (alert.condition === 'above' && currentPrice >= alert.targetPrice) ||
        (alert.condition === 'below' && currentPrice <= alert.targetPrice)
      ) {
        // 触发提醒
        setPriceAlerts(prev => prev.map(a => 
          a.id === alert.id ? { ...a, isTriggered: true } : a
        ))
        
        const message = `🔔 TRIGGERED: ${alert.marketName.slice(0, 25)}... is now ${alert.condition} ${(alert.targetPrice * 100).toFixed(0)}%`
        setNotifications(prev => [message, ...prev].slice(0, 5))
      }
    })
  }, [selectedMarket?.YesPrice, priceAlerts])

  // 更新增强图表数据
  useEffect(() => {
    if (selectedMarket) {
      setEnhancedHistory(generateEnhancedHistory(selectedMarket.YesPrice || 0.5))
    }
  }, [selectedMarket?.ID])

  const categories = [
    { id: 'all', label: 'All / 全部', icon: Flame },
    { id: 'crypto', label: 'Crypto / 加密', icon: TrendingUp },
    { id: 'politics', label: 'Politics / 政治', icon: Users },
    { id: 'tech', label: 'Tech / 科技', icon: Zap },
    { id: 'stocks', label: 'Stocks / 股票', icon: BarChart3 },
    { id: 'finance', label: 'Finance / 金融', icon: DollarSign },
    { id: 'sports', label: 'Sports / 体育', icon: Star },
  ]

  const totalActiveBets = betHistory.filter(b => b.status === 'active').reduce((sum, b) => sum + b.amount, 0)
  const totalPnL = betHistory.reduce((sum, b) => sum + b.pnl, 0)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative">
      {/* ===== 通知弹窗 / Notification Toasts ===== */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {notifications.map((msg, i) => (
            <div key={i} className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse flex items-center gap-2 text-sm">
              <BellRing className="h-4 w-4" />
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* ===== 悬停新闻预览浮窗 / Hover News Preview Popup ===== */}
      {hoveredMarket && getHoverNews(hoveredMarket).length > 0 && (
        <div 
          className="fixed z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl p-3 w-80"
          style={{ 
            left: Math.min(hoverPosition.x + 10, window.innerWidth - 340),
            top: Math.min(hoverPosition.y + 10, window.innerHeight - 200),
          }}
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#2a2a2a]">
            <Newspaper className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-medium text-blue-400">News Preview / 新闻预览</span>
          </div>
          <div className="space-y-2">
            {getHoverNews(hoveredMarket).map((item, idx) => (
              <div key={idx} className="text-xs">
                <p className="text-white line-clamp-1">{item.title}</p>
                <p className="text-gray-500 line-clamp-1">{item.titleZh}</p>
                <p className="text-gray-600 text-[10px]">{item.source} • {item.publishedAt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 排行榜弹窗 / Rankings Modal ===== */}
      {showRankings && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowRankings(false)}>
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <h2 className="text-xl font-bold">Market Rankings / 市场排行榜</h2>
              </div>
              <button onClick={() => setShowRankings(false)} className="p-1 hover:bg-[#2a2a2a] rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => setSortBy('volume')}
                className={`px-3 py-1.5 rounded text-sm ${sortBy === 'volume' ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-gray-400'}`}
              >
                💰 Volume / 交易量
              </button>
              <button 
                onClick={() => setSortBy('participants')}
                className={`px-3 py-1.5 rounded text-sm ${sortBy === 'participants' ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-gray-400'}`}
              >
                👥 Traders / 交易者
              </button>
              <button 
                onClick={() => setSortBy('change')}
                className={`px-3 py-1.5 rounded text-sm ${sortBy === 'change' ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-gray-400'}`}
              >
                📈 Volatility / 波动率
              </button>
            </div>
            
            <div className="space-y-2">
              {rankedMarkets.slice(0, 10).map((market, idx) => (
                <div 
                  key={market.ID} 
                  className="flex items-center gap-3 p-3 bg-[#1a1a1a] rounded-lg cursor-pointer hover:bg-[#2a2a2a]"
                  onClick={() => { setSelectedMarket(market); setShowRankings(false) }}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0 ? 'bg-yellow-500 text-black' :
                    idx === 1 ? 'bg-gray-400 text-black' :
                    idx === 2 ? 'bg-amber-700 text-white' :
                    'bg-[#2a2a2a] text-gray-400'
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{market.Name}</p>
                    <p className="text-xs text-gray-500 truncate">{market.NameZh}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      {sortBy === 'volume' ? `$${((market.Volume || 0) / 1e6).toFixed(1)}M` :
                       sortBy === 'participants' ? `${(market.Participants || 0).toLocaleString()}` :
                       `${((market.YesPrice || 0.5) * 100).toFixed(0)}%`}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {sortBy === 'volume' ? 'Volume' : sortBy === 'participants' ? 'Traders' : 'YES Price'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== 价格提醒设置弹窗 / Price Alert Modal ===== */}
      {showAlertModal && selectedMarket && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowAlertModal(false)}>
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-6 w-[400px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-500" />
                <h2 className="text-lg font-bold">Set Price Alert / 设置价格提醒</h2>
              </div>
              <button onClick={() => setShowAlertModal(false)} className="p-1 hover:bg-[#2a2a2a] rounded">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <p className="text-sm text-gray-400 mb-4 line-clamp-2">{selectedMarket.Name}</p>
            <p className="text-xs text-gray-500 mb-4">Current: {((selectedMarket.YesPrice || 0.5) * 100).toFixed(1)}%</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Condition / 条件</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAlertCondition('above')}
                    className={`flex-1 py-2 rounded ${alertCondition === 'above' ? 'bg-green-500 text-white' : 'bg-[#1a1a1a] text-gray-400'}`}
                  >
                    📈 Above / 高于
                  </button>
                  <button
                    onClick={() => setAlertCondition('below')}
                    className={`flex-1 py-2 rounded ${alertCondition === 'below' ? 'bg-red-500 text-white' : 'bg-[#1a1a1a] text-gray-400'}`}
                  >
                    📉 Below / 低于
                  </button>
                </div>
              </div>
              
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Target Price (%) / 目标价格</label>
                <Input
                  type="number"
                  placeholder="e.g., 50"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                  className="bg-[#1a1a1a] border-[#2a2a2a]"
                  min="1"
                  max="99"
                />
              </div>
              
              <Button onClick={addPriceAlert} className="w-full bg-emerald-500 hover:bg-emerald-600">
                <Bell className="h-4 w-4 mr-2" />
                Set Alert / 设置提醒
              </Button>
            </div>
            
            {/* 现有提醒列表 */}
            {priceAlerts.filter(a => a.marketId === selectedMarket.ID).length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
                <p className="text-xs text-gray-400 mb-2">Active Alerts / 活跃提醒</p>
                {priceAlerts.filter(a => a.marketId === selectedMarket.ID).map(alert => (
                  <div key={alert.id} className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded mb-1">
                    <span className="text-xs">
                      {alert.condition === 'above' ? '📈' : '📉'} {(alert.targetPrice * 100).toFixed(0)}%
                      {alert.isTriggered && <span className="ml-1 text-green-400">✓</span>}
                    </span>
                    <button onClick={() => removeAlert(alert.id)} className="text-red-400 hover:text-red-300">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 全局导航栏 / Global Navigation */}
      <GlobalNavbar 
        accountBalance={userBalance}
        showMetrics={false}
      />

      {/* 页面标题栏 / Page Header */}
      <div className="border-b border-[#1a1a1a] bg-[#0d0d0d]">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="h-6 w-6 text-yellow-500" />
              <div>
                <h1 className="text-lg font-bold">Prediction Market / 预测市场</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>Trade on future events / 交易未来事件</span>
                  {/* 平台统计标签 / Platform Stats Badges */}
                  <div className="flex items-center gap-1 ml-2 flex-wrap">
                    {/* 预测市场平台 */}
                    {platformStats.polymarket > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px]">
                        🟣 {platformStats.polymarket}
                      </span>
                    )}
                    {platformStats.manifold > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-400 text-[10px]">
                        🩷 {platformStats.manifold}
                      </span>
                    )}
                    {platformStats.metaculus > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px]">
                        🔵 {platformStats.metaculus}
                      </span>
                    )}
                    {platformStats.kalshi > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[10px]">
                        🟠 {platformStats.kalshi}
                      </span>
                    )}
                    {platformStats.predictit > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                        🔷 {platformStats.predictit}
                      </span>
                    )}
                    {/* 社交媒体平台 */}
                    {platformStats.twitter > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px]">
                        𝕏 {platformStats.twitter}
                      </span>
                    )}
                    {platformStats.reddit > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-600/20 text-orange-500 text-[10px]">
                        🔴 {platformStats.reddit}
                      </span>
                    )}
                    {platformStats.youtube > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-600/20 text-red-500 text-[10px]">
                        ▶️ {platformStats.youtube}
                      </span>
                    )}
                    {platformStats.tiktok > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 text-[10px]">
                        🎵 {platformStats.tiktok}
                      </span>
                    )}
                    {platformStats.discord > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-[10px]">
                        💬 {platformStats.discord}
                      </span>
                    )}
                    {platformStats.telegram > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-400/20 text-blue-300 text-[10px]">
                        ✈️ {platformStats.telegram}
                      </span>
                    )}
                    {/* 本地和汇总 */}
                    {platformStats.local > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">
                        🟢 {platformStats.local}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400 text-[10px]">
                      Total: {markets.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* 排行榜按钮 */}
              <button 
                onClick={() => setShowRankings(true)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-xs text-yellow-400"
              >
                <Trophy className="h-3 w-3" />
                <span>Rankings / 排行榜</span>
              </button>
              
              {/* 提醒数量 */}
              {priceAlerts.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-xs text-blue-400">
                  <Bell className="h-3 w-3" />
                  <span>{priceAlerts.length} Alerts</span>
                </div>
              )}
              
              <button 
                onClick={fetchAllPlatformsData}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#2a2a2a] text-xs text-gray-400"
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh / 刷新</span>
              </button>
              <div className="text-xs text-gray-500">
                Updated / 更新: {lastUpdate.toLocaleTimeString()}
              </div>
              <div className="text-sm text-gray-400">
                <Bilingual en="Active Bets" zh="活跃下注" />: <span className="text-white font-bold">${totalActiveBets.toLocaleString()}</span>
              </div>
              <div className={`text-sm ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                <Bilingual en="Total P&L" zh="总盈亏" />: <span className="font-bold">{totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 bg-[#1a1a1a] px-4 py-2 rounded-lg border border-[#2a2a2a]">
                <Wallet className="h-4 w-4 text-emerald-500" />
                <span className="font-bold">${userBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left - Market List */}
          <div className="col-span-3 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input placeholder="Search / 搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-[#0d0d0d] border-[#2a2a2a]" />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-colors ${activeCategory === cat.id ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300'}`}>
                  <cat.icon className="h-3 w-3" />{cat.label}
                </button>
              ))}
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredMarkets.map((market) => (
                  <button 
                    key={market.ID} 
                    onClick={() => { setSelectedMarket(market); setSelectedOutcome(''); setHoveredMarket(null) }} 
                    onMouseEnter={(e) => {
                      setHoveredMarket(market)
                      setHoverPosition({ x: e.clientX, y: e.clientY })
                    }}
                    onMouseLeave={() => setHoveredMarket(null)}
                    onMouseMove={(e) => setHoverPosition({ x: e.clientX, y: e.clientY })}
                    className={`w-full p-4 rounded-lg text-left transition-all ${selectedMarket?.ID === market.ID ? 'bg-emerald-500/20 ring-2 ring-emerald-500' : 'bg-[#0d0d0d] hover:bg-[#151515] border border-[#1a1a1a]'} ${market.externalPlatform && market.externalPlatform !== 'local' ? 'border-l-2' : ''}`}
                    style={market.externalPlatform && market.externalPlatform !== 'local' ? {
                      borderLeftColor: market.externalPlatform === 'polymarket' ? '#a855f7' : 
                                       market.externalPlatform === 'manifold' ? '#ec4899' :
                                       market.externalPlatform === 'metaculus' ? '#06b6d4' :
                                       market.externalPlatform === 'kalshi' ? '#f97316' :
                                       market.externalPlatform === 'predictit' ? '#3b82f6' :
                                       market.externalPlatform === 'insight' ? '#14b8a6' :
                                       market.externalPlatform === 'twitter' ? '#1d9bf0' :
                                       market.externalPlatform === 'reddit' ? '#ff4500' :
                                       market.externalPlatform === 'youtube' ? '#ff0000' :
                                       market.externalPlatform === 'tiktok' ? '#00f2ea' :
                                       market.externalPlatform === 'discord' ? '#5865f2' :
                                       market.externalPlatform === 'telegram' ? '#0088cc' : '#22c55e'
                    } : {}}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 pr-2">
                        <h3 className="font-semibold text-sm line-clamp-2">{market.Name}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{market.NameZh}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${market.State === 'open' ? 'bg-green-500/20 text-green-500' : 'bg-muted'}`}>LIVE</span>
                        {/* 外部平台标识 - External Platform Badge */}
                        {market.externalPlatform && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                            market.externalPlatform === 'polymarket' ? 'bg-purple-500/20 text-purple-400' :
                            market.externalPlatform === 'manifold' ? 'bg-pink-500/20 text-pink-400' :
                            market.externalPlatform === 'metaculus' ? 'bg-cyan-500/20 text-cyan-400' :
                            market.externalPlatform === 'kalshi' ? 'bg-orange-500/20 text-orange-400' :
                            market.externalPlatform === 'predictit' ? 'bg-blue-500/20 text-blue-400' :
                            market.externalPlatform === 'insight' ? 'bg-teal-500/20 text-teal-400' :
                            market.externalPlatform === 'twitter' ? 'bg-sky-500/20 text-sky-400' :
                            market.externalPlatform === 'reddit' ? 'bg-orange-600/20 text-orange-500' :
                            market.externalPlatform === 'youtube' ? 'bg-red-600/20 text-red-500' :
                            market.externalPlatform === 'tiktok' ? 'bg-cyan-400/20 text-cyan-300' :
                            market.externalPlatform === 'discord' ? 'bg-indigo-500/20 text-indigo-400' :
                            market.externalPlatform === 'telegram' ? 'bg-blue-400/20 text-blue-300' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {market.externalPlatform === 'polymarket' ? '🟣 Poly' :
                             market.externalPlatform === 'manifold' ? '🩷 Manifold' :
                             market.externalPlatform === 'metaculus' ? '🔵 Meta' :
                             market.externalPlatform === 'kalshi' ? '🟠 Kalshi' :
                             market.externalPlatform === 'predictit' ? '🔷 PredictIt' :
                             market.externalPlatform === 'insight' ? '🩵 Insight' :
                             market.externalPlatform === 'twitter' ? '𝕏 X/Twitter' :
                             market.externalPlatform === 'reddit' ? '🔴 Reddit' :
                             market.externalPlatform === 'youtube' ? '▶️ YouTube' :
                             market.externalPlatform === 'tiktok' ? '🎵 TikTok' :
                             market.externalPlatform === 'discord' ? '💬 Discord' :
                             market.externalPlatform === 'telegram' ? '✈️ Telegram' :
                             '🟢 Local'}
                          </span>
                        )}
                        {/* 热度分数 - Trending Score */}
                        {market.trendingScore && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            🔥 {market.trendingScore}
                          </span>
                        )}
                        {/* 新闻预览图标 */}
                        <Eye className="h-3 w-3 text-gray-600" />
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="flex gap-1 h-2">
                        <div className="bg-green-500 rounded-l" style={{ width: `${(market.YesPrice || 0.5) * 100}%` }} />
                        <div className="bg-red-500 rounded-r" style={{ width: `${(market.NoPrice || 0.5) * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] mt-1 opacity-70">
                        <span className="text-green-500">YES {((market.YesPrice || 0.5) * 100).toFixed(0)}%</span>
                        <span className="text-red-500">NO {((market.NoPrice || 0.5) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] opacity-70">
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${((market.Volume || 0) / 1000000).toFixed(1)}M</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{market.Participants}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{market.EndDate}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center - Market Details */}
          <div className="col-span-6 space-y-4">
            {selectedMarket && (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <BilingualBlock 
                        en={selectedMarket.Name} 
                        zh={selectedMarket.NameZh}
                        enClass="text-2xl font-bold"
                        zhClass="text-lg text-gray-400 mt-1"
                      />
                      <div className="flex flex-col items-end gap-2">
                        {/* 外部平台标识和链接 */}
                        {selectedMarket.externalPlatform && selectedMarket.externalPlatform !== 'local' && (
                          <a 
                            href={selectedMarket.externalUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-all hover:opacity-80 ${
                              selectedMarket.externalPlatform === 'polymarket' ? 'bg-purple-500/20 text-purple-400' :
                              selectedMarket.externalPlatform === 'manifold' ? 'bg-pink-500/20 text-pink-400' :
                              selectedMarket.externalPlatform === 'metaculus' ? 'bg-cyan-500/20 text-cyan-400' :
                              selectedMarket.externalPlatform === 'kalshi' ? 'bg-orange-500/20 text-orange-400' :
                              selectedMarket.externalPlatform === 'predictit' ? 'bg-blue-500/20 text-blue-400' :
                              selectedMarket.externalPlatform === 'insight' ? 'bg-teal-500/20 text-teal-400' :
                              selectedMarket.externalPlatform === 'twitter' ? 'bg-sky-500/20 text-sky-400' :
                              selectedMarket.externalPlatform === 'reddit' ? 'bg-orange-600/20 text-orange-500' :
                              selectedMarket.externalPlatform === 'youtube' ? 'bg-red-500/20 text-red-400' :
                              selectedMarket.externalPlatform === 'tiktok' ? 'bg-cyan-400/20 text-cyan-300' :
                              selectedMarket.externalPlatform === 'discord' ? 'bg-indigo-500/20 text-indigo-400' :
                              selectedMarket.externalPlatform === 'telegram' ? 'bg-blue-400/20 text-blue-300' :
                              'bg-gray-500/20 text-gray-400'
                            }`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {selectedMarket.externalPlatform === 'polymarket' ? '🟣 Polymarket' :
                             selectedMarket.externalPlatform === 'manifold' ? '🩷 Manifold Markets' :
                             selectedMarket.externalPlatform === 'metaculus' ? '🔵 Metaculus' :
                             selectedMarket.externalPlatform === 'kalshi' ? '🟠 Kalshi' :
                             selectedMarket.externalPlatform === 'predictit' ? '🔷 PredictIt' :
                             selectedMarket.externalPlatform === 'insight' ? '🩵 Insight Prediction' :
                             selectedMarket.externalPlatform === 'twitter' ? '𝕏 X/Twitter' :
                             selectedMarket.externalPlatform === 'reddit' ? '🔴 Reddit' :
                             selectedMarket.externalPlatform === 'youtube' ? '▶️ YouTube' :
                             selectedMarket.externalPlatform === 'tiktok' ? '🎵 TikTok' :
                             selectedMarket.externalPlatform === 'discord' ? '💬 Discord' :
                             selectedMarket.externalPlatform === 'telegram' ? '✈️ Telegram' :
                             '🔗 External'}
                          </a>
                        )}
                        {/* 社交媒体热度指标 */}
                        {selectedMarket.trendingScore && selectedMarket.trendingScore > 0 && (
                          <div className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                            🔥 Trending Score: {selectedMarket.trendingScore.toLocaleString()}
                            {selectedMarket.engagementCount && (
                              <span className="ml-2">👥 {(selectedMarket.engagementCount / 1000).toFixed(1)}K</span>
                            )}
                          </div>
                        )}
                        {selectedMarket.externalPlatform === 'local' && (
                          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">
                            🟢 Local Market / 本地市场
                          </span>
                        )}
                        {/* 数据源标识 */}
                        <span className="text-[10px] text-gray-500">
                          {selectedMarket.dataSource}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-[#0d0d0d] rounded-lg p-3 mb-4 border border-[#1a1a1a]">
                      <p className="text-sm text-gray-300">{selectedMarket.Description}</p>
                      <p className="text-xs text-gray-500 mt-1">{selectedMarket.DescriptionZh}</p>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">Volume / 交易量</div>
                        <div className="text-lg font-bold">${((selectedMarket.Volume || 0) / 1000000).toFixed(2)}M</div>
                      </div>
                      <div className="bg-accent rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">Traders / 交易者</div>
                        <div className="text-lg font-bold">{selectedMarket.Participants?.toLocaleString()}</div>
                      </div>
                      <div className="bg-accent rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">YES Prob / 概率</div>
                        <div className="text-lg font-bold text-green-500">{((selectedMarket.YesPrice || 0.5) * 100).toFixed(1)}%</div>
                      </div>
                      <div className="bg-accent rounded-lg p-3 text-center">
                        <div className="text-xs text-muted-foreground">End / 结束</div>
                        <div className="text-lg font-bold">{selectedMarket.EndDate}</div>
                      </div>
                    </div>
                    
                    {/* 图表增强控制 */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setChartView('simple')}
                          className={`px-3 py-1 text-xs rounded-lg transition-all ${chartView === 'simple' ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'}`}
                        >
                          Simple / 简单
                        </button>
                        <button
                          onClick={() => setChartView('compare')}
                          className={`px-3 py-1 text-xs rounded-lg transition-all ${chartView === 'compare' ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#252525]'}`}
                        >
                          Compare / 对比
                        </button>
                      </div>
                      <button
                        onClick={() => setShowAlertModal(true)}
                        className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-all"
                      >
                        <Bell className="h-3 w-3" />
                        Set Alert / 设置提醒
                      </button>
                    </div>

                    <div className={chartView === 'compare' ? 'h-64' : 'h-48'} style={{ marginBottom: '16px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        {chartView === 'simple' ? (
                          <AreaChart data={priceHistory}>
                            <defs><linearGradient id="yesG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs>
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                            <Tooltip contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8 }} formatter={(value: number) => [`${(value * 100).toFixed(1)}%`]} />
                            <Area type="monotone" dataKey="yes" stroke="#22c55e" fill="url(#yesG)" strokeWidth={2} name="YES" />
                          </AreaChart>
                        ) : (
                          <LineChart data={enhancedHistory}>
                            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                            <Tooltip 
                              contentStyle={{ background: '#1a1a2e', border: 'none', borderRadius: 8 }} 
                              formatter={(value: number, name: string) => [
                                `${(value * 100).toFixed(1)}%`,
                                name === 'current' ? 'Current / 当前' : name === 'weekAgo' ? '7 Days Ago / 7天前' : '30 Days Ago / 30天前'
                              ]} 
                            />
                            <Legend 
                              formatter={(value) => value === 'current' ? 'Current' : value === 'weekAgo' ? '7D Ago' : '30D Ago'}
                              wrapperStyle={{ fontSize: '10px' }}
                            />
                            <ReferenceLine y={selectedMarket.YesPrice || 0.5} stroke="#888" strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="current" stroke="#22c55e" strokeWidth={2} dot={false} name="current" />
                            <Line type="monotone" dataKey="weekAgo" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="5 5" name="weekAgo" />
                            <Line type="monotone" dataKey="monthAgo" stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="3 3" name="monthAgo" />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                    
                    {/* 价格提醒状态 */}
                    {priceAlerts.filter(a => a.marketId === selectedMarket.ID && !a.isTriggered).length > 0 && (
                      <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-yellow-500">
                          <BellRing className="h-4 w-4" />
                          <span>
                            {priceAlerts.filter(a => a.marketId === selectedMarket.ID && !a.isTriggered).length} active alert(s) / 
                            {priceAlerts.filter(a => a.marketId === selectedMarket.ID && !a.isTriggered).length} 个活动提醒
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setSelectedOutcome('YES')} className={`p-6 rounded-xl border-2 transition-all ${selectedOutcome === 'YES' ? 'border-green-500 bg-green-500/10 ring-2 ring-green-500/50' : 'border-border hover:border-green-500/50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-bold text-green-500">YES</span>
                          {selectedOutcome === 'YES' && <CheckCircle className="h-6 w-6 text-green-500" />}
                        </div>
                        <div className="text-4xl font-bold text-green-500 mb-2">{((selectedMarket.YesPrice || 0.5) * 100).toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Odds / 赔率: {(1 / (selectedMarket.YesPrice || 0.5)).toFixed(2)}x</div>
                      </button>
                      <button onClick={() => setSelectedOutcome('NO')} className={`p-6 rounded-xl border-2 transition-all ${selectedOutcome === 'NO' ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/50' : 'border-border hover:border-red-500/50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl font-bold text-red-500">NO</span>
                          {selectedOutcome === 'NO' && <CheckCircle className="h-6 w-6 text-red-500" />}
                        </div>
                        <div className="text-4xl font-bold text-red-500 mb-2">{((selectedMarket.NoPrice || 0.5) * 100).toFixed(1)}%</div>
                        <div className="text-sm text-muted-foreground">Odds / 赔率: {(1 / (selectedMarket.NoPrice || 0.5)).toFixed(2)}x</div>
                      </button>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      <Bilingual en="Bet Panel" zh="下注面板" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Amount / 金额 (USD)</label>
                        <Input type="number" placeholder="Enter amount / 输入金额..." value={betAmount} onChange={(e) => setBetAmount(e.target.value)} className="text-lg h-12" />
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {[100, 500, 1000, 5000, 10000].map(amt => (
                          <Button key={amt} variant="outline" size="sm" onClick={() => setBetAmount(amt.toString())}>
                            ${amt >= 1000 ? `${amt/1000}K` : amt}
                          </Button>
                        ))}
                      </div>
                      {selectedOutcome && betAmount && (
                        <div className="bg-accent rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Selection / 选择</span>
                            <span className={`font-bold ${selectedOutcome === 'YES' ? 'text-green-500' : 'text-red-500'}`}>{selectedOutcome}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Odds / 赔率</span>
                            <span className="font-bold">{selectedOutcome === 'YES' ? (1 / (selectedMarket.YesPrice || 0.5)).toFixed(2) : (1 / (selectedMarket.NoPrice || 0.5)).toFixed(2)}x</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Potential Return / 潜在收益</span>
                            <span className="font-bold text-green-500">${(parseFloat(betAmount) * (selectedOutcome === 'YES' ? (1 / (selectedMarket.YesPrice || 0.5)) : (1 / (selectedMarket.NoPrice || 0.5)))).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                      <Button onClick={placeBet} className={`w-full h-12 text-lg font-bold ${selectedOutcome === 'YES' ? 'bg-green-500 hover:bg-green-600' : selectedOutcome === 'NO' ? 'bg-red-500 hover:bg-red-600' : ''}`} size="lg" disabled={!selectedOutcome || !betAmount || parseFloat(betAmount) > userBalance}>
                        {!selectedOutcome ? 'Select Outcome / 请选择结果' : parseFloat(betAmount) > userBalance ? 'Insufficient / 余额不足' : `Bet / 下注 ${selectedOutcome} - $${betAmount || '0'}`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* 相关新闻面板 / Related News Panel - 前10条最相关新闻 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Newspaper className="h-5 w-5 text-blue-400" />
                        <Bilingual en="Related News" zh="相关新闻" />
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                        Top {filteredNews.length} / 前{filteredNews.length}条
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {filteredNews.length > 0 ? (
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {filteredNews.map((item, index) => (
                          <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg bg-[#0d0d0d] hover:bg-[#151515] border border-[#1a1a1a] transition-colors group">
                            <div className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold">
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium mb-0.5 group-hover:text-blue-400 transition-colors line-clamp-2">{item.title}</h4>
                                <p className="text-xs text-gray-500 mb-1 line-clamp-1">{item.titleZh}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="text-blue-400 font-medium">{item.source}</span>
                                  <span>•</span>
                                  <span>{item.publishedAt}</span>
                                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                                    {item.category.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <ExternalLink className="h-4 w-4 text-gray-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No related news available</p>
                        <p className="text-xs mt-1">暂无相关新闻</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Right - Account */}
          <div className="col-span-3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  <Bilingual en="Account" zh="账户" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Available Balance / 可用余额</div>
                    <div className="text-3xl font-bold">${userBalance.toLocaleString()}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-accent rounded-lg p-3">
                      <div className="text-xs text-muted-foreground">Active / 活跃</div>
                      <div className="text-lg font-bold">${totalActiveBets.toLocaleString()}</div>
                    </div>
                    <div className="bg-accent rounded-lg p-3">
                      <div className="text-xs text-muted-foreground">P&L / 盈亏</div>
                      <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>{totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <Bilingual en="Bet History" zh="下注历史" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="active">
                  <TabsList className="w-full mb-3">
                    <TabsTrigger value="active" className="flex-1">Active / 进行中</TabsTrigger>
                    <TabsTrigger value="settled" className="flex-1">Settled / 已结算</TabsTrigger>
                  </TabsList>
                  <TabsContent value="active" className="space-y-2 max-h-48 overflow-y-auto">
                    {betHistory.filter(b => b.status === 'active').map(bet => (
                      <div key={bet.id} className="p-3 bg-accent rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{bet.market}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${bet.outcome === 'YES' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{bet.outcome}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">${bet.amount} @ {bet.odds}x</span>
                          <span className={bet.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>{bet.pnl >= 0 ? '+' : ''}${bet.pnl}</span>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="settled" className="space-y-2 max-h-48 overflow-y-auto">
                    {betHistory.filter(b => b.status !== 'active').map(bet => (
                      <div key={bet.id} className="p-3 bg-accent rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{bet.market}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${bet.status === 'won' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{bet.status === 'won' ? 'Won/赢' : 'Lost/输'}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">${bet.amount}</span>
                          <span className={bet.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>{bet.pnl >= 0 ? '+' : ''}${bet.pnl}</span>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <Bilingual en="Hot Markets" zh="热门市场" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {markets.slice(0, 5).sort((a, b) => (b.Volume || 0) - (a.Volume || 0)).map((market, i) => (
                    <button key={market.ID} onClick={() => { setSelectedMarket(market); setSelectedOutcome('') }} className="w-full flex items-center gap-3 p-2 rounded hover:bg-accent text-left">
                      <span className="text-lg font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{market.Name}</div>
                        <div className="text-xs text-muted-foreground truncate">{market.NameZh}</div>
                      </div>
                      <div className="text-sm font-bold text-green-500">{((market.YesPrice || 0.5) * 100).toFixed(0)}%</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
