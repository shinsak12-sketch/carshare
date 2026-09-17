import { getPolicy } from "@/lib/usage-policy";
import { prisma } from "@/lib/prisma";
import { PolicyForm } from "./PolicyForm";
import { fmtKst } from "@/lib/kst";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const [policy, row] = await Promise.all([
    getPolicy(),
    prisma.appSetting.findUnique({ where: { key: "usage-policy" } }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">정책·제한</h1>
        <p className="mt-1 text-sm text-slate-500">
          직원이 도구를 실행하기 직전에 검사됩니다. 걸린 실행은 토큰을 쓰지 않고
          실행 이력에 &quot;차단&quot;으로 남습니다. 빈 칸은 제한 없음.
          {row && (
            <span className="ml-2 text-xs text-slate-400">
              마지막 변경 {fmtKst(row.updatedAt)} · {row.updatedBy ?? "-"}
            </span>
          )}
        </p>
      </div>
      <PolicyForm initial={policy} />
    </div>
  );
}
