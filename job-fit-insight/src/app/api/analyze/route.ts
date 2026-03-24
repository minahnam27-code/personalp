import { z } from "zod"

import type { AnalysisResult } from "@/lib/analysis-types"
import { analyzeJobFitAction } from "@/app/actions/analysisActions"

// LLM/외부 API 호출이 오래 걸릴 수 있어 서버리스 타임아웃을 늘립니다.
export const runtime = "nodejs"
export const maxDuration = 120

const analyzeResponseSchema = z.object({
  result: z.unknown(),
})

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData()

  try {
    const result = (await analyzeJobFitAction(formData)) as AnalysisResult
    const payload = analyzeResponseSchema.parse({ result })
    return Response.json(payload, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "분석 생성 실패"
    return Response.json({ error: message }, { status: 400 })
  }
}

