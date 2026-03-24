export type JobRoleId =
  | "product_manager"
  | "frontend_engineer"
  | "backend_engineer"
  | "data_analyst";

export const JOB_ROLES: Array<{ id: JobRoleId; label: string }> = [
  { id: "product_manager", label: "프로덕트 매니저 (PM)" },
  { id: "frontend_engineer", label: "프론트엔드 엔지니어" },
  { id: "backend_engineer", label: "백엔드 엔지니어" },
  { id: "data_analyst", label: "데이터 분석가" },
];

export interface TrendPoint {
  label: string;
  value: number;
}

export interface AnalysisCharts {
  marketTrend: TrendPoint[];
  companyKpis: TrendPoint[];
  globalSegments: TrendPoint[];
}

export interface CareerRoadmap {
  shortTerm: string[];
  midTerm: string[];
  longTerm: string[];
}

export interface AnalysisReport {
  body: string;
  references: string[];
}

export interface AnalysisEvidence {
  naverNewsSnippets: string[];
  dartSnippets: string[];
  rssSnippets: string[];
  pdfTextPreview: string;
}

export interface AnalysisResult {
  requestId: string;
  createdAtIso: string;
  input: {
    companyUrl: string;
    jobRoleId: JobRoleId;
    jobRoleText: string;
    announcementUrls: string[];
    extraRequirements: string | null;
  };
  charts: AnalysisCharts;
  report: AnalysisReport;
  careerRoadmap: CareerRoadmap;
  evidence?: AnalysisEvidence;
  updatedAtIso: string;
}

