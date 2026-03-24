"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import ReactMarkdown from "react-markdown"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAnalysis } from "@/lib/analysis-context"
import MarketCharts from "@/components/analysis/MarketCharts"
import ChatPanel from "@/components/analysis/ChatPanel"

export default function AnalysisDashboard() {
  const { analysis } = useAnalysis()
  const router = useRouter()

  const refs = useMemo(() => analysis?.report.references ?? [], [analysis])

  if (!analysis) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4">
        <Card className="p-6">
          <CardHeader>
            <CardTitle>분석 결과가 없습니다.</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">먼저 홈에서 입력 후 분석 리포트를 생성해 주세요.</p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => router.push("/")}>
                홈으로
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">분석 리포트</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            요청 ID: {analysis.requestId.slice(0, 12)} / 업데이트: {new Date(analysis.updatedAtIso).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          새 분석 시작
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex-1 space-y-4 md:pr-4">
          <MarketCharts charts={analysis.charts} />

          <Card>
            <CardHeader>
              <CardTitle>기업 분석 리포트 (APA 7th)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2 text-sm leading-relaxed">
                <ReactMarkdown>{analysis.report.body}</ReactMarkdown>
              </div>

              <div>
                <div className="mb-2 text-sm font-semibold">참고문헌(References)</div>
                <ol className="space-y-2 pl-5 text-sm text-muted-foreground">
                  {refs.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ol>
              </div>

              {analysis.evidence ? (
                <div>
                  <div className="mb-2 text-sm font-semibold">수집 근거(Evidence)</div>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <div>
                      <div className="mb-1 text-xs font-semibold">네이버 뉴스</div>
                      <ul className="space-y-1 pl-5 list-disc">
                        {analysis.evidence.naverNewsSnippets.slice(0, 5).map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold">DART 공시</div>
                      <ul className="space-y-1 pl-5 list-disc">
                        {analysis.evidence.dartSnippets.slice(0, 5).map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold">RSS/시장</div>
                      <ul className="space-y-1 pl-5 list-disc">
                        {analysis.evidence.rssSnippets.slice(0, 5).map((s, idx) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>커리어 로드맵</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="text-sm font-semibold">단기</div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {analysis.careerRoadmap.shortTerm.map((t, idx) => (
                      <li key={idx} className="list-disc pl-5">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">중기</div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {analysis.careerRoadmap.midTerm.map((t, idx) => (
                      <li key={idx} className="list-disc pl-5">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold">장기</div>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {analysis.careerRoadmap.longTerm.map((t, idx) => (
                      <li key={idx} className="list-disc pl-5">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="w-full md:w-96">
          <ChatPanel />
        </div>
      </div>
    </div>
  )
}

