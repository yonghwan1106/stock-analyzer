# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean stock analysis web service using Naver Finance real-time data. Monorepo with separate backend (FastAPI) and frontend (Next.js) deployments.

## Architecture

```
stock-analyzer/
├── api/          # FastAPI backend (Railway deployment)
└── web/          # Next.js frontend (Vercel deployment)
```

**Backend (api/)**: FastAPI server with two main modules:
- `main.py` - API endpoints and Pydantic models
- `analyzer.py` - `NaverFinanceCrawler` (web scraping) + `StockAnalyzer` (technical/fundamental analysis) + `TechnicalCalculator` (RSI, MACD, Bollinger Bands, etc.)

**Frontend (web/)**: Next.js 14 App Router with single page (`app/page.tsx`) containing all UI logic. Uses Tailwind CSS and lucide-react icons.

**Data Flow**: Frontend calls backend API → Backend crawls Naver Finance → Calculates technical indicators (MA, RSI, MACD, Stochastic, Bollinger) and fundamental metrics (PER, PBR, ROE) → Returns scored analysis with buy/sell recommendation.

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

- `POST /api/analyze` - Single stock analysis (stock code or name)
- `POST /api/analyze/batch` - Batch analysis (up to 20 stocks)
- `GET /api/search` - Stock search by name
- `GET /api/presets` - Weight presets list

## Environment Variables

Frontend requires `NEXT_PUBLIC_API_URL` pointing to the backend URL.

## Key Implementation Details

- Stock codes are 6-digit strings (e.g., "005930" for Samsung Electronics)
- Crawler uses User-Agent spoofing for Naver Finance access
- Technical analysis requires minimum 20 days of price history
- Scoring: bullish=100, neutral=50, bearish=0, weighted average by signal count
- Total score = (technical_score * tech_weight) + (fundamental_score * fund_weight)
