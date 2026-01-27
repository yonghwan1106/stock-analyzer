'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import './globals.css'
import { BarChart3, Briefcase, History, TrendingUp } from 'lucide-react'

const navItems = [
  { href: '/', label: '분석', icon: BarChart3 },
  { href: '/portfolio', label: '내 종목', icon: Briefcase },
  { href: '/history', label: '히스토리', icon: History },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <html lang="ko">
      <head>
        <title>Stock Terminal | 주식 종합 분석 시스템</title>
        <meta name="description" content="네이버금융 기반 기술적/펀더멘탈 분석 도구" />
      </head>
      <body>
        <div className="min-h-screen flex flex-col relative z-10">
          {/* Header */}
          <header className="sticky top-0 z-50 glass-card border-t-0 border-x-0 rounded-none">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg group-hover:shadow-amber-500/30 transition-shadow">
                    <TrendingUp className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <h1 className="font-display text-lg font-semibold text-amber-400 tracking-tight">
                      STOCK TERMINAL
                    </h1>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wider">
                      NAVER FINANCE DATA
                    </p>
                  </div>
                </Link>

                {/* Navigation */}
                <nav className="flex items-center gap-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{item.label}</span>
                      </Link>
                    )
                  })}
                </nav>

                {/* Version Badge */}
                <div className="hidden md:flex items-center gap-2">
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-mono rounded border border-emerald-500/30">
                    v2.0
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/50 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-slate-500 font-mono">
                  ⚠ 본 분석은 참고용이며, 투자 결정은 본인 책임입니다
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="font-mono">DATA: NAVER FINANCE</span>
                  <span className="w-1 h-1 bg-slate-600 rounded-full" />
                  <span className="font-mono">DB: SUPABASE</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
