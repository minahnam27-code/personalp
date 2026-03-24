import { z } from "zod"

import type { AnalysisResult } from "@/lib/analysis-types"
import { refineJobFitAction } from "@/app/actions/analysisActions"

// LLM/외부 API 호출이 오래 걸릴 수 있어 서버리스 타임아웃을 늘립니다.
export const runtime = "nodejs"
export const maxDuration = 120

const refinePayloadSchema = z.object({
  analysis: z.unknown(),
  userInstruction: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  const json = await req.json()
  const parsed = refinePayloadSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 })
  }

  try {
    const analysis = parsed.data.analysis as AnalysisResult
    const result = await refineJobFitAction(analysis, parsed.data.userInstruction)
    return Response.json({ result }, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : "리파인 실패"
    return Response.json({ error: message }, { status: 400 })
  }
}

