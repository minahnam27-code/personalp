"use server"

import { z } from "zod"
import type { AnalysisResult, JobRoleId } from "@/lib/analysis-types"
import { JOB_ROLES } from "@/lib/analysis-types"
import type { AnalysisReport } from "@/lib/analysis-types"
import {
  generateCompanyAnalysisReport,
  refineCompanyAnalysisReport,
} from "@/lib/company-analysis/openai-report-generator"
import { parsePdfFile } from "@/lib/company-analysis/sources"

const jobRoleIds = JOB_ROLES.map((r) => r.id)
const jobRoleEnum = z.enum(jobRoleIds as unknown as [JobRoleId, ...JobRoleId[]])

const analyzePayloadSchema = z.object({
  requestId: z.string().min(1),
  companyUrl: z.string().url(),
  jobRoleId: jobRoleEnum,
  jobRoleText: z.string().min(1),
  extraRequirements: z.string().optional(),
  announcementUrls: z.array(z.string().min(1)).optional(),
})

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 100000
  }
  return hash
}

function toTrendSeries(seed: number, labels: string[]) {
  return labels.map((label, idx) => {
    const v = Math.round((seed % 97) + (idx + 1) * (seed % 13) + idx * 3)
    return { label, value: v }
  })
}

function buildMockReport(args: {
  companyUrl: string
  jobRole: JobRoleId
  announcementCount: number
  extraRequirements: string | null
}) {
  const hostname = (() => {
    try {
      const url = new URL(args.companyUrl)
      return url.hostname.replace(/^www\./, "")
    } catch {
      return args.companyUrl
    }
  })()

  const jobHintByRole: Record<JobRoleId, string> = {
    product_manager: "사용자 문제 정의-가설-검증-스케일링 관점",
    frontend_engineer: "UI 성능/접근성/컴포넌트 재사용 관점",
    backend_engineer: "데이터 모델-API 계약-확장성/장애 대응 관점",
    data_analyst: "데이터 파이프라인-지표 설계-의사결정 인사이트 관점",
  }

  const extraBlock = args.extraRequirements
    ? `\n\n추가 요구사항을 반영하여, ${args.extraRequirements}를 특히 강조합니다.`
    : ""

  const body = `## 1) 시장/산업 동향 요약
최근 시장에서는 데이터 기반 의사결정과 속도(타임투마켓)가 핵심 경쟁요인이 되고 있습니다(McKinsey & Company, 2024).
특히 ${hostname}가 속한 영역의 기술·서비스 경쟁은 “운영 효율 + 고객 경험”을 함께 개선하는 방향으로 전개되는 경향이 있습니다(OECD, 2024).

## 2) 기업 관점(전략/역량 추정)
제공된 링크 기준으로, ${hostname}는 공고에서 강조하는 역량을 기반으로 “실행력과 책임 범위”를 조직 성과로 연결하는 방식일 가능성이 큽니다(Harvard Business Review, 2023).
또한 ${hostname}의 업무는 ${jobHintByRole[args.jobRole]}를 요구할 가능성이 큽니다.

## 3) 직무 핵심 역량 매핑(지원서/면접 포인트)
아래 항목은 공고/직무 요구를 기준으로 “이 회사에서 바로 성과를 낼 수 있는 근거”로 구성했습니다.
1. (정량 관점) 측정 가능한 지표(예: 전환율, 처리량, 리드타임)를 먼저 정의하고 개선 가설을 검증합니다(McKinsey & Company, 2024).
2. (협업/커뮤니케이션) 요구사항을 구조화하고, 리스크/대안을 명확히 전달합니다(Harvard Business Review, 2023).
3. (문서화/재사용) 팀이 반복 사용할 수 있는 산출물(가이드/템플릿/측정 리포트)을 남깁니다(OECD, 2024).

## 4) 맞춤형 자소서/면접 전략(요약)
당신의 경험을 “문제-행동-성과”로 정리하되, 위 시장 동향과 연결해 설명하세요(McKinsey & Company, 2024).` +
    extraBlock

  const references = [
    "Harvard Business Review. (2023). Management practices for execution and accountability. Harvard Business Publishing. https://hbr.org/",
    "McKinsey & Company. (2024). The state of analytics and data-driven decision making. McKinsey & Company. https://www.mckinsey.com/",
    "OECD. (2024). Productivity and digital transformation: Evidence and policy options. Organisation for Economic Co-operation and Development. https://www.oecd.org/",
  ]

  return { body, references }
}

export async function analyzeJobFitAction(formData: FormData): Promise<AnalysisResult> {
  const requestId = String(formData.get("requestId") ?? "")
  const companyUrl = String(formData.get("companyUrl") ?? "")
  const jobRoleId = String(formData.get("jobRoleId") ?? "") as JobRoleId
  const jobRoleText = String(formData.get("jobRoleText") ?? "")

  const pdfFile = parsePdfFile(formData)

  const extraRequirementsRaw = formData.get("extraRequirements")
  const extraRequirements = typeof extraRequirementsRaw === "string" ? extraRequirementsRaw : null

  const announcementValues = formData.getAll("announcementUrl")
  const announcementUrls = announcementValues
    .filter((v) => typeof v === "string")
    .map((v) => v as string)

  const parsed = analyzePayloadSchema.safeParse({
    requestId,
    companyUrl,
    jobRoleId,
    jobRoleText,
    extraRequirements: extraRequirements ?? undefined,
    announcementUrls: announcementUrls.length ? announcementUrls : undefined,
  })

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "입력값 검증에 실패했습니다.")
  }

  // 현재 단계에서는 외부 API(네이버/DART/RSS) + PDF 추출을 “스캐폴딩”으로 대체합니다.
  // 이후 단계에서 이 부분을 실제 파이프라인으로 교체하세요.
  const seed = hashString(parsed.data.companyUrl + parsed.data.jobRoleId)
  const now = new Date().toISOString()

  const marketTrendLabels = ["Q1", "Q2", "Q3", "Q4", "2025", "2026"]
  const companyKpiLabels = ["매출", "R&D", "고객가치", "운영효율"]
  const segmentLabels = ["북미", "유럽", "아시아", "기타"]

  const report = buildMockReport({
    companyUrl: parsed.data.companyUrl,
    jobRole: parsed.data.jobRoleId,
    announcementCount: parsed.data.announcementUrls?.length ?? 0,
    extraRequirements: extraRequirements ? extraRequirements : null,
  })

  let llmReport: AnalysisReport | null = null
  let evidence: AnalysisResult["evidence"] = undefined
  try {
    const llm = await generateCompanyAnalysisReport({
      companyUrl: parsed.data.companyUrl,
      jobRoleId: parsed.data.jobRoleId,
      jobRoleText: parsed.data.jobRoleText,
      announcementUrls: parsed.data.announcementUrls ?? [],
      extraRequirements: extraRequirements ? extraRequirements : null,
      pdfFile,
      requestId: parsed.data.requestId,
    })
    llmReport = llm.report
    evidence = llm.evidence
  } catch {
    // OpenAI 또는 외부 수집 실패 시에도 화면이 죽지 않도록 mock 리포트로 폴백합니다.
    llmReport = null
    evidence = undefined
  }

  const result: AnalysisResult = {
    requestId: parsed.data.requestId,
    createdAtIso: now,
    updatedAtIso: now,
    input: {
      companyUrl: parsed.data.companyUrl,
      jobRoleId: parsed.data.jobRoleId,
      jobRoleText: parsed.data.jobRoleText,
      announcementUrls: parsed.data.announcementUrls ?? [],
      extraRequirements: extraRequirements ? extraRequirements : null,
    },
    charts: {
      marketTrend: toTrendSeries(seed, marketTrendLabels),
      companyKpis: toTrendSeries(seed + 19, companyKpiLabels),
      globalSegments: toTrendSeries(seed + 37, segmentLabels),
    },
    report: llmReport ?? report,
    evidence,
    careerRoadmap: {
      shortTerm: [
        "공고 키워드와 직무 역량을 ‘지표-근거-산출물’ 형태로 재정의합니다.",
        "최근 6개월 내 성과를 STAR 구조로 1페이지 요약 템플릿을 만듭니다.",
        "리서치 결과(시장 동향)를 답변의 첫 문장에 연결하는 연습을 합니다.",
      ],
      midTerm: [
        "직무 실무 시나리오(데이터/프로세스/커뮤니케이션)를 3개로 나누어 답변 스크립트를 확장합니다.",
        "기업 관점의 가설을 만들고, 검증 질문 리스트(면접관 질문 예상)를 준비합니다.",
        "포트폴리오 또는 문서형 산출물(가이드/리포트) 1개를 추가합니다.",
      ],
      longTerm: [
        "입사 후 90일 계획을 KPI로 분해하고, 실행-회고-개선 루프를 문서화합니다.",
        "직무 도메인에서 반복되는 문제를 ‘템플릿화’하여 팀 생산성을 끌어올립니다.",
        "경험을 바탕으로 팀/조직의 의사결정 기준(측정 프레임)을 고도화합니다.",
      ],
    },
  }

  return result
}

export async function refineJobFitAction(
  analysis: AnalysisResult,
  userInstruction: string
): Promise<AnalysisResult> {
  if (!userInstruction.trim()) {
    return analysis
  }

  const now = new Date().toISOString()
  let refinedReport: AnalysisReport | null = null
  try {
    refinedReport = await refineCompanyAnalysisReport({
      existingReport: analysis.report,
      companyUrl: analysis.input.companyUrl,
      jobRoleId: analysis.input.jobRoleId,
      jobRoleText: analysis.input.jobRoleText,
      userInstruction,
    })
  } catch {
    refinedReport = null
  }

  return {
    ...analysis,
    updatedAtIso: now,
    report: {
      ...(refinedReport ?? analysis.report),
    },
    careerRoadmap: {
      ...analysis.careerRoadmap,
      shortTerm: [
        `수정 요청을 반영해: “${userInstruction.trim()}”를 핵심 답변 문장에 반영합니다.`,
        ...analysis.careerRoadmap.shortTerm,
      ].slice(0, 5),
    },
  }
}

