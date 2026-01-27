"""
📊 주식 분석 모듈
=================
네이버금융 크롤러 + 기술적/펀더멘탈 분석기
"""

import requests
from bs4 import BeautifulSoup
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional
from datetime import datetime
import re
import time

# ============================================================
# 설정
# ============================================================

DEFAULT_WEIGHTS = {
    "technical": 0.40,
    "fundamental": 0.60
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ============================================================
# 데이터 클래스
# ============================================================

@dataclass
class Signal:
    """분석 신호"""
    indicator: str
    value: str
    sentiment: str
    
    def get_emoji(self) -> str:
        return {"bullish": "🟢", "bearish": "🔴", "neutral": "🟡"}[self.sentiment]

@dataclass
class StockData:
    """주식 데이터"""
    name: str = ""
    code: str = ""
    market: str = ""
    sector: str = ""
    
    current_price: float = 0
    prev_close: float = 0
    open_price: float = 0
    high_price: float = 0
    low_price: float = 0
    volume: int = 0
    market_cap: float = 0
    
    high_52w: float = 0
    low_52w: float = 0
    
    per: float = 0
    pbr: float = 0
    eps: float = 0
    bps: float = 0
    dividend_yield: float = 0
    
    sector_per: float = 0
    
    roe: float = 0
    debt_ratio: float = 0
    revenue_growth: float = 0
    op_growth: float = 0
    
    foreign_ratio: float = 0
    foreign_net: int = 0
    inst_net: int = 0

@dataclass  
class TechnicalData:
    """기술적 지표"""
    ma5: float = 0
    ma20: float = 0
    ma60: float = 0
    ma120: float = 0
    
    rsi_14: float = 50
    macd: float = 0
    macd_signal: float = 0
    stochastic_k: float = 50
    
    bb_upper: float = 0
    bb_middle: float = 0
    bb_lower: float = 0
    
    volume_ma20: float = 0
    
    prices: List[float] = field(default_factory=list)
    volumes: List[int] = field(default_factory=list)

# ============================================================
# 네이버금융 크롤러
# ============================================================

class NaverFinanceCrawler:
    """네이버금융 데이터 크롤러"""
    
    BASE_URL = "https://finance.naver.com"
    CHART_URL = "https://fchart.stock.naver.com/sise.nhn"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
    
    def search_stock(self, query: str) -> Optional[str]:
        """종목명으로 종목코드 검색"""
        if query.isdigit() and len(query) == 6:
            return query
        
        url = f"{self.BASE_URL}/search/searchList.naver?query={query}"
        try:
            resp = self.session.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            link = soup.select_one('a.tit')
            if link and 'href' in link.attrs:
                match = re.search(r'code=(\d{6})', link['href'])
                if match:
                    return match.group(1)
        except Exception as e:
            print(f"검색 오류: {e}")
        
        return None
    
    def get_stock_info(self, code: str) -> StockData:
        """주식 기본 정보 크롤링"""
        stock = StockData(code=code)

        # 1. 메인 페이지
        url = f"{self.BASE_URL}/item/main.naver?code={code}"
        try:
            resp = self.session.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')

            # 종목명
            name_tag = soup.select_one('div.wrap_company h2 a')
            if name_tag:
                stock.name = name_tag.text.strip()

            # 현재가
            price_tag = soup.select_one('p.no_today span.blind')
            if price_tag:
                stock.current_price = self._parse_number(price_tag.text)

            # 전일종가
            for tr in soup.select('table.no_info tr'):
                th = tr.select_one('th')
                td = tr.select_one('td')
                if th and td:
                    label = th.get_text(strip=True)
                    if '전일' in label:
                        stock.prev_close = self._parse_number(td.get_text())
                    elif '거래량' in label:
                        stock.volume = int(self._parse_number(td.get_text()))

            # 시가총액 - 새로운 방식
            market_cap_area = soup.select_one('div.first')
            if market_cap_area:
                text = market_cap_area.get_text()
                if '시가총액' in text:
                    # 시가총액 순위 앞의 숫자 찾기
                    match = re.search(r'시가총액[^\d]*([\d,]+)\s*(조|억)', text)
                    if match:
                        val = self._parse_number(match.group(1))
                        unit = match.group(2)
                        if unit == '조':
                            stock.market_cap = val * 1000000000000
                        else:
                            stock.market_cap = val * 100000000

            # 시가총액 대체 방식
            if stock.market_cap == 0:
                for em in soup.select('em'):
                    em_id = em.get('id', '')
                    if em_id == '_market_sum':
                        val = self._parse_number(em.get_text())
                        # 억 단위로 표시됨
                        stock.market_cap = val * 100000000
                        break

            # 52주 최고/최저 - 개선된 방식
            for table in soup.select('table'):
                rows = table.select('tr')
                for row in rows:
                    text = row.get_text()
                    if '52주' in text:
                        tds = row.select('td')
                        for td in tds:
                            td_text = td.get_text()
                            # "52주최고|558,000" 또는 "52주최저|312,500" 패턴
                            if '최고' in text:
                                spans = td.select('span.blind')
                                if spans:
                                    stock.high_52w = self._parse_number(spans[0].get_text())
                            if '최저' in text:
                                spans = td.select('span.blind')
                                if spans and len(spans) > 0:
                                    val = self._parse_number(spans[-1].get_text())
                                    if val > 0:
                                        stock.low_52w = val

            # 52주 고저 - 대체 방식 (sise_new 테이블)
            if stock.high_52w == 0 or stock.low_52w == 0:
                for td in soup.select('td'):
                    td_text = td.get_text()
                    if '52주최고' in td_text:
                        match = re.search(r'([\d,]+)', td_text.replace('52주최고', ''))
                        if match:
                            stock.high_52w = self._parse_number(match.group(1))
                    if '52주최저' in td_text:
                        match = re.search(r'([\d,]+)', td_text.replace('52주최저', ''))
                        if match:
                            stock.low_52w = self._parse_number(match.group(1))

            # PER, EPS, PBR, BPS - 개선
            per_table = soup.select_one('table.per_table')
            if per_table:
                tds = per_table.select('td em')
                values = [self._parse_number(em.get_text()) for em in tds]
                if len(values) >= 4:
                    stock.per = values[0] if values[0] > 0 else 0
                    stock.eps = values[1] if len(values) > 1 else 0
                    # 추정 PER/EPS와 실적 PBR/BPS 구분
                    if len(values) >= 6:
                        stock.pbr = values[4] if values[4] > 0 else (values[2] if values[2] > 0 else 0)
                        stock.bps = values[5] if len(values) > 5 else (values[3] if len(values) > 3 else 0)
                    else:
                        stock.pbr = values[2] if len(values) > 2 and values[2] > 0 else 0
                        stock.bps = values[3] if len(values) > 3 else 0

            # 외국인 지분율 - 개선
            foreign_area = soup.select_one('div.gray')
            if foreign_area:
                text = foreign_area.get_text()
                match = re.search(r'외국인[^\d]*([\d.]+)\s*%', text)
                if match:
                    stock.foreign_ratio = float(match.group(1))

            # 외국인 지분율 대체
            if stock.foreign_ratio == 0:
                for td in soup.select('td'):
                    td_text = td.get_text()
                    if '외국인' in td_text and '%' in td_text:
                        match = re.search(r'([\d.]+)\s*%', td_text)
                        if match:
                            val = float(match.group(1))
                            if 0 < val < 100:
                                stock.foreign_ratio = val
                                break

        except Exception as e:
            print(f"기본 정보 크롤링 오류: {e}")

        # 2. 시세 페이지 (추가 데이터)
        url = f"{self.BASE_URL}/item/sise.naver?code={code}"
        try:
            resp = self.session.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')

            # 전일종가 재확인
            if stock.prev_close == 0:
                for tr in soup.select('tr'):
                    th = tr.select_one('th, td.title')
                    if th and '전일' in th.get_text():
                        td = tr.select_one('td span.blind')
                        if td:
                            stock.prev_close = self._parse_number(td.get_text())
                            break

            # 거래량 재확인
            if stock.volume == 0:
                vol_td = soup.select_one('td#_quant')
                if vol_td:
                    stock.volume = int(self._parse_number(vol_td.get_text()))

            # 52주 고저 재확인
            for tr in soup.select('tr'):
                text = tr.get_text()
                if '52주' in text and '최고' in text:
                    spans = tr.select('span.blind')
                    if len(spans) >= 2:
                        if stock.high_52w == 0:
                            stock.high_52w = self._parse_number(spans[0].get_text())
                        if stock.low_52w == 0:
                            stock.low_52w = self._parse_number(spans[1].get_text())

        except Exception as e:
            pass

        # 3. 종목분석 페이지 (ROE, 추가 재무정보)
        url = f"{self.BASE_URL}/item/coinfo.naver?code={code}"
        try:
            resp = self.session.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'html.parser')

            # iframe 내 데이터는 직접 접근 불가, 대신 투자지표 탭 사용
        except Exception as e:
            pass

        # 4. 네이버 금융 모바일 API (추가 데이터)
        self._fetch_additional_data(stock, code)

        # 전일종가가 없으면 현재가로 대체
        if stock.prev_close == 0:
            stock.prev_close = stock.current_price

        return stock

    def _fetch_additional_data(self, stock: StockData, code: str):
        """추가 데이터 수집 (시가총액, 외국인, ROE 등) - 네이버 모바일 API 활용"""

        # 통합 투자지표 API (가장 완전한 데이터)
        try:
            url = f"https://m.stock.naver.com/api/stock/{code}/integration"
            resp = self.session.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json()

                if 'totalInfos' in data:
                    for info in data['totalInfos']:
                        key = info.get('key', '')
                        code_type = info.get('code', '')
                        value = info.get('value', '')

                        # 52주 최고
                        if code_type == 'highPriceOf52Weeks' or key == '52주 최고':
                            if stock.high_52w == 0:
                                stock.high_52w = self._parse_number(value)

                        # 52주 최저
                        elif code_type == 'lowPriceOf52Weeks' or key == '52주 최저':
                            if stock.low_52w == 0:
                                stock.low_52w = self._parse_number(value)

                        # 거래량
                        elif code_type == 'accumulatedTradingVolume' or key == '거래량':
                            if stock.volume == 0:
                                stock.volume = int(self._parse_number(value))

                        # 시가총액
                        elif code_type == 'marketValue' or key == '시총':
                            if stock.market_cap == 0:
                                # "16조 1,100억" 형태 파싱
                                jo_match = re.search(r'([\d,]+)\s*조', value)
                                eok_match = re.search(r'([\d,]+)\s*억', value)
                                total = 0
                                if jo_match:
                                    total += self._parse_number(jo_match.group(1)) * 1000000000000
                                if eok_match:
                                    total += self._parse_number(eok_match.group(1)) * 100000000
                                if total > 0:
                                    stock.market_cap = total

                        # 외국인 지분율
                        elif code_type == 'foreignRate' or '외인' in key:
                            if stock.foreign_ratio == 0:
                                stock.foreign_ratio = self._parse_number(value.replace('%', ''))

                        # ROE
                        elif code_type == 'roe' or key == 'ROE':
                            if stock.roe == 0:
                                stock.roe = self._parse_number(value.replace('%', ''))

                        # PER (백업)
                        elif code_type == 'per' or key == 'PER':
                            if stock.per == 0:
                                stock.per = self._parse_number(value.replace('배', ''))

                        # PBR (백업)
                        elif code_type == 'pbr' or key == 'PBR':
                            if stock.pbr == 0:
                                stock.pbr = self._parse_number(value.replace('배', ''))

        except Exception as e:
            pass

        # 재무정보 API (ROE 보완)
        if stock.roe == 0:
            try:
                url = f"https://m.stock.naver.com/api/stock/{code}/finance/annual"
                resp = self.session.get(url, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()

                    if 'financeInfos' in data:
                        for info in data['financeInfos']:
                            if info.get('key') == 'roe':
                                values = info.get('values', [])
                                if values:
                                    for v in reversed(values):
                                        if v and v != '-':
                                            stock.roe = self._parse_number(str(v))
                                            break

            except Exception as e:
                pass
    
    def get_price_data(self, code: str, count: int = 120) -> Tuple[List[float], List[int]]:
        """가격/거래량 히스토리"""
        prices = []
        volumes = []
        
        url = f"{self.CHART_URL}?symbol={code}&timeframe=day&count={count}&requestType=0"
        try:
            resp = self.session.get(url, timeout=10)
            soup = BeautifulSoup(resp.text, 'xml')
            
            items = soup.select('item')
            for item in items:
                data = item.get('data', '').split('|')
                if len(data) >= 5:
                    close = float(data[4])
                    vol = int(data[5]) if len(data) > 5 else 0
                    prices.append(close)
                    volumes.append(vol)
            
            prices.reverse()
            volumes.reverse()
            
        except Exception as e:
            print(f"가격 데이터 크롤링 오류: {e}")
        
        return prices, volumes
    
    def _parse_number(self, text: str) -> float:
        """문자열에서 숫자 추출"""
        if not text:
            return 0
        cleaned = re.sub(r'[^\d.\-]', '', text.replace(',', ''))
        try:
            return float(cleaned) if cleaned else 0
        except:
            return 0

# ============================================================
# 기술적 지표 계산기
# ============================================================

class TechnicalCalculator:
    """기술적 지표 계산"""
    
    @staticmethod
    def calculate_all(prices: List[float], volumes: List[int], current_price: float) -> TechnicalData:
        tech = TechnicalData()
        tech.prices = prices
        tech.volumes = volumes
        
        if len(prices) < 20:
            return tech
        
        prices_arr = np.array(prices)
        
        # 이동평균선
        tech.ma5 = float(np.mean(prices_arr[-5:])) if len(prices) >= 5 else current_price
        tech.ma20 = float(np.mean(prices_arr[-20:])) if len(prices) >= 20 else current_price
        tech.ma60 = float(np.mean(prices_arr[-60:])) if len(prices) >= 60 else current_price
        tech.ma120 = float(np.mean(prices_arr[-120:])) if len(prices) >= 120 else current_price
        
        # RSI
        tech.rsi_14 = TechnicalCalculator._calculate_rsi(prices_arr, 14)
        
        # MACD
        tech.macd, tech.macd_signal = TechnicalCalculator._calculate_macd(prices_arr)
        
        # 스토캐스틱
        tech.stochastic_k = TechnicalCalculator._calculate_stochastic(prices_arr, 14)
        
        # 볼린저밴드
        tech.bb_middle = tech.ma20
        std = float(np.std(prices_arr[-20:])) if len(prices) >= 20 else 0
        tech.bb_upper = tech.bb_middle + (std * 2)
        tech.bb_lower = tech.bb_middle - (std * 2)
        
        # 거래량 MA
        if volumes and len(volumes) >= 20:
            tech.volume_ma20 = float(np.mean(volumes[-20:]))
        
        return tech
    
    @staticmethod
    def _calculate_rsi(prices: np.ndarray, period: int = 14) -> float:
        if len(prices) < period + 1:
            return 50
        
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        
        if avg_loss == 0:
            return 100
        
        rs = avg_gain / avg_loss
        return float(100 - (100 / (1 + rs)))
    
    @staticmethod
    def _calculate_macd(prices: np.ndarray) -> Tuple[float, float]:
        if len(prices) < 26:
            return 0, 0
        
        ema12 = TechnicalCalculator._ema(prices, 12)
        ema26 = TechnicalCalculator._ema(prices, 26)
        macd_line = ema12 - ema26
        
        signal = macd_line * 0.8
        
        return float(macd_line), float(signal)
    
    @staticmethod
    def _ema(prices: np.ndarray, period: int) -> float:
        if len(prices) < period:
            return float(prices[-1]) if len(prices) > 0 else 0
        
        multiplier = 2 / (period + 1)
        ema = float(prices[-period])
        
        for price in prices[-period+1:]:
            ema = (float(price) * multiplier) + (ema * (1 - multiplier))
        
        return ema
    
    @staticmethod
    def _calculate_stochastic(prices: np.ndarray, period: int = 14) -> float:
        if len(prices) < period:
            return 50
        
        recent = prices[-period:]
        high = float(np.max(recent))
        low = float(np.min(recent))
        close = float(prices[-1])
        
        if high == low:
            return 50
        
        return float(((close - low) / (high - low)) * 100)

# ============================================================
# 분석기
# ============================================================

class StockAnalyzer:
    """주식 종합 분석기"""
    
    def __init__(self, weights: Dict[str, float] = None):
        self.weights = weights or DEFAULT_WEIGHTS.copy()
        self.crawler = NaverFinanceCrawler()
    
    def set_weights(self, technical: float, fundamental: float):
        total = technical + fundamental
        self.weights["technical"] = technical / total
        self.weights["fundamental"] = fundamental / total
    
    def analyze(self, code_or_name: str) -> Optional[Dict]:
        """종목 분석"""
        # 종목코드 확인
        code = self.crawler.search_stock(code_or_name)
        if not code:
            return None
        
        # 기본 정보
        stock = self.crawler.get_stock_info(code)
        if not stock.name and not stock.current_price:
            return None
        
        # 가격 데이터
        prices, volumes = self.crawler.get_price_data(code, 120)
        
        # 기술적 지표
        tech = TechnicalCalculator.calculate_all(prices, volumes, stock.current_price)
        
        # 분석
        tech_signals = self._analyze_technical(stock, tech)
        fund_signals = self._analyze_fundamental(stock)
        
        # 점수
        tech_score = self._calculate_score(tech_signals)
        fund_score = self._calculate_score(fund_signals)
        total_score = (tech_score * self.weights["technical"] + 
                      fund_score * self.weights["fundamental"])
        
        recommendation, _ = self._get_recommendation(total_score)
        
        return {
            "code": code,
            "name": stock.name or code_or_name,
            "date": datetime.now().isoformat(),
            "current_price": stock.current_price,
            "prev_close": stock.prev_close,
            "change_pct": ((stock.current_price / stock.prev_close) - 1) * 100 if stock.prev_close else 0,
            "technical_score": tech_score,
            "fundamental_score": fund_score,
            "total_score": total_score,
            "recommendation": recommendation,
            "weights": self.weights.copy(),
            "technical_signals": [
                {"indicator": s.indicator, "value": s.value, "sentiment": s.sentiment}
                for s in tech_signals
            ],
            "fundamental_signals": [
                {"indicator": s.indicator, "value": s.value, "sentiment": s.sentiment}
                for s in fund_signals
            ],
            "stock_data": {
                "per": stock.per,
                "pbr": stock.pbr,
                "eps": stock.eps,
                "roe": stock.roe,
                "high_52w": stock.high_52w,
                "low_52w": stock.low_52w,
                "market_cap": stock.market_cap,
                "volume": stock.volume,
                "foreign_ratio": stock.foreign_ratio,
            }
        }
    
    def _analyze_technical(self, stock: StockData, tech: TechnicalData) -> List[Signal]:
        signals = []
        price = stock.current_price
        
        if price == 0:
            return signals
        
        # 이동평균선 배열
        if tech.ma5 > 0 and tech.ma20 > 0 and tech.ma60 > 0:
            if tech.ma5 > tech.ma20 > tech.ma60:
                signals.append(Signal("이동평균선 배열", "정배열 (상승추세)", "bullish"))
            elif tech.ma5 < tech.ma20 < tech.ma60:
                signals.append(Signal("이동평균선 배열", "역배열 (하락추세)", "bearish"))
            else:
                signals.append(Signal("이동평균선 배열", "혼조세", "neutral"))
        
        # 20일선 대비
        if tech.ma20 > 0:
            ma20_diff = ((price / tech.ma20) - 1) * 100
            if price > tech.ma20:
                signals.append(Signal("20일선 대비", f"상회 (+{ma20_diff:.1f}%)", "bullish"))
            else:
                signals.append(Signal("20일선 대비", f"하회 ({ma20_diff:.1f}%)", "bearish"))
        
        # RSI
        rsi = tech.rsi_14
        if rsi >= 70:
            signals.append(Signal("RSI", f"{rsi:.0f} (과매수)", "bearish"))
        elif rsi <= 30:
            signals.append(Signal("RSI", f"{rsi:.0f} (과매도)", "bullish"))
        else:
            signals.append(Signal("RSI", f"{rsi:.0f} (중립)", "neutral"))
        
        # MACD
        if tech.macd > tech.macd_signal:
            signals.append(Signal("MACD", "매수 신호", "bullish"))
        else:
            signals.append(Signal("MACD", "매도 신호", "bearish"))
        
        # 볼린저밴드
        if tech.bb_upper > 0 and tech.bb_lower > 0:
            if price >= tech.bb_upper:
                signals.append(Signal("볼린저밴드", "상단 돌파 (과열)", "bearish"))
            elif price <= tech.bb_lower:
                signals.append(Signal("볼린저밴드", "하단 이탈 (과매도)", "bullish"))
            else:
                bb_pos = (price - tech.bb_lower) / (tech.bb_upper - tech.bb_lower) * 100
                signals.append(Signal("볼린저밴드", f"밴드 내 {bb_pos:.0f}% 위치", "neutral"))
        
        # 스토캐스틱
        stoch = tech.stochastic_k
        if stoch > 80:
            signals.append(Signal("스토캐스틱", f"K:{stoch:.0f} (과매수)", "bearish"))
        elif stoch < 20:
            signals.append(Signal("스토캐스틱", f"K:{stoch:.0f} (과매도)", "bullish"))
        else:
            signals.append(Signal("스토캐스틱", f"K:{stoch:.0f} (중립)", "neutral"))
        
        # 거래량
        if tech.volume_ma20 > 0 and stock.volume > 0:
            vol_ratio = stock.volume / tech.volume_ma20
            if vol_ratio > 3:
                signals.append(Signal("거래량", f"평균 대비 {vol_ratio:.1f}배 (급증)", "bullish"))
            elif vol_ratio > 1.5:
                signals.append(Signal("거래량", f"평균 대비 {vol_ratio:.1f}배 (증가)", "bullish"))
            elif vol_ratio < 0.5:
                signals.append(Signal("거래량", f"평균 대비 {vol_ratio:.1f}배 (급감)", "bearish"))
            else:
                signals.append(Signal("거래량", f"평균 대비 {vol_ratio:.1f}배", "neutral"))
        
        return signals
    
    def _analyze_fundamental(self, stock: StockData) -> List[Signal]:
        signals = []
        
        # PER
        if stock.per > 0:
            if stock.per < 10:
                signals.append(Signal("PER", f"{stock.per:.1f}배 (저평가)", "bullish"))
            elif stock.per < 20:
                signals.append(Signal("PER", f"{stock.per:.1f}배 (적정)", "neutral"))
            elif stock.per < 30:
                signals.append(Signal("PER", f"{stock.per:.1f}배 (다소 고평가)", "neutral"))
            else:
                signals.append(Signal("PER", f"{stock.per:.1f}배 (고평가)", "bearish"))
        
        # PBR
        if stock.pbr > 0:
            if stock.pbr < 1:
                signals.append(Signal("PBR", f"{stock.pbr:.2f}배 (자산가치 대비 저평가)", "bullish"))
            elif stock.pbr < 2:
                signals.append(Signal("PBR", f"{stock.pbr:.2f}배 (적정)", "neutral"))
            else:
                signals.append(Signal("PBR", f"{stock.pbr:.2f}배 (고평가)", "bearish"))
        
        # ROE
        if stock.roe > 0:
            if stock.roe > 15:
                signals.append(Signal("ROE", f"{stock.roe:.1f}% (우수)", "bullish"))
            elif stock.roe > 10:
                signals.append(Signal("ROE", f"{stock.roe:.1f}% (양호)", "neutral"))
            else:
                signals.append(Signal("ROE", f"{stock.roe:.1f}% (미흡)", "bearish"))
        
        # 52주 위치
        if stock.high_52w > 0 and stock.low_52w > 0 and stock.current_price > 0:
            high_52 = max(stock.high_52w, stock.current_price)
            low_52 = stock.low_52w
            if high_52 > low_52:
                position = (stock.current_price - low_52) / (high_52 - low_52) * 100
                
                if position > 90:
                    signals.append(Signal("52주 위치", f"{position:.0f}% (신고가 근처)", "neutral"))
                elif position > 70:
                    signals.append(Signal("52주 위치", f"{position:.0f}% (고점 근처)", "bearish"))
                elif position < 30:
                    signals.append(Signal("52주 위치", f"{position:.0f}% (저점 근처)", "bullish"))
                else:
                    signals.append(Signal("52주 위치", f"{position:.0f}%", "neutral"))
        
        # 외국인 지분율
        if stock.foreign_ratio > 0:
            if stock.foreign_ratio > 30:
                signals.append(Signal("외국인 지분율", f"{stock.foreign_ratio:.1f}% (높음)", "bullish"))
            elif stock.foreign_ratio > 10:
                signals.append(Signal("외국인 지분율", f"{stock.foreign_ratio:.1f}% (보통)", "neutral"))
            else:
                signals.append(Signal("외국인 지분율", f"{stock.foreign_ratio:.1f}% (낮음)", "neutral"))
        
        # 시가총액
        if stock.market_cap > 0:
            cap_billion = stock.market_cap / 100000000
            if cap_billion > 100000:
                signals.append(Signal("시가총액", f"{cap_billion/10000:.1f}조 (대형주)", "bullish"))
            elif cap_billion > 10000:
                signals.append(Signal("시가총액", f"{cap_billion/10000:.1f}조 (중대형주)", "neutral"))
            elif cap_billion > 3000:
                signals.append(Signal("시가총액", f"{cap_billion:.0f}억 (중형주)", "neutral"))
            else:
                signals.append(Signal("시가총액", f"{cap_billion:.0f}억 (소형주)", "bearish"))
        
        return signals
    
    def _calculate_score(self, signals: List[Signal]) -> float:
        if not signals:
            return 50
        
        score_map = {"bullish": 100, "neutral": 50, "bearish": 0}
        total = sum(score_map[s.sentiment] for s in signals)
        return total / len(signals)
    
    def _get_recommendation(self, score: float) -> Tuple[str, str]:
        if score >= 75:
            return "적극 매수", "🟢🟢🟢"
        elif score >= 60:
            return "매수", "🟢🟢"
        elif score >= 45:
            return "중립", "🟡"
        elif score >= 30:
            return "매도", "🔴🔴"
        else:
            return "적극 매도", "🔴🔴🔴"
