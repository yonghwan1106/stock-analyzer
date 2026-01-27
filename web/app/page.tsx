'use client'

import { useState, useEffect } from 'react'
import {
  Search, TrendingUp, TrendingDown, Loader2, Download, Settings,
  BarChart3, PieChart, Star, StarOff, Save, ChevronDown, ChevronUp
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Types
interface Signal {
  indicator: string
  value: string
  sentiment: 'bullish' | 'bearish' | 'neutral'
}

interface StockInfo {
  per: number
  pbr: number
  eps: number
  roe: number
  high_52w: number
  low_52w: number
  market_cap: number
  volume: number
  foreign_ratio: number
}

interface AnalysisResult {
  success: boolean
  code: string
  name: string
  date: string
  current_price: number
  prev_close: number
  change_pct: number
  technical_score: number
  fundamental_score: number
  total_score: number
  recommendation: string
  recommendation_emoji: string
  weights: { technical: number; fundamental: number }
  technical_signals: Signal[]
  fundamental_signals: Signal[]
  stock_info: StockInfo
}

interface BatchResult {
  success: boolean
  count: number
  results: AnalysisResult[]
  summary: {
    total_analyzed: number
    failed: number
    buy_signals: number
    sell_signals: number
    neutral_signals: number
    avg_score: number
    errors: string[] | null
  }
}

const PRESETS = [
  { id: 'default', name: '기본값', tech: 40, fund: 60, desc: '일반 투자자' },
  { id: 'trading', name: '단기 트레이딩', tech: 70, fund: 30, desc: '단타/스윙' },
  { id: 'value', name: '가치투자', tech: 30, fund: 70, desc: '장기 투자자' },
  { id: 'balanced', name: '균형', tech: 50, fund: 50, desc: '밸런스형' },
]

const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num)

const formatMarketCap = (cap: number) => {
  if (cap >= 1000000000000) return `${(cap / 1000000000000).toFixed(1)}조`
  if (cap >= 100000000) return `${(cap / 100000000).toFixed(0)}억`
  return formatNumber(cap)
}

const getScoreClass = (score: number) => {
  if (score >= 70) return 'bullish'
  if (score >= 40) return 'neutral'
  return 'bearish'
}

const getSentimentColor = (sentiment: string) => {
  switch (sentiment) {
    case 'bullish': return 'text-emerald'
    case 'bearish': return 'text-rose'
    default: return 'text-gold'
  }
}

export default function AnalyzePage() {
  const [stockInput, setStockInput] = useState('')
  const [techWeight, setTechWeight] = useState(40)
  const [fundWeight, setFundWeight] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [batchResults, setBatchResults] = useState<BatchResult | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [saveToDb, setSaveToDb] = useState(true)
  const [isInWatchlist, setIsInWatchlist] = useState(false)
  const [savingToWatchlist, setSavingToWatchlist] = useState(false)

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(5000) })
        setApiStatus(res.ok ? 'online' : 'offline')
      } catch {
        setApiStatus('offline')
      }
    }
    checkApi()
  }, [])

  useEffect(() => {
    if (result?.code) {
      checkWatchlist(result.code)
    }
  }, [result?.code])

  const checkWatchlist = async (code: string) => {
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${code}/check`)
      const data = await res.json()
      setIsInWatchlist(data.is_in_watchlist)
    } catch {
      setIsInWatchlist(false)
    }
  }

  const toggleWatchlist = async () => {
    if (!result) return
    setSavingToWatchlist(true)

    try {
      if (isInWatchlist) {
        await fetch(`${API_URL}/api/watchlist/${result.code}`, { method: 'DELETE' })
        setIsInWatchlist(false)
      } else {
        await fetch(`${API_URL}/api/watchlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock_code: result.code,
            stock_name: result.name,
            market: null
          })
        })
        setIsInWatchlist(true)
      }
    } catch (err) {
      console.error('Watchlist error:', err)
    } finally {
      setSavingToWatchlist(false)
    }
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setTechWeight(preset.tech)
    setFundWeight(preset.fund)
  }

  const analyzeStock = async () => {
    if (!stockInput.trim()) {
      setError('종목코드 또는 종목명을 입력해주세요')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setBatchResults(null)

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: stockInput.trim(),
          tech_weight: techWeight,
          fund_weight: fundWeight,
          save_result: saveToDb
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || '분석 실패')
      }

      const data: AnalysisResult = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message || '분석 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const analyzeBatch = async () => {
    const stocks = stockInput.split(',').map(s => s.trim()).filter(s => s)

    if (stocks.length === 0) {
      setError('종목코드를 입력해주세요 (쉼표로 구분)')
      return
    }

    if (stocks.length > 20) {
      setError('최대 20개 종목까지 분석 가능합니다')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setBatchResults(null)

    try {
      const res = await fetch(`${API_URL}/api/analyze/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stocks,
          tech_weight: techWeight,
          fund_weight: fundWeight,
          save_result: saveToDb
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || '일괄 분석 실패')
      }

      const data: BatchResult = await res.json()
      setBatchResults(data)
    } catch (err: any) {
      setError(err.message || '일괄 분석 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const downloadJSON = () => {
    const data = batchResults || result
    if (!data) return

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-analysis-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      if (stockInput.includes(',')) {
        analyzeBatch()
      } else {
        analyzeStock()
      }
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* API Status */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-slate-200">
          종목 분석
        </h2>
        <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border ${
          apiStatus === 'online'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : apiStatus === 'offline'
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            apiStatus === 'online' ? 'bg-emerald-400' :
            apiStatus === 'offline' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'
          }`} />
          {apiStatus === 'online' ? 'API CONNECTED' :
           apiStatus === 'offline' ? 'API OFFLINE' : 'CONNECTING...'}
        </div>
      </div>

      {/* Search Section */}
      <div className="terminal-card p-6 space-y-5">
        <div className="space-y-3">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            Stock Code / Name
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="005930, 삼성전자, 또는 쉼표로 여러 종목 입력"
                className="terminal-input w-full pl-12 pr-4"
                disabled={loading}
              />
            </div>
            <button
              onClick={analyzeStock}
              disabled={loading || apiStatus !== 'online'}
              className="glow-button flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <BarChart3 className="w-5 h-5" />
              )}
              <span>분석</span>
            </button>
          </div>
        </div>

        {/* Batch Button */}
        {stockInput.includes(',') && (
          <button
            onClick={analyzeBatch}
            disabled={loading || apiStatus !== 'online'}
            className="w-full py-3 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-lg hover:bg-violet-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PieChart className="w-5 h-5" />}
            일괄 분석 ({stockInput.split(',').filter(s => s.trim()).length}개 종목)
          </button>
        )}

        {/* Options Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>가중치 설정</span>
            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToDb}
              onChange={(e) => setSaveToDb(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500/30"
            />
            <Save className="w-4 h-4" />
            <span>결과 저장</span>
          </label>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="space-y-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 animate-fade-in">
            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`p-3 rounded-lg border transition-all text-left ${
                      techWeight === preset.tech && fundWeight === preset.fund
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                    }`}
                  >
                    <div className="font-medium text-sm text-slate-200">{preset.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{preset.desc}</div>
                    <div className="text-xs text-amber-500/70 font-mono mt-2">
                      T:{preset.tech}% F:{preset.fund}%
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">
                Manual Adjustment
              </label>
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono w-28 text-slate-400">기술적 {techWeight}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={techWeight}
                  onChange={(e) => {
                    setTechWeight(Number(e.target.value))
                    setFundWeight(100 - Number(e.target.value))
                  }}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-sm font-mono w-28 text-right text-slate-400">펀더멘탈 {fundWeight}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="terminal-card p-4 border-rose-500/30 bg-rose-500/5 animate-fade-in">
          <p className="text-rose-400 font-mono text-sm">ERROR: {error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="terminal-card p-12 text-center animate-fade-in">
          <div className="relative inline-block">
            <div className="w-16 h-16 border-2 border-amber-500/30 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="mt-6 text-slate-400">네이버금융에서 데이터 수집 중...</p>
          <p className="text-xs text-slate-600 mt-2 font-mono">FETCHING STOCK DATA</p>
        </div>
      )}

      {/* Single Result */}
      {result && !loading && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Card */}
          <div className="terminal-card p-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-display text-3xl font-bold text-slate-100">
                    {result.name}
                  </h3>
                  <button
                    onClick={toggleWatchlist}
                    disabled={savingToWatchlist}
                    className={`p-2 rounded-lg transition-all ${
                      isInWatchlist
                        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                        : 'bg-slate-700/50 text-slate-400 hover:text-amber-400'
                    }`}
                  >
                    {savingToWatchlist ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isInWatchlist ? (
                      <Star className="w-5 h-5 fill-current" />
                    ) : (
                      <StarOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="font-mono text-slate-500 text-sm">{result.code}</p>
              </div>

              <div className="text-right">
                <div className="font-mono text-4xl font-bold text-slate-100">
                  ₩{formatNumber(result.current_price)}
                </div>
                <div className={`flex items-center justify-end gap-2 mt-1 ${
                  result.change_pct >= 0 ? 'price-up' : 'price-down'
                }`}>
                  {result.change_pct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span className="font-mono font-bold text-lg">
                    {result.change_pct >= 0 ? '+' : ''}{result.change_pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Score Display */}
            <div className="mt-6 p-5 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Total Score</p>
                  <div className="flex items-baseline gap-3">
                    <span className={`font-mono text-5xl font-bold ${
                      result.total_score >= 70 ? 'text-emerald' :
                      result.total_score >= 40 ? 'text-gold' : 'text-rose'
                    }`}>
                      {result.total_score.toFixed(0)}
                    </span>
                    <span className="text-slate-500 text-lg">/100</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2">Recommendation</p>
                  <div className={`score-badge ${getScoreClass(result.total_score)}`}>
                    <span className="text-xl">{result.recommendation_emoji}</span>
                    <span className="text-lg font-bold">{result.recommendation}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-700/50 text-sm font-mono">
                <span className="text-slate-500">기술적: <span className="text-slate-300">{result.technical_score.toFixed(0)}점</span></span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">펀더멘탈: <span className="text-slate-300">{result.fundamental_score.toFixed(0)}점</span></span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">가중치: <span className="text-amber-500">{(result.weights.technical * 100).toFixed(0)}%/{(result.weights.fundamental * 100).toFixed(0)}%</span></span>
              </div>
            </div>
          </div>

          {/* Analysis Details */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Technical */}
            <div className="terminal-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-sky" />
                  <h4 className="font-display text-lg font-semibold text-slate-200">기술적 분석</h4>
                </div>
                <span className={`score-badge ${getScoreClass(result.technical_score)}`}>
                  {result.technical_score.toFixed(0)}점
                </span>
              </div>
              <div className="space-y-2">
                {result.technical_signals.map((signal, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-700/50 last:border-0">
                    <span className="text-slate-400 text-sm">{signal.indicator}</span>
                    <span className={`font-mono text-sm font-medium ${getSentimentColor(signal.sentiment)}`}>
                      {signal.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fundamental */}
            <div className="terminal-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <PieChart className="w-5 h-5 text-violet" />
                  <h4 className="font-display text-lg font-semibold text-slate-200">펀더멘탈 분석</h4>
                </div>
                <span className={`score-badge ${getScoreClass(result.fundamental_score)}`}>
                  {result.fundamental_score.toFixed(0)}점
                </span>
              </div>
              <div className="space-y-2">
                {result.fundamental_signals.map((signal, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-700/50 last:border-0">
                    <span className="text-slate-400 text-sm">{signal.indicator}</span>
                    <span className={`font-mono text-sm font-medium ${getSentimentColor(signal.sentiment)}`}>
                      {signal.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stock Info */}
          <div className="terminal-card p-6">
            <h4 className="font-display text-lg font-semibold text-slate-200 mb-4">종목 정보</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {result.stock_info.per > 0 && (
                <div className="data-cell">
                  <div className="text-xs text-slate-500 mb-1">PER</div>
                  <div className="text-lg font-bold text-slate-200">{result.stock_info.per.toFixed(2)}배</div>
                </div>
              )}
              {result.stock_info.pbr > 0 && (
                <div className="data-cell">
                  <div className="text-xs text-slate-500 mb-1">PBR</div>
                  <div className="text-lg font-bold text-slate-200">{result.stock_info.pbr.toFixed(2)}배</div>
                </div>
              )}
              {result.stock_info.market_cap > 0 && (
                <div className="data-cell">
                  <div className="text-xs text-slate-500 mb-1">시가총액</div>
                  <div className="text-lg font-bold text-slate-200">{formatMarketCap(result.stock_info.market_cap)}</div>
                </div>
              )}
              {result.stock_info.foreign_ratio > 0 && (
                <div className="data-cell">
                  <div className="text-xs text-slate-500 mb-1">외국인 지분율</div>
                  <div className="text-lg font-bold text-slate-200">{result.stock_info.foreign_ratio.toFixed(1)}%</div>
                </div>
              )}
            </div>
          </div>

          {/* Download */}
          <div className="flex justify-end">
            <button
              onClick={downloadJSON}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              JSON 다운로드
            </button>
          </div>
        </div>
      )}

      {/* Batch Results */}
      {batchResults && !loading && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary */}
          <div className="terminal-card p-6">
            <h3 className="font-display text-xl font-semibold text-slate-200 mb-4">일괄 분석 요약</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="data-cell text-center">
                <div className="text-2xl font-bold text-slate-200">{batchResults.summary.total_analyzed}</div>
                <div className="text-xs text-slate-500 mt-1">분석 완료</div>
              </div>
              <div className="data-cell text-center border-emerald-500/30 bg-emerald-500/5">
                <div className="text-2xl font-bold text-emerald">{batchResults.summary.buy_signals}</div>
                <div className="text-xs text-slate-500 mt-1">매수 신호</div>
              </div>
              <div className="data-cell text-center border-amber-500/30 bg-amber-500/5">
                <div className="text-2xl font-bold text-gold">{batchResults.summary.neutral_signals}</div>
                <div className="text-xs text-slate-500 mt-1">중립</div>
              </div>
              <div className="data-cell text-center border-rose-500/30 bg-rose-500/5">
                <div className="text-2xl font-bold text-rose">{batchResults.summary.sell_signals}</div>
                <div className="text-xs text-slate-500 mt-1">매도 신호</div>
              </div>
              <div className="data-cell text-center border-sky-500/30 bg-sky-500/5">
                <div className="text-2xl font-bold text-sky">{batchResults.summary.avg_score.toFixed(0)}</div>
                <div className="text-xs text-slate-500 mt-1">평균 점수</div>
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="terminal-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>종목</th>
                    <th className="text-right">현재가</th>
                    <th className="text-right">등락률</th>
                    <th className="text-center">기술적</th>
                    <th className="text-center">펀더멘탈</th>
                    <th className="text-center">종합</th>
                    <th className="text-center">의견</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.results.map((r, i) => (
                    <tr key={r.code}>
                      <td className="text-slate-500">{i + 1}</td>
                      <td>
                        <div className="font-medium text-slate-200">{r.name}</div>
                        <div className="text-xs text-slate-500">{r.code}</div>
                      </td>
                      <td className="text-right text-slate-200">₩{formatNumber(r.current_price)}</td>
                      <td className={`text-right font-medium ${r.change_pct >= 0 ? 'price-up' : 'price-down'}`}>
                        {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(2)}%
                      </td>
                      <td className={`text-center ${r.technical_score >= 70 ? 'text-emerald' : r.technical_score >= 40 ? 'text-gold' : 'text-rose'}`}>
                        {r.technical_score.toFixed(0)}
                      </td>
                      <td className={`text-center ${r.fundamental_score >= 70 ? 'text-emerald' : r.fundamental_score >= 40 ? 'text-gold' : 'text-rose'}`}>
                        {r.fundamental_score.toFixed(0)}
                      </td>
                      <td className={`text-center font-bold ${r.total_score >= 70 ? 'text-emerald' : r.total_score >= 40 ? 'text-gold' : 'text-rose'}`}>
                        {r.total_score.toFixed(0)}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        {r.recommendation_emoji} {r.recommendation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Download */}
          <div className="flex justify-end">
            <button
              onClick={downloadJSON}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
            >
              <Download className="w-4 h-4" />
              JSON 다운로드
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!result && !batchResults && !loading && (
        <div className="terminal-card p-8 animate-fade-in">
          <h3 className="font-display text-xl font-semibold text-slate-200 mb-6">사용 방법</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center">1</span>
              <div>
                <p className="font-medium text-slate-200">종목 입력</p>
                <p className="text-sm text-slate-500 mt-1">종목코드(예: 005930) 또는 종목명(예: 삼성전자) 입력</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center">2</span>
              <div>
                <p className="font-medium text-slate-200">일괄 분석</p>
                <p className="text-sm text-slate-500 mt-1">쉼표로 구분하여 최대 20개 종목 동시 분석</p>
                <code className="inline-block mt-2 px-3 py-1.5 bg-slate-800 rounded text-xs text-amber-400 font-mono">
                  005930, 060250, 035720
                </code>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center">3</span>
              <div>
                <p className="font-medium text-slate-200">가중치 조절</p>
                <p className="text-sm text-slate-500 mt-1">투자 스타일에 맞게 기술적/펀더멘탈 비중 조절</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
