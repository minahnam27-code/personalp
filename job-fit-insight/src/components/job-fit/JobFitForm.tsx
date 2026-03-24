"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { useAnalysis } from "@/lib/analysis-context"
import { JOB_ROLES, type JobRoleId } from "@/lib/analysis-types"
import { newId } from "@/lib/uuid"

type SubmitState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "error"; message: string }

export default function JobFitForm() {
  const router = useRouter()
  const { setAnalysis } = useAnalysis()

  const [companyUrl, setCompanyUrl] = useState<string>("")
  const [jobRole, setJobRole] = useState<JobRoleId>(JOB_ROLES[0]?.id ?? "product_manager")
  const [jobRoleCustomText, setJobRoleCustomText] = useState<string>("")
  const [announcementUrls, setAnnouncementUrls] = useState<string[]>([""])
  const [extraRequirements, setExtraRequirements] = useState<string>("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" })

  const canSubmit = useMemo(() => {
    if (!companyUrl.trim()) return false
    if (!jobRole) return false
    return true
  }, [companyUrl, jobRole])

  async function onSubmit() {
    const trimmedCompany = companyUrl.trim()
    if (!trimmedCompany) {
      setSubmitState({ status: "error", message: "회사 링크를 입력해 주세요." })
      return
    }

    try {
      setSubmitState({ status: "loading", message: "데이터를 수집/분석 중입니다..." })
      const requestId = newId()

      const formData = new FormData()
      formData.append("requestId", requestId)
      formData.append("companyUrl", trimmedCompany)
      const jobRoleText =
        jobRoleCustomText.trim() ||
        JOB_ROLES.find((r) => r.id === jobRole)?.label ||
        jobRole
      formData.append("jobRoleId", jobRole)
      formData.append("jobRoleText", jobRoleText)

      for (const url of announcementUrls) {
        const trimmed = url.trim()
        if (trimmed) formData.append("announcementUrl", trimmed)
      }

      const trimmedExtra = extraRequirements.trim()
      formData.append("extraRequirements", trimmedExtra)

      if (pdfFile) formData.append("pdf", pdfFile)

      const res = await fetch("/api/analyze", { method: "POST", body: formData })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "분석 생성에 실패했습니다.")
      }

      const payload: { result: unknown } = await res.json()
      setAnalysis(payload.result as never)
      router.push("/results")
    } catch (e) {
      const message = e instanceof Error ? e.message : "분석 생성에 실패했습니다."
      setSubmitState({ status: "error", message })
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Job-Fit Insight</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          회사/직무 정보를 입력하면, 시장 동향 + 기업 데이터 + 맞춤형 전략 리포트를 생성합니다.
        </p>
      </div>

      <Card className="p-4 md:p-6">
        <div className="grid gap-5 md:grid-cols-1">
          <div>
            <Label htmlFor="companyUrl">회사 링크 (필수)</Label>
            <Input
              id="companyUrl"
              name="companyUrl"
              placeholder="https://example.com"
              className="mt-2"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              inputMode="url"
            />
          </div>

          <div>
            <Label>직무 선택 (필수)</Label>
            <Select value={jobRole} onValueChange={(v) => setJobRole(v as JobRoleId)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="직무를 선택해 주세요" />
              </SelectTrigger>
              <SelectContent>
                {JOB_ROLES.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="mt-3">
              <Label htmlFor="jobRoleCustomText">직무 직접 입력 (선택)</Label>
              <Input
                id="jobRoleCustomText"
                className="mt-2"
                placeholder="예: B2B SaaS 제품전략/성장 마케팅 담당"
                value={jobRoleCustomText}
                onChange={(e) => setJobRoleCustomText(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                이 입력이 비어 있지 않으면, 드롭다운 값 대신 그대로 분석에 반영됩니다.
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between">
              <Label>공고 링크 (선택)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAnnouncementUrls((prev) => [...prev, ""])}
              >
                <PlusIcon className="mr-2 size-4" />
                추가
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              {announcementUrls.map((url, idx) => (
                <div key={`${idx}`} className="flex gap-3">
                  <Input
                    placeholder="https://job.example.com/..."
                    value={url}
                    onChange={(e) => {
                      const next = [...announcementUrls]
                      next[idx] = e.target.value
                      setAnnouncementUrls(next)
                    }}
                    inputMode="url"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              비워 둔 입력은 자동으로 제외됩니다.
            </p>
          </div>

          <div>
            <Label htmlFor="extraRequirements">
              추가 요구사항 (선택)
              <div className="mt-1 text-xs font-normal text-muted-foreground">
                “AI에게 특별히 요청할 사항이 있나요?” 자유롭게 입력하세요.
              </div>
            </Label>
            <Textarea
              id="extraRequirements"
              className="mt-2 min-h-28"
              placeholder="예: 이 회사의 최근 제품 전략을 면접 답변에 반영해줘..."
              value={extraRequirements}
              onChange={(e) => setExtraRequirements(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="pdfUpload">PDF 업로드 (선택)</Label>
            <Input
              id="pdfUpload"
              type="file"
              className="mt-2"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setPdfFile(file)
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              PDF는 직무 관련 자료로 활용됩니다(현재는 UI 스캐폴딩).
            </p>
          </div>

          <div className="pt-2">
            <Button className="w-full md:w-auto" disabled={!canSubmit || submitState.status === "loading"} onClick={onSubmit}>
              {submitState.status === "loading" ? submitState.message : "분석 리포트 생성"}
            </Button>

            {submitState.status === "error" ? (
              <p className="mt-3 text-sm text-destructive">{submitState.message}</p>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  )
}

