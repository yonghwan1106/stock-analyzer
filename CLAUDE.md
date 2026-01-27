# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean stock analysis web service using Naver Finance real-time data. Monorepo with separate backend (FastAPI) and frontend (Next.js) deployments. Includes Supabase integration for portfolio management and analysis history.

## Architecture

```
stock-analyzer/
├── api/                    # FastAPI backend (Railway deployment)
│   ├── main.py            # API endpoints and Pydantic models
│   ├── analyzer.py        # NaverFinanceCrawler + StockAnalyzer + TechnicalCalculator
│   ├── supabase_client.py # Supabase integration (watchlist, history)
│   ├── requirements.txt
│   └── railway.json
│
└── web/                    # Next.js frontend (Vercel deployment)
    └── app/
        ├── page.tsx       # Main analysis page
        ├── portfolio/
        │   └── page.tsx   # Portfolio management page
        ├── layout.tsx
        └── globals.css
```

**Backend (api/)**: FastAPI server with three main modules:
- `main.py` - API endpoints and Pydantic models
- `analyzer.py` - `NaverFinanceCrawler` (web scraping) + `StockAnalyzer` (technical/fundamental analysis) + `TechnicalCalculator` (RSI, MACD, Bollinger Bands, etc.)
- `supabase_client.py` - Supabase integration for watchlist and analysis history

**Frontend (web/)**: Next.js 14 App Router with two pages:
- `app/page.tsx` - Main analysis page (single/batch analysis)
- `app/portfolio/page.tsx` - Portfolio management (watchlist, history)

**Data Flow**: Frontend calls backend API → Backend crawls Naver Finance → Calculates technical indicators and fundamental metrics → Returns scored analysis with buy/sell recommendation → Optionally saves to Supabase.

## Development Commands

### Backend (api/)
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (web/)
```bash
cd web
npm install
npm run dev          # Development server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
```

## API Endpoints

### Analysis
- `POST /api/analyze` - Single stock analysis (stock code or name)
- `POST /api/analyze/batch` - Batch analysis (up to 20 stocks)
- `GET /api/search` - Stock search by name
- `GET /api/presets` - Weight presets list

### Portfolio (Supabase)
- `GET /api/watchlist` - Get watchlist
- `POST /api/watchlist` - Add to watchlist
- `DELETE /api/watchlist/{code}` - Remove from watchlist
- `GET /api/watchlist/{code}/check` - Check if in watchlist
- `GET /api/history` - Get analysis history

## Environment Variables

**Frontend (Vercel)**:
- `NEXT_PUBLIC_API_URL` - Backend API URL

**Backend (Railway)**:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anon key

## Key Implementation Details

### Stock Type Classification
Stocks are classified into types for differentiated PER evaluation:
- **Growth (성장주)**: PER > 25 AND ROE > 12% - Higher PER tolerance
- **Value (가치주)**: PER < 15 AND PBR < 1.5 - Strict PER evaluation
- **Dividend (배당주)**: Dividend yield > 3%
- **Balanced (균형형)**: Default type

### Signal Weights
Core indicators have higher weights in score calculation:
```python
SIGNAL_WEIGHTS = {
    "PER": 2.0,              # Core
    "ROE": 2.0,              # Core
    "이동평균선 배열": 1.5,
    "52주 위치": 1.5,
    "외국인 지분율": 0.8,    # Reference
    "시가총액": 0.5,         # Reference
}
```

### 52-Week Position (Trend Following)
- 95%+ (new high): **bullish** - Strong uptrend
- 85-95%: **bullish** - Uptrend
- 70-85%: **neutral** - Consolidation
- 30-70%: **neutral** - Sideways
- Below 20%: **bearish** - Downtrend

### Scoring
- Signal scores: bullish=100, neutral=50, bearish=0
- Weighted average calculation using SIGNAL_WEIGHTS
- Total score = (technical_score * tech_weight) + (fundamental_score * fund_weight)

### Data Crawling
- Stock codes are 6-digit strings (e.g., "005930" for Samsung Electronics)
- Crawler uses User-Agent spoofing for Naver Finance access
- ROE extracted from main page table (tb_type1)
- Technical analysis requires minimum 20 days of price history

## Supabase Schema

```sql
-- Watchlist table
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    stock_code VARCHAR(10) NOT NULL UNIQUE,
    stock_name VARCHAR(100),
    added_at TIMESTAMP DEFAULT NOW()
);

-- Analysis history table
CREATE TABLE analysis_history (
    id SERIAL PRIMARY KEY,
    stock_code VARCHAR(10) NOT NULL,
    stock_name VARCHAR(100),
    current_price INTEGER,
    total_score DECIMAL(5,2),
    recommendation VARCHAR(50),
    analyzed_at TIMESTAMP DEFAULT NOW()
);
```

## Deployment URLs

- **Backend (Railway)**: `https://stock-analyzer-production-4f9c.up.railway.app`
- **Frontend (Vercel)**: Configured in Vercel dashboard
