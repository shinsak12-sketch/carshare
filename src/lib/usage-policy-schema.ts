import { z } from "zod";

// 정책·제한 설정. 서버(검사)·관리자 화면(폼) 공용. 값이 null이면 "제한 없음".
export const DupActionEnum = z.enum(["warn", "block", "allow"]);

export const UsagePolicySchema = z.object({
  toolEnabled: z.object({
    assess: z.boolean(),
    adjustment: z.boolean(),
    procedure: z.boolean(),
    minor: z.boolean().default(true),
  }),
  // 견적 금액(사정전 공임+부품 합계, 원). 선견적은 견적서 첨부 시에만 검사
  minEstimate: z.object({
    assess: z.number().int().min(0).nullable(),
    adjustment: z.number().int().min(0).nullable(),
  }),
  maxEstimate: z.object({
    assess: z.number().int().min(0).nullable(),
    adjustment: z.number().int().min(0).nullable(),
  }),
  maxPhotos: z.number().int().min(1).nullable(),
  // 계정별 한도
  perUserDailyRuns: z.number().int().min(0).nullable(),
  perUserMonthlyRuns: z.number().int().min(0).nullable(),
  perUserMonthlyCostKrw: z.number().int().min(0).nullable(),
  // 전체 월 예산
  monthlyBudgetKrw: z.number().int().min(0).nullable(),
  budgetWarnPct: z.number().int().min(1).max(100),
  // 같은 차량 재실행(차량번호 + 도구 기준)
  dupWindowDays: z.number().int().min(0),
  dupMaxRuns: z.number().int().min(1),
  dupAction: DupActionEnum,
  // 관리자 계정은 한도·중복 검사 면제(테스트용). 도구 on/off·금액 제한은 관리자도 적용
  exemptAdmins: z.boolean(),
  blockMessage: z.string().max(300),
});

export type UsagePolicy = z.infer<typeof UsagePolicySchema>;

export const DEFAULT_POLICY: UsagePolicy = {
  toolEnabled: { assess: true, adjustment: true, procedure: true, minor: true },
  minEstimate: { assess: null, adjustment: null },
  maxEstimate: { assess: null, adjustment: null },
  maxPhotos: 150,
  perUserDailyRuns: null,
  perUserMonthlyRuns: null,
  perUserMonthlyCostKrw: null,
  monthlyBudgetKrw: null,
  budgetWarnPct: 80,
  dupWindowDays: 7,
  dupMaxRuns: 1,
  dupAction: "warn",
  exemptAdmins: true,
  blockMessage: "사용 정책에 따라 실행할 수 없습니다. 관리자에게 문의하세요.",
};
