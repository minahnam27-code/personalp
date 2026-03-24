"use client"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalysisCharts } from "@/lib/analysis-types"

export default function MarketCharts({ charts }: { charts: AnalysisCharts }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>시장 동향</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full min-w-0">
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={charts.marketTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>기업 핵심 지표</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full min-w-0">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={charts.companyKpis} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>글로벌 세그먼트(국가/지역)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full min-w-0">
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={charts.globalSegments} margin={{ left: 4, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

