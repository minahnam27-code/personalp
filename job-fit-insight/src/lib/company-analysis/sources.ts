import { z } from "zod"
import Parser from "rss-parser"

import type { JobRoleId } from "@/lib/analysis-types"

const dartCorpCodeSchema = z.object({
  status: z.string().optional(),
  list: z
    .array(
      z.object({
        corp_code: z.string().optional(),
        corp_name: z.string().optional(),
        stock_code: z.string().optional(),
      })
    )
    .optional(),
})

const dartListSchema = z.object({
  status: z.string().optional(),
  list: z
    .array(
      z.object({
        rcept_no: z.string().optional(),
        rcept_dt: z.string().optional(),
        report_nm: z.string().optional(),
        pblntf_ty: z.string().optional(),
        pblntf_detail_ty: z.string().optional(),
        // 응답에 따라 제목 필드명이 다를 수 있으므로 안전하게 포함합니다.
        title: z.string().optional(),
      })
    )
    .optional(),
})

const naverNewsSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string(),
        link: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .optional(),
})

function truncate(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}...`
}

function getHostname(companyUrl: string) {
  try {
    const url = new URL(companyUrl)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return companyUrl
  }
}

async function fetchNaverNews(query: string, limit: number): Promise<string[]> {
  const clientId = process.env.NAVER_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim() ?? ""
  if (!clientId || !clientSecret) return []

  const url = new URL("https://openapi.naver.com/v1/search/news.json")
  url.searchParams.set("query", query)
  url.searchParams.set("display", String(limit))
  url.searchParams.set("sort", "date")

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    // 서버 액션이므로 캐시를 강하게 고정하지 않습니다.
    cache: "no-store",
  })

  if (!res.ok) return []

  const json = await res.json()
  const parsed = naverNewsSchema.safeParse(json)
  if (!parsed.success) return []

  const items = parsed.data.items ?? []
  return items
    .slice(0, limit)
    .map((it) => {
      const link = it.link ? ` [${it.link}]` : ""
      const desc = it.description ? ` - ${truncate(it.description, 200)}` : ""
      return `${it.title}${desc}${link}`.trim()
    })
}

async function extractPdfText(_file: File): Promise<string> {
  // TODO: LangChain 또는 PDF Reader API로 텍스트 추출 연결
  return ""
}

function isFileLike(value: unknown): value is File {
  if (typeof File === "undefined") return false
  return value instanceof File
}

function formatYyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

async function guessCorpNameFromCompanyUrl(companyUrl: string): Promise<string> {
  try {
    const res = await fetch(companyUrl, { method: "GET", cache: "no-store" })
    if (!res.ok) return ""
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]{2,200})<\/title>/i)
    if (titleMatch?.[1]) return titleMatch[1].trim()

    const ogSiteNameMatch = html.match(
      /property=["']og:site_name["'][^>]*content=["']([^"']{2,200})["']/i
    )
    if (ogSiteNameMatch?.[1]) return ogSiteNameMatch[1].trim()
  } catch {
    // 공시 수집은 best-effort이므로 실패해도 전체 분석이 깨지지 않아야 합니다.
  }
  return ""
}

async function fetchDartCorpCodeByName(corpName: string, limit: number): Promise<string[]> {
  const apiKey = process.env.DART_API_KEY?.trim() ?? ""
  if (!apiKey) return []
  if (!corpName.trim()) return []

  const url = new URL("https://opendart.fss.or.kr/api/corpCode.json")
  url.searchParams.set("crtfc_key", apiKey)
  url.searchParams.set("corp_name", corpName)

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" })
  if (!res.ok) return []

  const json = await res.json()
  const parsed = dartCorpCodeSchema.safeParse(json)
  if (!parsed.success) return []

  const codes = (parsed.data.list ?? [])
    .map((it) => it.corp_code ?? "")
    .filter((s) => s)

  // corpCode.json은 회사가 여러 개로 매칭될 수 있으므로 상위 n개만 사용합니다.
  return codes.slice(0, limit)
}

function pickDartSnippetFromListItems(items: Array<{ rcept_no?: string; rcept_dt?: string; report_nm?: string; title?: string }>) {
  const mapped = items
    .map((it) => {
      const name = it.report_nm ?? it.title ?? ""
      const date = it.rcept_dt ?? ""
      const rceptNo = it.rcept_no ?? ""
      const dartUrl = rceptNo
        ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(rceptNo)}`
        : ""
      if (!name && !date) return ""
      const base = date ? `${name} (${date})` : name
      return dartUrl ? `${base} - ${dartUrl}` : base
    })
    .filter((s) => s)

  return mapped.slice(0, 6)
}

async function fetchDartLatestFilingSnippets(corpCode: string): Promise<string[]> {
  const apiKey = process.env.DART_API_KEY?.trim() ?? ""
  if (!apiKey) return []
  if (!corpCode.trim()) return []

  const end = new Date()
  const start = new Date(end.getTime())
  start.setMonth(start.getMonth() - 6)

  const url = new URL("https://opendart.fss.or.kr/api/list.json")
  url.searchParams.set("crtfc_key", apiKey)
  url.searchParams.set("corp_code", corpCode)
  url.searchParams.set("bgn_de", formatYyyyMmDd(start))
  url.searchParams.set("end_de", formatYyyyMmDd(end))
  url.searchParams.set("page_no", "1")
  url.searchParams.set("page_count", "10")
  url.searchParams.set("sort", "date")

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" })
  if (!res.ok) return []

  const json = await res.json()
  const parsed = dartListSchema.safeParse(json)
  if (!parsed.success) return []

  const items = parsed.data.list ?? []
  return pickDartSnippetFromListItems(items)
}

function getDefaultRssFeedUrls() {
  // 서버에서 직접 fetch하는 “글로벌 트렌드”용 공개 RSS 예시입니다.
  // 필요 시 env의 RSS_FEED_URLS로 덮어쓸 수 있습니다.
  return [
    "https://news.google.com/rss/search?q=AI+industry&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=semiconductor+market&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=cloud+computing+market&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=customer+experience+technology&hl=en-US&gl=US&ceid=US:en",
  ]
}

function getRssFeedUrls(): string[] {
  const raw = process.env.RSS_FEED_URLS
  if (raw && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  return getDefaultRssFeedUrls()
}

async function fetchRssSnippets(limitPerFeed: number): Promise<string[]> {
  const urls = getRssFeedUrls()
  if (urls.length === 0) return []

  const parser = new Parser({
    timeout: 15_000,
    // 일부 RSS는 User-Agent 없으면 차단될 수 있으므로 명시합니다.
    headers: { "User-Agent": "job-fit-insight/1.0" },
  })

  const results: string[] = []
  await Promise.all(
    urls.map(async (u) => {
      try {
        const feed = await parser.parseURL(u)
        const items = feed.items ?? []
        for (const it of items.slice(0, limitPerFeed)) {
          const title = it.title ?? ""
          const summary = (it.contentSnippet ?? it.summary ?? "").toString()
          const link = it.link ? ` [${it.link}]` : ""
          const text = [title, summary].filter(Boolean).join(" - ") + link
          if (text.trim()) results.push(text.trim())
          if (results.length >= 12) break
        }
      } catch {
        // RSS 수집은 best-effort입니다. 하나 실패해도 전체 분석이 깨지지 않게 합니다.
      }
    })
  )

  return results.slice(0, 12)
}

export type CompanySources = {
  hostname: string
  naverNewsSnippets: string[]
  dartSnippets: string[]
  rssSnippets: string[]
  pdfText: string
}

export async function collectCompanySources(args: {
  companyUrl: string
  jobRole: JobRoleId
  announcementUrls: string[]
  extraRequirements: string | null
  pdfFile: File | null
}): Promise<CompanySources> {
  const hostname = getHostname(args.companyUrl)

  const naverNewsSnippets = await fetchNaverNews(hostname, 6)

  const pdfText = args.pdfFile ? await extractPdfText(args.pdfFile) : ""

  // DART 공시는 best-effort로 실행합니다. 실패해도 analysis 생성 자체가 깨지지 않도록 합니다.
  let dartSnippets: string[] = []
  try {
    const guessedCorpName = await guessCorpNameFromCompanyUrl(args.companyUrl)
    const corpCodes = await fetchDartCorpCodeByName(guessedCorpName || hostname, 1)
    if (corpCodes.length) {
      dartSnippets = await fetchDartLatestFilingSnippets(corpCodes[0])
    }
  } catch {
    dartSnippets = []
  }

  // RSS(시장 동향) 수집을 실제로 시도합니다.
  const rssSnippets = await fetchRssSnippets(3)

  // announcementUrls/extraRequirements는 프롬프트 입력으로만 전달합니다.
  void args.jobRole
  void args.announcementUrls
  void args.extraRequirements

  return {
    hostname,
    naverNewsSnippets,
    dartSnippets,
    rssSnippets,
    pdfText,
  }
}

export function parsePdfFile(formData: FormData): File | null {
  const raw = formData.get("pdf")
  if (raw && isFileLike(raw)) return raw
  return null
}

