import Link from "next/link";

interface AppTile {
  href: string;
  label: string;
  icon: string;
  gradient: string;
  disabled?: boolean;
}

// 나중에 기능이 늘어나면 여기에 항목만 추가하면 홈 화면 아이콘이 늘어남.
const APPS: AppTile[] = [
  {
    href: "/assess/new",
    label: "선견적진단",
    icon: "🚗",
    gradient: "from-blue-500 to-blue-700",
  },
  {
    href: "/procedure/new",
    label: "정비공정",
    icon: "🛠️",
    gradient: "from-orange-500 to-orange-700",
  },
  {
    href: "#",
    label: "안내스크립트",
    icon: "🗒️",
    gradient: "from-slate-400 to-slate-500",
    disabled: true,
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="grid grid-cols-3 gap-x-6 gap-y-9 sm:grid-cols-4">
        {APPS.map((app) =>
          app.disabled ? (
            <div key={app.label} className="flex flex-col items-center gap-2.5 opacity-50">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-slate-300 to-slate-400 text-4xl shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_6px_14px_-6px_rgba(15,23,42,0.35)]">
                <span aria-hidden="true">{app.icon}</span>
                <span className="absolute -bottom-1.5 rounded-full bg-slate-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  준비중
                </span>
              </div>
              <span className="text-center text-xs font-medium text-slate-500">{app.label}</span>
            </div>
          ) : (
            <Link key={app.href} href={app.href} className="group flex flex-col items-center gap-2.5">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br ${app.gradient} text-4xl shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_8px_18px_-6px_rgba(15,23,42,0.45)] transition-all duration-150 group-hover:-translate-y-1 group-hover:shadow-[0_12px_22px_-6px_rgba(15,23,42,0.5)] group-active:translate-y-0 group-active:scale-90`}
              >
                <span aria-hidden="true">{app.icon}</span>
              </div>
              <span className="text-center text-xs font-medium text-slate-700">{app.label}</span>
            </Link>
          )
        )}
      </div>
    </main>
  );
}
