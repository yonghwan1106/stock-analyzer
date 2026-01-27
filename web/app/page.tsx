'use client'

import { useState, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, Loader2, Download, RefreshCw, Settings, BarChart3, PieChart } from 'lucide-react'

// API URL (환경변수 또는 기본값)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// 타입 정의
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
  error?: string
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

// 프리셋
const PRESETS = [
  { id: 'default', name: '기본값', tech: 40, fund: 60, desc: '일반 투자자' },
  { id: 'trading', name: '단기 트레이딩', tech: 70, fund: 30, desc: '단타/스윙' },
  { id: 'value', name: '가치투자', tech: 30, fund: 70, desc: '장기 투자자' },
  { id: 'balanced', name: '균형', tech: 50, fund: 50, desc: '밸런스형' },
]

// 신호 이모지
const getSentimentEmoji = (sentiment: string) => {
  switch (sentiment) {
    case 'bullish': return '🟢'
    case 'bearish': return '🔴'
    default: return '🟡'
  }
}

// 숫자 포맷
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('ko-KR').format(num)
}

const formatMarketCap = (cap: number) => {
  if (cap >= 1000000000000) {
    return `${(cap / 1000000000000).toFixed(1)}조`
  } else if (cap >= 100000000) {
    return `${(cap / 100000000).toFixed(0)}억`
  }
  return formatNumber(cap)
}

// 점수 색상
const getScoreColor = (score: number) => {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBgColor = (score: number) => {
  if (score >= 70) return 'bg-green-100 border-green-300'
  if (score >= 50) return 'bg-yellow-100 border-yellow-300'
  return 'bg-red-100 border-red-300'
}

export default function Home() {
  // 상태
  const [stockInput, setStockInput] = useState('')
  const [techWeight, setTechWeight] = useState(40)
  const [fundWeight, setFundWeight] = useState(60)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [batchResults, setBatchResults] = useState<BatchResult | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // API 상태 체크
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        })
        setApiStatus(res.ok ? 'online' : 'offline')
      } catch {
        setApiStatus('offline')
      }
    }
    checkApi()
  }, [])

  // 프리셋 적용
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setTechWeight(preset.tech)
    setFundWeight(preset.fund)
  }

  // 가중치 변경 (슬라이더)
  const handleTechWeightChange = (value: number) => {
    setTechWeight(value)
    setFundWeight(100 - value)
  }

  // 단일 종목 분석
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

  // 일괄 분석
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

  // JSON 다운로드
  const downloadJSON = () => {
    const data = batchResults || result
    if (!data) return
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stock-analysis-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 엔터 키 처리
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
    <div className="space-y-6">
      {/* API 상태 */}
      <div className="flex items-center justify-end">
        <div className={`flex items-center space-x-2 text-sm px-3 py-1 rounded-full ${
          apiStatus === 'online' ? 'bg-green-100 text-green-700' :
          apiStatus === 'offline' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            apiStatus === 'online' ? 'bg-green-500' :
            apiStatus === 'offline' ? 'bg-red-500' :
            'bg-yellow-500 animate-pulse'
          }`} />
          <span>
            {apiStatus === 'online' ? 'API 연결됨' :
             apiStatus === 'offline' ? 'API 오프라인' :
             '연결 확인 중...'}
          </span>
        </div>
      </div>

      {/* 입력 섹션 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 space-y-6">
        {/* 검색 입력 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            종목 입력
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="종목코드 또는 종목명 (예: 005930, 삼성전자)"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
                disabled={loading}
              />
            </div>
            <button
              onClick={analyzeStock}
              disabled={loading || apiStatus !== 'online'}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <BarChart3 className="w-5 h-5" />
              )}
              <span>분석</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            💡 여러 종목은 쉼표(,)로 구분하여 일괄 분석 가능 (예: 005930, 060250, 035720)
          </p>
        </div>

        {/* 일괄 분석 버튼 (쉼표가 있을 때만 표시) */}
        {stockInput.includes(',') && (
          <button
            onClick={analyzeBatch}
            disabled={loading || apiStatus !== 'online'}
            className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <PieChart className="w-5 h-5" />
            )}
            <span>일괄 분석 ({stockInput.split(',').filter(s => s.trim()).length}개 종목)</span>
          </button>
        )}

        {/* 가중치 설정 토글 */}
        <div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600"
          >
            <Settings className="w-4 h-4" />
            <span>가중치 설정 {showSettings ? '접기' : '펼치기'}</span>
          </button>
        </div>

        {/* 가중치 설정 (펼침) */}
        {showSettings && (
          <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            {/* 프리셋 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                프리셋 선택
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      techWeight === preset.tech && fundWeight === preset.fund
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-slate-200 dark:border-slate-600 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-slate-500">{preset.desc}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      기술 {preset.tech}% / 펀더 {preset.fund}%
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 슬라이더 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                직접 조절
              </label>
              <div className="flex items-center space-x-4">
                <span className="text-sm w-24">기술적 {techWeight}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={techWeight}
                  onChange={(e) => handleTechWeightChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-sm w-24 text-right">펀더멘탈 {fundWeight}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          ❌ {error}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            네이버금융에서 데이터 수집 중...
          </p>
          <p className="text-sm text-slate-400 mt-2">
            종목당 약 3-5초 소요됩니다
          </p>
        </div>
      )}

      {/* 단일 종목 결과 */}
      {result && !loading && (
        <div className="space-y-6">
          {/* 헤더 카드 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {result.name}
                </h2>
                <p className="text-slate-500">{result.code}</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  ₩{formatNumber(result.current_price)}
                </div>
                <div className={`flex items-center justify-end space-x-1 ${
                  result.change_pct >= 0 ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {result.change_pct >= 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  <span className="font-medium">
                    {result.change_pct >= 0 ? '+' : ''}{result.change_pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 종합 점수 */}
            <div className={`mt-6 p-4 rounded-lg border-2 ${getScoreBgColor(result.total_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">종합 점수</div>
                  <div className={`text-4xl font-bold ${getScoreColor(result.total_score)}`}>
                    {result.total_score.toFixed(0)}점
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-600">투자 의견</div>
                  <div className="text-2xl font-bold">
                    {result.recommendation_emoji} {result.recommendation}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-4 text-sm text-slate-600">
                <span>기술적: {result.technical_score.toFixed(0)}점</span>
                <span>|</span>
                <span>펀더멘탈: {result.fundamental_score.toFixed(0)}점</span>
                <span>|</span>
                <span>가중치: {(result.weights.technical * 100).toFixed(0)}% / {(result.weights.fundamental * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* 분석 상세 */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* 기술적 분석 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>기술적 분석</span>
                <span className={`text-sm px-2 py-1 rounded ${getScoreBgColor(result.technical_score)}`}>
                  {result.technical_score.toFixed(0)}점
                </span>
              </h3>
              <div className="space-y-3">
                {result.technical_signals.map((signal, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-slate-600 dark:text-slate-400">{signal.indicator}</span>
                    <span className="font-medium">
                      {getSentimentEmoji(signal.sentiment)} {signal.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 펀더멘탈 분석 */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-purple-600" />
                <span>펀더멘탈 분석</span>
                <span className={`text-sm px-2 py-1 rounded ${getScoreBgColor(result.fundamental_score)}`}>
                  {result.fundamental_score.toFixed(0)}점
                </span>
              </h3>
              <div className="space-y-3">
                {result.fundamental_signals.map((signal, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-slate-600 dark:text-slate-400">{signal.indicator}</span>
                    <span className="font-medium">
                      {getSentimentEmoji(signal.sentiment)} {signal.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold mb-4">📌 종목 정보</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {result.stock_info.per > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="text-xs text-slate-500">PER</div>
                  <div className="text-lg font-bold">{result.stock_info.per.toFixed(2)}배</div>
                </div>
              )}
              {result.stock_info.pbr > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="text-xs text-slate-500">PBR</div>
                  <div className="text-lg font-bold">{result.stock_info.pbr.toFixed(2)}배</div>
                </div>
              )}
              {result.stock_info.market_cap > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="text-xs text-slate-500">시가총액</div>
                  <div className="text-lg font-bold">{formatMarketCap(result.stock_info.market_cap)}</div>
                </div>
              )}
              {result.stock_info.foreign_ratio > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div className="text-xs text-slate-500">외국인 지분율</div>
                  <div className="text-lg font-bold">{result.stock_info.foreign_ratio.toFixed(1)}%</div>
                </div>
              )}
            </div>
          </div>

          {/* 다운로드 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={downloadJSON}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm"
            >
              <Download className="w-4 h-4" />
              <span>JSON 다운로드</span>
            </button>
          </div>
        </div>
      )}

      {/* 일괄 분석 결과 */}
      {batchResults && !loading && (
        <div className="space-y-6">
          {/* 요약 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-bold mb-4">📊 일괄 분석 요약</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-center">
                <div className="text-2xl font-bold">{batchResults.summary.total_analyzed}</div>
                <div className="text-xs text-slate-500">분석 완료</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{batchResults.summary.buy_signals}</div>
                <div className="text-xs text-slate-500">매수 신호</div>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-600">{batchResults.summary.neutral_signals}</div>
                <div className="text-xs text-slate-500">중립</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{batchResults.summary.sell_signals}</div>
                <div className="text-xs text-slate-500">매도 신호</div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{batchResults.summary.avg_score.toFixed(0)}</div>
                <div className="text-xs text-slate-500">평균 점수</div>
              </div>
            </div>
          </div>

          {/* 결과 테이블 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-300">순위</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-300">종목</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600 dark:text-slate-300">현재가</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-600 dark:text-slate-300">등락률</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">기술적</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">펀더멘탈</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">종합</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">의견</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {batchResults.results.map((r, i) => (
                    <tr key={r.code} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 text-sm font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-slate-500">{r.code}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">₩{formatNumber(r.current_price)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.change_pct >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(2)}%
                      </td>
                      <td className={`px-4 py-3 text-center ${getScoreColor(r.technical_score)}`}>
                        {r.technical_score.toFixed(0)}
                      </td>
                      <td className={`px-4 py-3 text-center ${getScoreColor(r.fundamental_score)}`}>
                        {r.fundamental_score.toFixed(0)}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${getScoreColor(r.total_score)}`}>
                        {r.total_score.toFixed(0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="whitespace-nowrap">
                          {r.recommendation_emoji} {r.recommendation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 다운로드 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={downloadJSON}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm"
            >
              <Download className="w-4 h-4" />
              <span>JSON 다운로드</span>
            </button>
          </div>
        </div>
      )}

      {/* 사용 가이드 (결과 없을 때) */}
      {!result && !batchResults && !loading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4">💡 사용 방법</h3>
          <div className="space-y-4 text-slate-600 dark:text-slate-400">
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 font-bold">1.</span>
              <div>
                <strong>종목 입력</strong>: 종목코드(예: 005930) 또는 종목명(예: 삼성전자) 입력
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 font-bold">2.</span>
              <div>
                <strong>일괄 분석</strong>: 쉼표로 구분하여 여러 종목 입력 (최대 20개)
                <br />
                <code className="text-sm bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">005930, 060250, 035720</code>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-blue-600 font-bold">3.</span>
              <div>
                <strong>가중치 조절</strong>: 투자 스타일에 맞게 기술적/펀더멘탈 비중 조절
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
