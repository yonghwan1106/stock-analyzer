'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Briefcase, Plus, Trash2, Edit3, RefreshCw, TrendingUp, TrendingDown,
  Loader2, Search, X, AlertCircle, Check, Calendar, DollarSign, Hash
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface WatchlistItem {
  id: string
  stock_code: string
  stock_name: string
  market: string | null
  buy_price: number | null
  buy_quantity: number | null
  buy_date: string | null
  memo: string | null
  created_at: string
  updated_at: string
}

interface AnalysisData {
  current_price: number
  change_pct: number
  total_score: number
  recommendation: string
  recommendation_emoji: string
}

const formatNumber = (num: number) => new Intl.NumberFormat('ko-KR').format(num)

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function PortfolioPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysisData, setAnalysisData] = useState<Record<string, AnalysisData>>({})
  const [analyzingCodes, setAnalyzingCodes] = useState<Set<string>>(new Set())

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null)

  // Form states
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formBuyPrice, setFormBuyPrice] = useState('')
  const [formBuyQuantity, setFormBuyQuantity] = useState('')
  const [formBuyDate, setFormBuyDate] = useState('')
  const [formMemo, setFormMemo] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)  // 폼 에러 메시지

  // Search for adding
  const [searchQuery, setSearchQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)

  const fetchWatchlist = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/api/watchlist`)
      const data = await res.json()

      if (data.success) {
        setWatchlist(data.data || [])
      } else {
        setError('관심종목을 불러올 수 없습니다')
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  const searchStock = async () => {
    if (!searchQuery.trim()) return

    setSearchLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/search?query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()

      if (data.success && data.results.length > 0) {
        const result = data.results[0]
        setFormCode(result.code)
        setFormName(result.name)
      } else {
        setFormCode(searchQuery)
        setFormName('')
      }
    } catch {
      setFormCode(searchQuery)
    } finally {
      setSearchLoading(false)
    }
  }

  const addToWatchlist = async () => {
    if (!formCode || !formName) {
      setFormError('종목코드와 종목명을 입력해주세요')
      return
    }

    setFormLoading(true)
    setFormError(null)
    try {
      const res = await fetch(`${API_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: formCode,
          stock_name: formName,
          buy_price: formBuyPrice ? parseInt(formBuyPrice) : null,
          buy_quantity: formBuyQuantity ? parseInt(formBuyQuantity) : null,
          buy_date: formBuyDate || null,
          memo: formMemo || null
        })
      })

      const data = await res.json()
      if (data.success) {
        setShowAddModal(false)
        resetForm()
        fetchWatchlist()
      } else {
        // 서버에서 반환한 상세 에러 메시지 표시
        setFormError(data.detail || '추가에 실패했습니다')
      }
    } catch (err: any) {
      setFormError(err.message || '서버 연결에 실패했습니다')
    } finally {
      setFormLoading(false)
    }
  }

  const updateWatchlistItem = async () => {
    if (!editingItem) return

    setFormLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/watchlist/${editingItem.stock_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buy_price: formBuyPrice ? parseInt(formBuyPrice) : null,
          buy_quantity: formBuyQuantity ? parseInt(formBuyQuantity) : null,
          buy_date: formBuyDate || null,
          memo: formMemo || null
        })
      })

      const data = await res.json()
      if (data.success) {
        setShowEditModal(false)
        setEditingItem(null)
        resetForm()
        fetchWatchlist()
      }
    } catch {
      alert('수정에 실패했습니다')
    } finally {
      setFormLoading(false)
    }
  }

  const removeFromWatchlist = async (stockCode: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`${API_URL}/api/watchlist/${stockCode}`, { method: 'DELETE' })
      const data = await res.json()

      if (data.success) {
        fetchWatchlist()
      }
    } catch {
      alert('삭제에 실패했습니다')
    }
  }

  const analyzeStock = async (stockCode: string) => {
    setAnalyzingCodes(prev => new Set(prev).add(stockCode))

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: stockCode,
          tech_weight: 40,
          fund_weight: 60,
          save_result: false
        })
      })

      const data = await res.json()
      if (data.success) {
        setAnalysisData(prev => ({
          ...prev,
          [stockCode]: {
            current_price: data.current_price,
            change_pct: data.change_pct,
            total_score: data.total_score,
            recommendation: data.recommendation,
            recommendation_emoji: data.recommendation_emoji
          }
        }))
      }
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setAnalyzingCodes(prev => {
        const next = new Set(prev)
        next.delete(stockCode)
        return next
      })
    }
  }

  const analyzeAll = async () => {
    for (const item of watchlist) {
      await analyzeStock(item.stock_code)
      await new Promise(r => setTimeout(r, 500))
    }
  }

  const resetForm = () => {
    setFormCode('')
    setFormName('')
    setFormBuyPrice('')
    setFormBuyQuantity('')
    setFormBuyDate('')
    setFormMemo('')
    setSearchQuery('')
    setFormError(null)
  }

  const openEditModal = (item: WatchlistItem) => {
    setEditingItem(item)
    setFormBuyPrice(item.buy_price?.toString() || '')
    setFormBuyQuantity(item.buy_quantity?.toString() || '')
    setFormBuyDate(item.buy_date || '')
    setFormMemo(item.memo || '')
    setShowEditModal(true)
  }

  const calculateProfit = (item: WatchlistItem) => {
    const analysis = analysisData[item.stock_code]
    if (!analysis || !item.buy_price || !item.buy_quantity) return null

    const currentValue = analysis.current_price * item.buy_quantity
    const investedValue = item.buy_price * item.buy_quantity
    const profit = currentValue - investedValue
    const profitPct = ((currentValue - investedValue) / investedValue) * 100

    return { profit, profitPct, currentValue, investedValue }
  }

  // Portfolio summary
  const portfolioSummary = watchlist.reduce((acc, item) => {
    const profitData = calculateProfit(item)
    if (profitData) {
      acc.totalInvested += profitData.investedValue
      acc.totalCurrent += profitData.currentValue
      acc.totalProfit += profitData.profit
    }
    return acc
  }, { totalInvested: 0, totalCurrent: 0, totalProfit: 0 })

  const portfolioProfitPct = portfolioSummary.totalInvested > 0
    ? ((portfolioSummary.totalCurrent - portfolioSummary.totalInvested) / portfolioSummary.totalInvested) * 100
    : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-slate-200 flex items-center gap-3">
            <Briefcase className="w-7 h-7 text-amber-400" />
            내 종목
          </h2>
          <p className="text-sm text-slate-500 mt-1">관심 종목 및 보유 현황 관리</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={analyzeAll}
            disabled={watchlist.length === 0 || analyzingCodes.size > 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${analyzingCodes.size > 0 ? 'animate-spin' : ''}`} />
            전체 분석
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="glow-button flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            종목 추가
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      {portfolioSummary.totalInvested > 0 && (
        <div className="terminal-card p-6">
          <h3 className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-4">Portfolio Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="data-cell">
              <div className="text-xs text-slate-500 mb-1">투자금액</div>
              <div className="text-lg font-bold text-slate-200">₩{formatNumber(portfolioSummary.totalInvested)}</div>
            </div>
            <div className="data-cell">
              <div className="text-xs text-slate-500 mb-1">평가금액</div>
              <div className="text-lg font-bold text-slate-200">₩{formatNumber(portfolioSummary.totalCurrent)}</div>
            </div>
            <div className={`data-cell ${portfolioSummary.totalProfit >= 0 ? 'border-red-500/30 bg-red-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
              <div className="text-xs text-slate-500 mb-1">평가손익</div>
              <div className={`text-lg font-bold ${portfolioSummary.totalProfit >= 0 ? 'price-up' : 'price-down'}`}>
                {portfolioSummary.totalProfit >= 0 ? '+' : ''}₩{formatNumber(portfolioSummary.totalProfit)}
              </div>
            </div>
            <div className={`data-cell ${portfolioProfitPct >= 0 ? 'border-red-500/30 bg-red-500/5' : 'border-blue-500/30 bg-blue-500/5'}`}>
              <div className="text-xs text-slate-500 mb-1">수익률</div>
              <div className={`text-lg font-bold ${portfolioProfitPct >= 0 ? 'price-up' : 'price-down'}`}>
                {portfolioProfitPct >= 0 ? '+' : ''}{portfolioProfitPct.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="terminal-card p-4 border-rose-500/30 bg-rose-500/5">
          <div className="flex items-center gap-2 text-rose-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-mono text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="terminal-card p-12 text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-amber-400" />
          <p className="mt-4 text-slate-400">로딩 중...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && watchlist.length === 0 && (
        <div className="terminal-card p-12 text-center">
          <Briefcase className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-display font-semibold text-slate-300 mb-2">종목이 없습니다</h3>
          <p className="text-slate-500 mb-6">관심 종목을 추가하여 포트폴리오를 관리하세요</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="glow-button inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            첫 종목 추가하기
          </button>
        </div>
      )}

      {/* Watchlist Table */}
      {!loading && watchlist.length > 0 && (
        <div className="terminal-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th className="text-right">현재가</th>
                  <th className="text-right">등락률</th>
                  <th className="text-right">매수가</th>
                  <th className="text-right">수량</th>
                  <th className="text-right">평가손익</th>
                  <th className="text-center">점수</th>
                  <th className="text-center">관리</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => {
                  const analysis = analysisData[item.stock_code]
                  const isAnalyzing = analyzingCodes.has(item.stock_code)
                  const profitData = calculateProfit(item)

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium text-slate-200">{item.stock_name}</div>
                        <div className="text-xs text-slate-500">{item.stock_code}</div>
                      </td>
                      <td className="text-right">
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                        ) : analysis ? (
                          <span className="text-slate-200">₩{formatNumber(analysis.current_price)}</span>
                        ) : (
                          <button
                            onClick={() => analyzeStock(item.stock_code)}
                            className="text-xs text-amber-400 hover:text-amber-300"
                          >
                            조회
                          </button>
                        )}
                      </td>
                      <td className="text-right">
                        {analysis && (
                          <span className={analysis.change_pct >= 0 ? 'price-up' : 'price-down'}>
                            {analysis.change_pct >= 0 ? '+' : ''}{analysis.change_pct.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="text-right text-slate-400">
                        {item.buy_price ? `₩${formatNumber(item.buy_price)}` : '-'}
                      </td>
                      <td className="text-right text-slate-400">
                        {item.buy_quantity ? formatNumber(item.buy_quantity) : '-'}
                      </td>
                      <td className="text-right">
                        {profitData ? (
                          <div className={profitData.profit >= 0 ? 'price-up' : 'price-down'}>
                            <div>{profitData.profit >= 0 ? '+' : ''}₩{formatNumber(profitData.profit)}</div>
                            <div className="text-xs opacity-75">
                              ({profitData.profitPct >= 0 ? '+' : ''}{profitData.profitPct.toFixed(2)}%)
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="text-center">
                        {analysis && (
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
                            analysis.total_score >= 70 ? 'bg-emerald-500/20 text-emerald' :
                            analysis.total_score >= 40 ? 'bg-amber-500/20 text-gold' :
                            'bg-rose-500/20 text-rose'
                          }`}>
                            {analysis.recommendation_emoji} {analysis.total_score.toFixed(0)}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFromWatchlist(item.stock_code)}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="terminal-card w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-slate-200">종목 추가</h3>
              <button onClick={() => { setShowAddModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">종목 검색</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchStock()}
                  placeholder="종목코드 또는 종목명"
                  className="terminal-input flex-1"
                />
                <button onClick={searchStock} disabled={searchLoading} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
                  {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Code & Name */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">종목코드 *</label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="005930"
                  className="terminal-input w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">종목명 *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="삼성전자"
                  className="terminal-input w-full"
                />
              </div>
            </div>

            {/* Buy Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> 매수가
                </label>
                <input
                  type="number"
                  value={formBuyPrice}
                  onChange={(e) => setFormBuyPrice(e.target.value)}
                  placeholder="70000"
                  className="terminal-input w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" /> 수량
                </label>
                <input
                  type="number"
                  value={formBuyQuantity}
                  onChange={(e) => setFormBuyQuantity(e.target.value)}
                  placeholder="10"
                  className="terminal-input w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 매수일
                </label>
                <input
                  type="date"
                  value={formBuyDate}
                  onChange={(e) => setFormBuyDate(e.target.value)}
                  className="terminal-input w-full"
                />
              </div>
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">메모</label>
              <textarea
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={2}
                className="terminal-input w-full resize-none"
              />
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-rose-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={addToWatchlist}
                disabled={formLoading || !formCode || !formName}
                className="glow-button flex items-center gap-2"
              >
                {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="terminal-card w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-slate-200">
                {editingItem.stock_name} 수정
              </h3>
              <button onClick={() => { setShowEditModal(false); setEditingItem(null); resetForm(); }} className="text-slate-400 hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <span className="font-mono text-amber-400">{editingItem.stock_code}</span>
            </div>

            {/* Buy Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> 매수가
                </label>
                <input
                  type="number"
                  value={formBuyPrice}
                  onChange={(e) => setFormBuyPrice(e.target.value)}
                  placeholder="70000"
                  className="terminal-input w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" /> 수량
                </label>
                <input
                  type="number"
                  value={formBuyQuantity}
                  onChange={(e) => setFormBuyQuantity(e.target.value)}
                  placeholder="10"
                  className="terminal-input w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 매수일
                </label>
                <input
                  type="date"
                  value={formBuyDate}
                  onChange={(e) => setFormBuyDate(e.target.value)}
                  className="terminal-input w-full"
                />
              </div>
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wider">메모</label>
              <textarea
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={2}
                className="terminal-input w-full resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowEditModal(false); setEditingItem(null); resetForm(); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={updateWatchlistItem}
                disabled={formLoading}
                className="glow-button flex items-center gap-2"
              >
                {formLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
