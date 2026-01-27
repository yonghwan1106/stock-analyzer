# 📊 주식 종합 분석 시스템 v2.1

네이버금융 실시간 데이터 기반 기술적/펀더멘탈 분석 웹 서비스

## ✨ 주요 기능

- **단일/일괄 종목 분석**: 최대 20개 종목 동시 분석
- **포트폴리오 관리**: 관심종목 등록, 분석 히스토리 조회
- **주식 유형별 맞춤 분석**: 성장주/가치주/배당주 차별화된 기준 적용
- **가중치 조절**: 기술적/펀더멘탈 비중 커스텀 설정
- **추세 추종 로직**: 52주 신고가 = 상승추세(bullish)

## 📁 프로젝트 구조

```
stock-analyzer/
├── api/                    # Railway 배포용 백엔드
│   ├── main.py            # FastAPI 서버
│   ├── analyzer.py        # 크롤러 + 분석 로직
│   ├── supabase_client.py # Supabase 연동 (포트폴리오)
│   ├── requirements.txt   # Python 의존성
│   └── railway.json       # Railway 설정
│
└── web/                    # Vercel 배포용 프론트엔드
    ├── app/
    │   ├── page.tsx       # 메인 분석 페이지
    │   ├── portfolio/
    │   │   └── page.tsx   # 포트폴리오 페이지
    │   ├── layout.tsx
    │   └── globals.css
    ├── package.json
    └── next.config.js
```

## 🚀 배포

### 백엔드 (Railway)

```bash
cd api
railway login
railway link    # 기존 프로젝트 연결
railway up      # 배포
```

**환경변수 (Railway)**:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...
```

### 프론트엔드 (Vercel)

```bash
cd web
vercel --prod
```

**환경변수 (Vercel)**:
```
NEXT_PUBLIC_API_URL=https://stock-analyzer-production-4f9c.up.railway.app
```

## 💻 로컬 개발

### 백엔드
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드
```bash
cd web
npm install
npm run dev
```

브라우저: http://localhost:3000

## 📊 분석 알고리즘

### 주식 유형 분류

| 유형 | 조건 | PER 평가 기준 |
|------|------|--------------|
| 성장주 | PER > 25 AND ROE > 12% | 50배 미만 neutral, 80+ bearish |
| 가치주 | PER < 15 AND PBR < 1.5 | 20배 이상 bearish |
| 배당주 | 배당수익률 > 3% | 일반 기준 적용 |
| 균형형 | 그 외 | 35배 이상 bearish |

### 52주 위치 (추세 추종)

| 위치 | 신호 | 의미 |
|------|------|------|
| 95%+ | 🟢 bullish | 신고가 돌파 |
| 85-95% | 🟢 bullish | 강한 상승추세 |
| 70-85% | 🟡 neutral | 상승추세 |
| 30-70% | 🟡 neutral | 횡보 |
| 20% 미만 | 🔴 bearish | 하락추세 |

### 지표별 가중치

```
핵심 지표 (2.0배): PER, ROE
주요 지표 (1.5배): 이동평균선 배열, 52주 위치
보조 지표 (0.5~1.0배): 시가총액, 외국인 지분율
```

## 🔧 기술적 지표 (7개)

- 이동평균선 배열 (5/20/60일)
- 20일선 대비 위치
- RSI (14일)
- MACD
- 볼린저밴드
- 스토캐스틱
- 거래량 분석

## 📈 펀더멘탈 지표 (6개)

- PER (주식 유형별 차별화)
- PBR
- ROE
- 52주 위치
- 외국인 지분율
- 시가총액

## 🗄️ API 엔드포인트

### 분석
- `POST /api/analyze` - 단일 종목 분석
- `POST /api/analyze/batch` - 일괄 분석 (최대 20개)
- `GET /api/search?q={query}` - 종목 검색
- `GET /api/presets` - 가중치 프리셋

### 포트폴리오
- `GET /api/watchlist` - 관심종목 목록
- `POST /api/watchlist` - 관심종목 추가
- `DELETE /api/watchlist/{code}` - 관심종목 삭제
- `GET /api/history` - 분석 히스토리

## 💰 예상 비용

- Railway Hobby: $5/월
- Vercel Pro: 기존 플랜에 포함
- Supabase Free: 무료 (500MB)

## ⚠️ 주의사항

- 본 분석은 참고용이며, 투자 결정은 본인 판단 하에 하시기 바랍니다
- 네이버금융 크롤링 기반으로, 접속 제한 시 오류 발생 가능
- 실시간 데이터가 아닌 지연 데이터일 수 있습니다

## 📝 라이선스

MIT License

---

🤖 Generated with [Claude Code](https://claude.ai/code)
