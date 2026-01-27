'use client'

import { useState, useEffect, useCallback } from 'react'
import { History, Loader2, RefreshCw, Search, Calendar, TrendingUp, TrendingDown, Filter, X } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface HistoryItem {
  id: string
  stock_code: string
  stock_name: string
  market: string | null
  current_price: number
  price_change_percent: number
  technical_score: number
  fundamental_score: number
  total_score: number
  recommendation: string
  tech_weight: number
  fund_weight: number
  analyzed_at: string
  created_at: string
}

const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num)

const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getRecommendationEmoji = (rec: string) => {
  switch (rec) {
    case '적극 매수': return '🟢🟢🟢'
    case '매수': return '🟢🟢'
    case '중립': return '🟡'
    case '매도': return '🔴🔴'
    case '적극 매도': return '🔴🔴🔴'
    default: return '🟡'
  }
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchCode, setSearchCode] = useState('')
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'mid' | 'low'>('all')

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ limit: '100' })
      if (searchCode) params.append('stock_code', searchCode)

      const res = await fetch(`${API_URL}/api/history?${params}`)
      const data = await res.json()

      if (data.success) {
        setHistory(data.data || [])
      } else {
        setError('히스토리를 불러올 수 없습니다')
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [searchCode])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchHistory()
  }

  const filteredHistory = history.filter(item => {
    if (filterScore === 'high') return item.total_score >= 70
    if (filterScore === 'mid') return item.total_score >= 40 && item.total_score < 70
    if (filterScore === 'low') return item.total_score < 40
    return true
  })

  // Stats
  const stats = {
    total: history.length,
    avgScore: history.length > 0 ? history.reduce((sum, h) => sum + h.total_score, 0) / history.length : 0,
    buySignals: history.filter(h => h.total_score >= 60).length,
    sellSignals: history.filter(h => h.total_score < 40).length
  }

  // Unique stocks
  const uniqueStocks = new Set(history.map(h => h.stock_code)).size

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-slate-200 flex items-center gap-3">
            <History className="w-7 h-7 text-amber-400" />
            분석 히스토리
          </h2>
          <p className="text-sm text-slate-500 mt-1">저장된 분석 결과 조회</p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="terminal-card p-4">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">총 분석</div>
          <div className="text-2xl font-bold text-slate-200 font-mono">{stats.total}</div>
          <div className="text-xs text-slate-500 mt-1">{uniqueStocks}개 종목</div>
        </div>
        <div className="terminal-card p-4">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">평균 점수</div>
          <div className={`text-2xl font-bold font-mono ${
            stats.avgScore >= 70 ? 'text-emerald' :
            stats.avgScore >= 40 ? 'text-gold' : 'text-rose'
          }`}>
            {stats.avgScore.toFixed(1)}
          </div>
        </div>
        <div className="terminal-card p-4 border-emerald-500/20">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">매수 신호</div>
          <div className="text-2xl font-bold text-emerald font-mono">{stats.buySignals}</div>
        </div>
        <div className="terminal-card p-4 border-rose-500/20">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">매도 신호</div>
          <div className="text-2xl font-bold text-rose font-mono">{stats.sellSignals}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="terminal-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="종목코드로 필터링..."
                className="terminal-input w-full pl-10 pr-10"
              />
              {searchCode && (
                <button
                  type="button"
                  onClick={() => { setSearchCode(''); fetchHistory(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button type="submit" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
              검색
            </button>
          </form>

          {/* Score Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              {[
                { value: 'all', label: '전체' },
                { value: 'high', label: '매수' },
                { value: 'mid', label: '중립' },
                { value: 'low', label: '매도' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilterScore(value as typeof filterScore)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    filterScore === value
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="terminal-card p-4 border-rose-500/30 bg-rose-500/5">
          <p className="text-rose-400 font-mono text-sm">ERROR: {error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="terminal-card p-12 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-400" />
          <p className="mt-4 text-slate-400">히스토리 로딩 중...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredHistory.length === 0 && (
        <div className="terminal-card p-12 text-center">
          <History className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-display font-semibold text-slate-300 mb-2">
            {history.length === 0 ? '저장된 분석이 없습니다' : '필터 결과가 없습니다'}
          </h3>
          <p className="text-slate-500">
            {history.length === 0
              ? '분석 시 "결과 저장" 옵션을 활성화하면 히스토리가 저장됩니다'
              : '필터 조건을 변경해보세요'
            }
          </p>
        </div>
      )}

      {/* History Table */}
      {!loading && filteredHistory.length > 0 && (
        <div className="terminal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <Calendar className="w-4 h-4 inline mr-1" />
                    분석일시
                  </th>
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
                {filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td className="text-slate-400 text-xs whitespace-nowrap">
                      {formatDateTime(item.analyzed_at)}
                    </td>
                    <td>
                      <div className="font-medium text-slate-200">{item.stock_name}</div>
                      <div className="text-xs text-slate-500">{item.stock_code}</div>
                    </td>
                    <td className="text-right text-slate-200">
                      ₩{formatNumber(item.current_price)}
                    </td>
                    <td className={`text-right font-medium ${
                      item.price_change_percent >= 0 ? 'price-up' : 'price-down'
                    }`}>
                      <span className="inline-flex items-center gap-1">
                        {item.price_change_percent >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {item.price_change_percent >= 0 ? '+' : ''}{item.price_change_percent?.toFixed(2) || '0.00'}%
                      </span>
                    </td>
                    <td className={`text-center ${
                      item.technical_score >= 70 ? 'text-emerald' :
                      item.technical_score >= 40 ? 'text-gold' : 'text-rose'
                    }`}>
                      {item.technical_score?.toFixed(0) || '-'}
                    </td>
                    <td className={`text-center ${
                      item.fundamental_score >= 70 ? 'text-emerald' :
                      item.fundamental_score >= 40 ? 'text-gold' : 'text-rose'
                    }`}>
                      {item.fundamental_score?.toFixed(0) || '-'}
                    </td>
                    <td className={`text-center font-bold ${
                      item.total_score >= 70 ? 'text-emerald' :
                      item.total_score >= 40 ? 'text-gold' : 'text-rose'
                    }`}>
                      {item.total_score?.toFixed(0) || '-'}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <span className="text-sm">
                        {getRecommendationEmoji(item.recommendation)} {item.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination hint */}
          {filteredHistory.length >= 100 && (
            <div className="p-4 text-center text-sm text-slate-500 border-t border-slate-700/50">
              최근 100개 결과만 표시됩니다
            </div>
          )}
        </div>
      )}
    </div>
  )
}
