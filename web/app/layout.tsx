import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '📊 주식 종합 분석 시스템',
  description: '네이버금융 기반 기술적/펀더멘탈 분석 도구',
  keywords: ['주식', '분석', '기술적분석', '펀더멘탈', 'PER', 'RSI', 'MACD'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <div className="min-h-screen">
          {/* 헤더 */}
          <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📊</span>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                    주식 종합 분석 시스템
                  </h1>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    v2.0
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  네이버금융 실시간 데이터
                </div>
              </div>
            </div>
          </header>
          
          {/* 메인 콘텐츠 */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          
          {/* 푸터 */}
          <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                ⚠️ 본 분석은 참고용이며, 투자 결정은 본인 판단 하에 하시기 바랍니다.
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
