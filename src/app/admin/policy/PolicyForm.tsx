"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UsagePolicy } from "@/lib/usage-policy-schema";

type Num = number | null;

function NumField({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: Num;
  onChange: (v: Num) => void;
  unit?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      <span>
        {label}
        {unit && (
          <span className="ml-1 font-normal text-slate-400">({unit})</span>
        )}
      </span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        placeholder="제한 없음"
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal tabular-nums text-slate-900 outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      {hint && (
        <span className="text-[11px] font-normal text-slate-400">{hint}</span>
      )}
    </label>
  );
}

function Toggle({
  label,
  on,
  onChange,
  hint,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${on ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
    >
      <span>
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        {hint && (
          <span className="block text-[11px] text-slate-500">{hint}</span>
        )}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function PolicyForm({ initial }: { initial: UsagePolicy }) {
  const router = useRouter();
  const [p, setP] = useState<UsagePolicy>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setMsg("저장됨. 다음 실행부터 적용.");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="도구 사용"
        desc="끄면 해당 도구는 모든 계정(관리자 포함)에서 실행이 막힘."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Toggle
            label="선견적진단"
            on={p.toolEnabled.assess}
            onChange={(v) =>
              setP({ ...p, toolEnabled: { ...p.toolEnabled, assess: v } })
            }
          />
          <Toggle
            label="AI손해사정"
            on={p.toolEnabled.adjustment}
            onChange={(v) =>
              setP({ ...p, toolEnabled: { ...p.toolEnabled, adjustment: v } })
            }
          />
          <Toggle
            label="정비공정"
            on={p.toolEnabled.procedure}
            onChange={(v) =>
              setP({ ...p, toolEnabled: { ...p.toolEnabled, procedure: v } })
            }
          />
          <Toggle
            label="경미손상판독"
            on={p.toolEnabled.minor ?? true}
            onChange={(v) =>
              setP({ ...p, toolEnabled: { ...p.toolEnabled, minor: v } })
            }
          />
        </div>
      </Section>

      <Section
        title="견적 금액 제한"
        desc="견적서의 사정전 공임+부품 합계(부가세 전) 기준. 선견적은 견적서를 첨부한 경우에만 검사. 예: 하한 1,000,000 → 100만 원 미만 건은 실행 불가."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField
            label="선견적 하한"
            unit="원"
            value={p.minEstimate.assess}
            onChange={(v) =>
              setP({ ...p, minEstimate: { ...p.minEstimate, assess: v } })
            }
          />
          <NumField
            label="선견적 상한"
            unit="원"
            value={p.maxEstimate.assess}
            onChange={(v) =>
              setP({ ...p, maxEstimate: { ...p.maxEstimate, assess: v } })
            }
          />
          <NumField
            label="손해사정 하한"
            unit="원"
            value={p.minEstimate.adjustment}
            onChange={(v) =>
              setP({ ...p, minEstimate: { ...p.minEstimate, adjustment: v } })
            }
          />
          <NumField
            label="손해사정 상한"
            unit="원"
            value={p.maxEstimate.adjustment}
            onChange={(v) =>
              setP({ ...p, maxEstimate: { ...p.maxEstimate, adjustment: v } })
            }
          />
        </div>
      </Section>

      <Section
        title="계정별 한도·전체 예산"
        desc="계정 한도는 실행 건수와 비용 기준. 전체 예산은 완료 건 비용 합계가 넘으면 직원 실행이 차단됨. 개요 화면에 예산 사용률과 경고가 표시됨."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <NumField
            label="계정 일 한도"
            unit="건"
            value={p.perUserDailyRuns}
            onChange={(v) => setP({ ...p, perUserDailyRuns: v })}
          />
          <NumField
            label="계정 월 한도"
            unit="건"
            value={p.perUserMonthlyRuns}
            onChange={(v) => setP({ ...p, perUserMonthlyRuns: v })}
          />
          <NumField
            label="계정 월 비용 한도"
            unit="원"
            value={p.perUserMonthlyCostKrw}
            onChange={(v) => setP({ ...p, perUserMonthlyCostKrw: v })}
          />
          <NumField
            label="전체 월 예산"
            unit="원"
            value={p.monthlyBudgetKrw}
            onChange={(v) => setP({ ...p, monthlyBudgetKrw: v })}
          />
          <NumField
            label="예산 경고 기준"
            unit="%"
            value={p.budgetWarnPct}
            onChange={(v) => setP({ ...p, budgetWarnPct: v ?? 80 })}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <NumField
            label="사진 최대 장수"
            unit="장"
            value={p.maxPhotos}
            onChange={(v) => setP({ ...p, maxPhotos: v })}
          />
        </div>
      </Section>

      <Section
        title="같은 차량 재실행"
        desc="차량번호 + 도구 기준으로 최근 N일 안의 완료 건을 셈. '경고 후 진행'은 직원에게 마지막 실행자·시각·비용을 보여주고 확인을 받음."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumField
            label="기간"
            unit="일, 0이면 검사 안 함"
            value={p.dupWindowDays}
            onChange={(v) => setP({ ...p, dupWindowDays: v ?? 0 })}
          />
          <NumField
            label="허용 횟수"
            unit="회, 이 횟수부터 걸림"
            value={p.dupMaxRuns}
            onChange={(v) => setP({ ...p, dupMaxRuns: Math.max(1, v ?? 1) })}
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            초과 시 동작
            <select
              value={p.dupAction}
              onChange={(e) =>
                setP({
                  ...p,
                  dupAction: e.target.value as UsagePolicy["dupAction"],
                })
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
            >
              <option value="warn">경고 후 진행</option>
              <option value="block">차단</option>
              <option value="allow">검사 안 함</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="기타">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle
            label="관리자 계정 면제"
            hint="계정 한도·예산·중복 검사를 관리자에겐 적용 안 함(테스트용). 도구 on/off·금액 제한은 관리자도 적용."
            on={p.exemptAdmins}
            onChange={(v) => setP({ ...p, exemptAdmins: v })}
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            차단 시 안내 문구 (사유 뒤에 붙음)
            <input
              value={p.blockMessage}
              maxLength={300}
              onChange={(e) => setP({ ...p, blockMessage: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "정책 저장"}
        </button>
        {msg && (
          <span className="text-xs font-semibold text-blue-700">{msg}</span>
        )}
      </div>
    </div>
  );
}
