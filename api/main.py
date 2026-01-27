"""
📊 주식 분석 API 서버
======================
Railway 배포용 FastAPI 백엔드
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import asyncio
from datetime import datetime
import json

from analyzer import StockAnalyzer, NaverFinanceCrawler

# ============================================================
# FastAPI 앱 설정
# ============================================================

app = FastAPI(
    title="📊 주식 종합 분석 API",
    description="네이버금융 크롤링 + 기술적/펀더멘탈 분석",
    version="2.0.0"
)

# CORS 설정 (Vercel 프론트엔드 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        "*"  # 개발 중에는 전체 허용, 프로덕션에서는 특정 도메인만
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 요청/응답 모델
# ============================================================

class AnalyzeRequest(BaseModel):
    """단일 종목 분석 요청"""
    stock: str = Field(..., description="종목코드 또는 종목명", example="005930")
    tech_weight: float = Field(40, ge=0, le=100, description="기술적 분석 가중치 (%)")
    fund_weight: float = Field(60, ge=0, le=100, description="펀더멘탈 분석 가중치 (%)")

class BatchAnalyzeRequest(BaseModel):
    """일괄 분석 요청"""
    stocks: List[str] = Field(..., description="종목 목록", example=["005930", "060250"])
    tech_weight: float = Field(40, ge=0, le=100)
    fund_weight: float = Field(60, ge=0, le=100)

class SearchRequest(BaseModel):
    """종목 검색 요청"""
    query: str = Field(..., description="검색어", example="삼성")

class Signal(BaseModel):
    """분석 신호"""
    indicator: str
    value: str
    sentiment: str

class StockInfo(BaseModel):
    """종목 기본 정보"""
    per: float = 0
    pbr: float = 0
    eps: float = 0
    roe: float = 0
    high_52w: float = 0
    low_52w: float = 0
    market_cap: float = 0
    volume: int = 0
    foreign_ratio: float = 0

class AnalyzeResponse(BaseModel):
    """분석 결과"""
    success: bool
    code: str
    name: str
    date: str
    current_price: float
    prev_close: float
    change_pct: float
    technical_score: float
    fundamental_score: float
    total_score: float
    recommendation: str
    recommendation_emoji: str
    weights: Dict[str, float]
    technical_signals: List[Signal]
    fundamental_signals: List[Signal]
    stock_info: StockInfo
    error: Optional[str] = None

class BatchAnalyzeResponse(BaseModel):
    """일괄 분석 결과"""
    success: bool
    count: int
    results: List[AnalyzeResponse]
    summary: Dict

# ============================================================
# API 엔드포인트
# ============================================================

@app.get("/")
async def root():
    """헬스 체크"""
    return {
        "status": "healthy",
        "service": "Stock Analyzer API",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """헬스 체크 (Railway용)"""
    return {"status": "ok"}

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_stock(request: AnalyzeRequest):
    """
    단일 종목 분석
    
    - **stock**: 종목코드(6자리) 또는 종목명
    - **tech_weight**: 기술적 분석 가중치 (0-100%)
    - **fund_weight**: 펀더멘탈 분석 가중치 (0-100%)
    """
    try:
        analyzer = StockAnalyzer()
        analyzer.set_weights(request.tech_weight, request.fund_weight)
        
        result = await asyncio.to_thread(analyzer.analyze, request.stock)
        
        if not result:
            raise HTTPException(status_code=404, detail=f"종목을 찾을 수 없습니다: {request.stock}")
        
        # 응답 변환
        rec_emoji = {
            "적극 매수": "🟢🟢🟢",
            "매수": "🟢🟢", 
            "중립": "🟡",
            "매도": "🔴🔴",
            "적극 매도": "🔴🔴🔴"
        }
        
        return AnalyzeResponse(
            success=True,
            code=result["code"],
            name=result["name"],
            date=result["date"],
            current_price=result["current_price"],
            prev_close=result.get("prev_close", 0),
            change_pct=result["change_pct"],
            technical_score=result["technical_score"],
            fundamental_score=result["fundamental_score"],
            total_score=result["total_score"],
            recommendation=result["recommendation"],
            recommendation_emoji=rec_emoji.get(result["recommendation"], "🟡"),
            weights=result["weights"],
            technical_signals=[Signal(**s) for s in result["technical_signals"]],
            fundamental_signals=[Signal(**s) for s in result["fundamental_signals"]],
            stock_info=StockInfo(**result.get("stock_data", {}))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze/batch", response_model=BatchAnalyzeResponse)
async def analyze_batch(request: BatchAnalyzeRequest):
    """
    여러 종목 일괄 분석
    
    - **stocks**: 종목코드/종목명 배열 (최대 20개)
    - **tech_weight**: 기술적 분석 가중치
    - **fund_weight**: 펀더멘탈 분석 가중치
    """
    if len(request.stocks) > 20:
        raise HTTPException(status_code=400, detail="최대 20개 종목까지 분석 가능합니다")
    
    if len(request.stocks) == 0:
        raise HTTPException(status_code=400, detail="최소 1개 이상의 종목을 입력해주세요")
    
    try:
        analyzer = StockAnalyzer()
        analyzer.set_weights(request.tech_weight, request.fund_weight)
        
        results = []
        errors = []
        
        for stock in request.stocks:
            try:
                result = await asyncio.to_thread(analyzer.analyze, stock)
                if result:
                    rec_emoji = {
                        "적극 매수": "🟢🟢🟢",
                        "매수": "🟢🟢",
                        "중립": "🟡", 
                        "매도": "🔴🔴",
                        "적극 매도": "🔴🔴🔴"
                    }
                    
                    results.append(AnalyzeResponse(
                        success=True,
                        code=result["code"],
                        name=result["name"],
                        date=result["date"],
                        current_price=result["current_price"],
                        prev_close=result.get("prev_close", 0),
                        change_pct=result["change_pct"],
                        technical_score=result["technical_score"],
                        fundamental_score=result["fundamental_score"],
                        total_score=result["total_score"],
                        recommendation=result["recommendation"],
                        recommendation_emoji=rec_emoji.get(result["recommendation"], "🟡"),
                        weights=result["weights"],
                        technical_signals=[Signal(**s) for s in result["technical_signals"]],
                        fundamental_signals=[Signal(**s) for s in result["fundamental_signals"]],
                        stock_info=StockInfo(**result.get("stock_data", {}))
                    ))
                else:
                    errors.append(stock)
            except Exception as e:
                errors.append(f"{stock}: {str(e)}")
            
            # API 부하 방지
            await asyncio.sleep(0.5)
        
        # 점수순 정렬
        results.sort(key=lambda x: x.total_score, reverse=True)
        
        # 요약 통계
        buy_count = len([r for r in results if r.total_score >= 60])
        sell_count = len([r for r in results if r.total_score < 40])
        
        summary = {
            "total_analyzed": len(results),
            "failed": len(errors),
            "buy_signals": buy_count,
            "sell_signals": sell_count,
            "neutral_signals": len(results) - buy_count - sell_count,
            "avg_score": sum(r.total_score for r in results) / len(results) if results else 0,
            "errors": errors if errors else None
        }
        
        return BatchAnalyzeResponse(
            success=True,
            count=len(results),
            results=results,
            summary=summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def search_stock(query: str):
    """
    종목 검색
    
    - **query**: 검색어 (종목명 또는 종목코드)
    """
    try:
        crawler = NaverFinanceCrawler()
        code = await asyncio.to_thread(crawler.search_stock, query)
        
        if not code:
            return {"success": False, "results": [], "message": "검색 결과가 없습니다"}
        
        # 기본 정보 가져오기
        stock = await asyncio.to_thread(crawler.get_stock_info, code)
        
        return {
            "success": True,
            "results": [{
                "code": code,
                "name": stock.name or query,
                "current_price": stock.current_price,
                "market_cap": stock.market_cap
            }]
        }
        
    except Exception as e:
        return {"success": False, "results": [], "message": str(e)}

@app.get("/api/presets")
async def get_presets():
    """가중치 프리셋 목록"""
    return {
        "presets": [
            {"id": "default", "name": "기본값", "tech": 40, "fund": 60, "description": "일반 투자자용"},
            {"id": "trading", "name": "단기 트레이딩", "tech": 70, "fund": 30, "description": "단타/스윙용"},
            {"id": "value", "name": "가치투자", "tech": 30, "fund": 70, "description": "장기 투자자용"},
            {"id": "balanced", "name": "균형", "tech": 50, "fund": 50, "description": "밸런스형"},
        ]
    }

# ============================================================
# 실행
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
