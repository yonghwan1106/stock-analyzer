"""
Supabase 클라이언트 모듈
========================
분석 결과 저장 및 관심종목 관리
"""

import os
from typing import Optional, List, Dict, Any
from datetime import datetime
from supabase import create_client, Client

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://imudgfxnijxdonrvsbbj.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltdWRnZnhuaWp4ZG9ucnZzYmJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTE4MjUsImV4cCI6MjA4NTA2NzgyNX0.7ZSeLNPdrOVcu-jAYteGNxbYt0QOueC8reGzqu5Soo4")

# 클라이언트 초기화
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


class SupabaseService:
    """Supabase 서비스 클래스"""

    # ============================================================
    # 분석 결과 저장/조회
    # ============================================================

    @staticmethod
    def save_analysis_result(result: Dict[str, Any]) -> Optional[Dict]:
        """분석 결과를 Supabase에 저장"""
        try:
            data = {
                "stock_code": result.get("code", ""),
                "stock_name": result.get("name", ""),
                "market": result.get("market"),
                "current_price": result.get("current_price"),
                "price_change": result.get("price_change"),
                "price_change_percent": result.get("change_pct"),
                "technical_score": result.get("technical_score"),
                "technical_signals": result.get("technical_signals", []),
                "fundamental_score": result.get("fundamental_score"),
                "fundamental_metrics": result.get("stock_data", {}),
                "total_score": result.get("total_score"),
                "recommendation": result.get("recommendation"),
                "tech_weight": result.get("weights", {}).get("technical", 0.7),
                "fund_weight": result.get("weights", {}).get("fundamental", 0.3),
                "analyzed_at": datetime.now().isoformat()
            }

            response = supabase.table("sa_analysis_results").insert(data).execute()
            return response.data[0] if response.data else None

        except Exception as e:
            print(f"[Supabase] 분석 결과 저장 실패: {e}")
            return None

    @staticmethod
    def get_analysis_history(
        stock_code: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """분석 히스토리 조회"""
        try:
            query = supabase.table("sa_analysis_results").select("*")

            if stock_code:
                query = query.eq("stock_code", stock_code)

            query = query.order("analyzed_at", desc=True).limit(limit)
            response = query.execute()

            return response.data or []

        except Exception as e:
            print(f"[Supabase] 히스토리 조회 실패: {e}")
            return []

    # ============================================================
    # 관심종목(Watchlist) 관리
    # ============================================================

    @staticmethod
    def add_to_watchlist(
        stock_code: str,
        stock_name: str,
        market: Optional[str] = None,
        buy_price: Optional[int] = None,
        buy_quantity: Optional[int] = None,
        buy_date: Optional[str] = None,
        memo: Optional[str] = None
    ) -> Optional[Dict]:
        """관심종목 추가"""
        try:
            data = {
                "stock_code": stock_code,
                "stock_name": stock_name,
                "market": market,
                "buy_price": buy_price,
                "buy_quantity": buy_quantity,
                "buy_date": buy_date,
                "memo": memo
            }

            # upsert로 중복 시 업데이트
            response = supabase.table("sa_watchlist").upsert(
                data,
                on_conflict="stock_code"
            ).execute()

            return response.data[0] if response.data else None

        except Exception as e:
            print(f"[Supabase] 관심종목 추가 실패: {e}")
            return None

    @staticmethod
    def get_watchlist() -> List[Dict]:
        """관심종목 목록 조회"""
        try:
            response = supabase.table("sa_watchlist")\
                .select("*")\
                .order("created_at", desc=True)\
                .execute()

            return response.data or []

        except Exception as e:
            print(f"[Supabase] 관심종목 조회 실패: {e}")
            return []

    @staticmethod
    def update_watchlist_item(
        stock_code: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict]:
        """관심종목 정보 수정"""
        try:
            updates["updated_at"] = datetime.now().isoformat()

            response = supabase.table("sa_watchlist")\
                .update(updates)\
                .eq("stock_code", stock_code)\
                .execute()

            return response.data[0] if response.data else None

        except Exception as e:
            print(f"[Supabase] 관심종목 수정 실패: {e}")
            return None

    @staticmethod
    def remove_from_watchlist(stock_code: str) -> bool:
        """관심종목에서 제거"""
        try:
            supabase.table("sa_watchlist")\
                .delete()\
                .eq("stock_code", stock_code)\
                .execute()

            return True

        except Exception as e:
            print(f"[Supabase] 관심종목 삭제 실패: {e}")
            return False

    @staticmethod
    def is_in_watchlist(stock_code: str) -> bool:
        """관심종목 여부 확인"""
        try:
            response = supabase.table("sa_watchlist")\
                .select("id")\
                .eq("stock_code", stock_code)\
                .execute()

            return len(response.data) > 0

        except Exception as e:
            return False
