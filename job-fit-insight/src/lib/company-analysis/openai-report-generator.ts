"use server"

import OpenAI from "openai"
import { z } from "zod"

import type { JobRoleId, AnalysisEvidence, AnalysisReport } from "@/lib/analysis-types"
import type { CompanySources } from "@/lib/company-analysis/sources"
import { collectCompanySources } from "@/lib/company-analysis/sources"
import { zodResponseFormat } from "openai/helpers/zod"

const reportSchema = z.object({
  body: z.string().min(1),
  references: z.array(z.string()).min(1),
})

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}...`
}

function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.")
  return key
}

function buildSourcesText(sources: CompanySources) {
  const newsBlock = sources.naverNewsSnippets.length
    ? `네이버 뉴스 스니펫:\n- ${sources.naverNewsSnippets.join("\n- ")}`
    : "네이버 뉴스 스니펫: (없음)"

  const dartBlock = sources.dartSnippets.length
    ? `DART 공시 스니펫:\n- ${sources.dartSnippets.join("\n- ")}`
    : "DART 공시 스니펫: (없음)"

  const rssBlock = sources.rssSnippets.length
    ? `RSS/시장 스니펫:\n- ${sources.rssSnippets.join("\n- ")}`
    : "RSS/시장 스니펫: (없음)"

  const pdfBlock = sources.pdfText.trim()
    ? `PDF 텍스트(일부):\n${truncate(sources.pdfText, 4000)}`
    : "PDF 텍스트: (없음)"

  return `${newsBlock}\n\n${dartBlock}\n\n${rssBlock}\n\n${pdfBlock}`
}

export async function generateCompanyAnalysisReport(args: {
  companyUrl: string
  jobRoleId: JobRoleId
  jobRoleText: string
  announcementUrls: string[]
  extraRequirements: string | null
  pdfFile: File | null
  requestId: string
}): Promise<{ report: AnalysisReport; evidence: AnalysisEvidence }> {
  const sources = await collectCompanySources({
    companyUrl: args.companyUrl,
    jobRole: args.jobRoleId,
    announcementUrls: args.announcementUrls,
    extraRequirements: args.extraRequirements,
    pdfFile: args.pdfFile,
  })

  const sourcesText = buildSourcesText(sources)
  const extraReqText = args.extraRequirements ? truncate(args.extraRequirements, 1200) : "(없음)"
  const announcementText =
    args.announcementUrls.length > 0 ? args.announcementUrls.map((u) => `- ${u}`).join("\n") : "(없음)"

  const jobRoleHint: Record<JobRoleId, string> = {
    product_manager: "PM(프로덕트 매니저)의 관점에서 문제정의-실행-성과지표를 연결해라.",
    frontend_engineer: "프론트엔드 엔지니어의 관점에서 UI/성능/접근성/컴포넌트 관점으로 연결해라.",
    backend_engineer: "백엔드 엔지니어의 관점에서 데이터 모델/확장성/장애대응 관점으로 연결해라.",
    data_analyst: "데이터 분석가의 관점에서 지표 설계/의사결정 인사이트 관점으로 연결해라.",
  }

  const prompt: Array<{ role: "system" | "user"; content: string }> = [
    {
      role: "system",
      content:
        "너는 기업-직무 매칭 리서치 및 커리어 컨설턴트다. 작성 규칙을 반드시 지켜라. 출력은 반드시 JSON 스키마(reportSchema)에 맞춰라.",
    },
    {
      role: "user",
      content: [
        `요청: 회사 링크와 직무를 기반으로 '기업 분석 리포트'를 작성해라.`,
        "",
        `회사 URL: ${args.companyUrl}`,
        `직무(사용자 입력): ${args.jobRoleText}`,
        `직무 힌트(선택값): ${jobRoleHint[args.jobRoleId]}`,
        `공고 링크(참고):\n${announcementText}`,
        `추가 요구사항(있으면 반영): ${extraReqText}`,
        "",
        "아래는 수집된 출처 스니펫이다. 여기에 없는 정보는 일반 지식으로 작성하되, 인텍스트 인용과 References는 APA 7th 형식으로 일관되게 생성해라.",
        sourcesText,
        "",
        "작성 형식(본문):",
        "- References는 반드시 위 sourcesText에 포함된 URL(또는 스니펫 내 링크)을 근거로 구성해라",
        "- 본문 인텍스트 인용은 반드시 포함해라 (예: (McKinsey & Company, 2024) 또는 연도 미상 시 (출처제목, n.d.))",
        "- 회사/직무 내용은 반드시 '현재 시점 사실/근거' 기반으로 작성하고, '조사하겠다/추후 확인' 같은 미래형 표현을 최소화해라",
        "- 직무에 대한 내용이 반드시 포함되어야 하며, 적어도 1개 섹션은 jobRoleText(사용자 입력)를 기준으로 '주요 업무/책임/필요 역량'을 구체적으로 정리해라",
        "- 제목/섹션을 마크다운으로 구성(예: '## 1) 시장/산업 동향 요약')",
        "- 본문 하단에 '참고문헌(References)' 헤딩을 넣지 말고, JSON의 references 배열에만 넣어라",
        "- 분량은 너무 길지 않게(대략 700~1200단어 수준) 작성",
      ].join("\n"),
    },
  ]

  const client = new OpenAI({ apiKey: getOpenAIKey() })

  const completion = await client.chat.completions.parse({
    model: "gpt-4o",
    messages: prompt,
    temperature: 0.2,
    response_format: zodResponseFormat(reportSchema, "company_analysis_report"),
  })

  const message = completion.choices[0]?.message
  if (!message?.parsed) {
    throw new Error("OpenAI 응답을 JSON으로 파싱하지 못했습니다.")
  }

  const parsed = message.parsed
  const body = truncate(parsed.body, 120000)
  const references = parsed.references.slice(0, 20)

  return {
    report: { body, references },
    evidence: {
      naverNewsSnippets: sources.naverNewsSnippets,
      dartSnippets: sources.dartSnippets,
      rssSnippets: sources.rssSnippets,
      pdfTextPreview: sources.pdfText ? truncate(sources.pdfText, 2000) : "",
    },
  }
}

export async function refineCompanyAnalysisReport(args: {
  existingReport: AnalysisReport
  companyUrl: string
  jobRoleId: JobRoleId
  jobRoleText: string
  userInstruction: string
}): Promise<AnalysisReport> {
  const extraReqText = truncate(args.userInstruction, 1500)

  const client = new OpenAI({ apiKey: getOpenAIKey() })

  const completion = await client.chat.completions.parse({
    model: "gpt-4o",
    temperature: 0.2,
    response_format: zodResponseFormat(reportSchema, "company_analysis_report"),
    messages: [
      {
        role: "system",
        content:
          "너는 직무 기반 기업 분석 리포트 편집자다. 반드시 APA 7th 형식의 인텍스트 인용과 References를 유지/재생성해라. 출력은 JSON 스키마(reportSchema)에 맞춰라.",
      },
      {
        role: "user",
        content: [
          `기존 리포트 본문:\n${truncate(args.existingReport.body, 20000)}`,
          "",
          `기존 References:\n${args.existingReport.references.map((r) => `- ${r}`).join("\n")}`,
          "",
          `회사 URL: ${args.companyUrl}`,
          `직무(사용자 입력): ${args.jobRoleText}`,
          "",
          `사용자 수정 요청:\n${extraReqText}`,
          "",
          "요청 반영 방법:",
          "- 사용자가 지정한 부분을 우선 반영하고, 필요시 관련 섹션(시장/기업 관점/역량 매핑/전략)을 재정렬해라",
          "- 인용/References는 APA7th로 일관되게 유지해라. 가능하면 references 배열의 URL 근거를 유지해라",
          "- 본문에는 인텍스트 인용을 반드시 포함해라",
          "- 직무 핵심 업무/역량/책임 파트가 비어 있거나 추상적으로 보이지 않게 구체화해라",
          "- references 배열만 JSON으로 반환하고, 본문에 '참고문헌(References)' 헤딩은 넣지 마라",
        ].join("\n"),
      },
    ],
  })

  const message = completion.choices[0]?.message
  if (!message?.parsed) {
    throw new Error("OpenAI 리파인 응답을 JSON으로 파싱하지 못했습니다.")
  }

  const parsed = message.parsed
  return {
    body: truncate(parsed.body, 120000),
    references: parsed.references.slice(0, 20),
  }
}

