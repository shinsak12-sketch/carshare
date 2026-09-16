const STYLE: Record<string, { label: string; cls: string }> = {
  succeeded: { label: "완료", cls: "bg-emerald-100 text-emerald-800" },
  queued: { label: "진행 중", cls: "bg-blue-100 text-blue-800" },
  failed: { label: "실패", cls: "bg-red-100 text-red-800" },
  blocked: { label: "차단", cls: "bg-amber-100 text-amber-900" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = STYLE[status] ?? {
    label: status,
    cls: "bg-slate-100 text-slate-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
