# 📊 주식 종합 분석 시스템 v2.0

네이버금융 실시간 데이터 기반 기술적/펀더멘탈 분석 웹 서비스

## 📁 프로젝트 구조

```
stock-analyzer/
├── api/                    # Railway 배포용 백엔드
│   ├── main.py            # FastAPI 서버
│   ├── analyzer.py        # 크롤러 + 분석 로직
│   ├── requirements.txt   # Python 의존성
│   ├── Procfile          # Railway 실행 명령
│   └── railway.json      # Railway 설정
│
└── web/                    # Vercel 배포용 프론트엔드
    ├── app/
    │   ├── page.tsx       # 메인 페이지
    │   ├── layout.tsx     # 레이아웃
    │   └── globals.css    # 스타일
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    └── .env.example
```

## 🚀 배포 방법

### 1단계: Railway 백엔드 배포

**방법 A: GitHub 연동 (권장)**
```bash
# 1. api 폴더를 GitHub 저장소로 푸시
cd api
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/stock-analyzer-api.git
git push -u origin main

# 2. Railway 대시보드에서
# - New Project → Deploy from GitHub repo
# - 저장소 선택 후 자동 배포
```

**방법 B: Railway CLI**
```bash
cd api
npm install -g @railway/cli
railway login
railway init
railway up
```

배포 완료 후 Railway URL 복사 (예: `https://stock-analyzer-api-xxx.railway.app`)

### 2단계: Vercel 프론트엔드 배포

**방법 A: Vercel CLI**
```bash
cd web
npm install
npm install -g vercel
vercel --prod
```

**방법 B: GitHub 연동**
1. web 폴더를 GitHub에 푸시
2. Vercel 대시보드에서 Import
3. 환경변수 설정 후 배포

### 3단계: 환경변수 설정 (필수!)

Vercel 프로젝트 Settings → Environment Variables:
```
NEXT_PUBLIC_API_URL = https://your-railway-app.railway.app
```

## 💻 로컬 개발

### 백엔드 실행
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드 실행
```bash
cd web
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 🔧 주요 기능

- **단일 종목 분석**: 종목코드/종목명 입력 → 실시간 분석
- **일괄 분석**: 최대 20개 종목 동시 분석, 점수순 정렬
- **가중치 조절**: 기술적/펀더멘탈 비중 슬라이더로 조절
- **프리셋**: 기본값, 단기 트레이딩, 가치투자, 균형
- **JSON 다운로드**: 분석 결과 파일 저장

## 📊 분석 지표

**기술적 분석 (7개)**
- 이동평균선 배열 (5/20/60일)
- 20일선 대비 위치
- RSI (14일)
- MACD
- 볼린저밴드
- 스토캐스틱
- 거래량 분석

**펀더멘탈 분석 (6개)**
- PER
- PBR
- ROE
- 52주 위치
- 외국인 지분율
- 시가총액

## 💰 예상 비용

- Railway Hobby: $5/월
- Vercel Pro: 기존 플랜에 포함

## ⚠️ 주의사항

- 본 분석은 참고용이며, 투자 결정은 본인 판단 하에 하시기 바랍니다
- 네이버금융 크롤링 기반으로, 접속 제한 시 오류 발생 가능
