"use client"

import { useMemo, useState } from "react"
import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useAnalysis } from "@/lib/analysis-context"
import { newId } from "@/lib/uuid"

type ChatRole = "user" | "assistant"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

export default function ChatPanel() {
  const { analysis, setAnalysis } = useAnalysis()

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newId(),
      role: "assistant",
      content:
        "분석 리포트를 보고 “이 부분 수정해줘” 또는 “A 상품에 대해 더 조사해줘”처럼 요청해 주세요. 제가 리포트를 즉시 보완(샘플 동작)할게요.",
    },
  ])

  const [instruction, setInstruction] = useState<string>("")
  const [isRefining, setIsRefining] = useState<boolean>(false)
  const canSend = useMemo(() => analysis !== null && instruction.trim().length > 0, [analysis, instruction])

  async function onSend() {
    if (!analysis) return
    const trimmed = instruction.trim()
    if (!trimmed) return

    const userMsg: ChatMessage = { id: newId(), role: "user", content: trimmed }
    setInstruction("")
    setMessages((prev) => [...prev, userMsg])

    try {
      setIsRefining(true)

      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, userInstruction: trimmed }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || "리파인에 실패했습니다.")
      }

      const payload: { result: unknown } = await res.json()
      setAnalysis(payload.result as never)

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: "요청을 반영해 리포트 업데이트를 완료했습니다. (샘플 동작)",
        },
      ])
    } catch (e) {
      const message = e instanceof Error ? e.message : "리파인에 실패했습니다."
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: `오류: ${message}` },
      ])
    } finally {
      setIsRefining(false)
    }
  }

  return (
    <Card className="h-fit md:sticky md:top-4">
      <CardHeader>
        <CardTitle>리파인 챗봇</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ScrollArea className="h-72 pr-3">
          <div className="space-y-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === "user" ? "rounded-lg bg-muted/60 p-2" : "rounded-lg p-2"}
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {m.role === "user" ? "사용자" : "AI"}
                </div>
                <div className="whitespace-pre-wrap text-sm">{m.content}</div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="예: ‘지원 동기’ 문단을 더 구체적으로 수정해줘."
            className="min-h-20 resize-none"
          />
          <Button type="button" className="w-full" onClick={onSend} disabled={!canSend || isRefining}>
            <SendHorizontal className="mr-2 size-4" />
            {isRefining ? "업데이트 중..." : "리포트 수정 요청"}
          </Button>

          {analysis ? (
            <p className="text-xs text-muted-foreground">
              현재 요청: {analysis.requestId.slice(0, 8)}...
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">먼저 분석 리포트를 생성해 주세요.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

