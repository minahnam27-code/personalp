"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { AnalysisResult } from "@/lib/analysis-types"
import { z } from "zod"

type AnalysisContextValue = {
  analysis: AnalysisResult | null
  setAnalysis: (next: AnalysisResult | null) => void
}

const AnalysisContext = createContext<AnalysisContextValue | undefined>(undefined)

const analysisStorageKey = "job-fit-insight.analysis"

const analysisStorageSchema = z.object({
  requestId: z.string(),
  createdAtIso: z.string(),
  updatedAtIso: z.string(),
  input: z.object({
    companyUrl: z.string(),
    jobRoleId: z.string(),
    jobRoleText: z.string(),
    announcementUrls: z.array(z.string()),
    extraRequirements: z.string().nullable(),
  }),
  charts: z.object({
    marketTrend: z.array(z.object({ label: z.string(), value: z.number() })),
    companyKpis: z.array(z.object({ label: z.string(), value: z.number() })),
    globalSegments: z.array(z.object({ label: z.string(), value: z.number() })),
  }),
  report: z.object({
    body: z.string(),
    references: z.array(z.string()),
  }),
  evidence: z
    .object({
      naverNewsSnippets: z.array(z.string()),
      dartSnippets: z.array(z.string()),
      rssSnippets: z.array(z.string()),
      pdfTextPreview: z.string(),
    })
    .optional(),
  careerRoadmap: z.object({
    shortTerm: z.array(z.string()),
    midTerm: z.array(z.string()),
    longTerm: z.array(z.string()),
  }),
})

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [analysisState, setAnalysisState] = useState<AnalysisResult | null>(null)

  const setAnalysis = (next: AnalysisResult | null) => {
    setAnalysisState(next)
    try {
      if (typeof window === "undefined") return
      if (!next) {
        window.localStorage.removeItem(analysisStorageKey)
        return
      }
      window.localStorage.setItem(analysisStorageKey, JSON.stringify(next))
    } catch {
      // 로컬스토리지는 실패해도 서비스 자체 동작은 유지합니다.
    }
  }

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const raw = window.localStorage.getItem(analysisStorageKey)
      if (!raw) return
      const parsed = analysisStorageSchema.safeParse(JSON.parse(raw))
      if (parsed.success) setAnalysisState(parsed.data as AnalysisResult)
    } catch {
      // 저장 데이터 포맷이 바뀌었을 수 있으므로 실패해도 무시합니다.
    }
  }, [])

  const value = useMemo<AnalysisContextValue>(
    () => ({
      analysis: analysisState,
      setAnalysis,
    }),
    [analysisState]
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) {
    throw new Error("useAnalysis는 AnalysisProvider 내부에서만 사용할 수 있습니다.")
  }
  return ctx
}

