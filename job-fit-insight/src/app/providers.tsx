"use client"

import type React from "react"
import { AnalysisProvider } from "@/lib/analysis-context"

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AnalysisProvider>{children}</AnalysisProvider>
}

