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
    <main className="relative flex min-h-[calc(100dvh-57px)] items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-200/40 via-orange-100/30 to-transparent blur-3xl lg:h-[720px] lg:w-[720px]"
      />

      <div className="relative flex flex-col items-center gap-10 lg:gap-14">
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-900 lg:text-xl">차량 손상 AI 진단</h1>
          <p className="mt-1 text-sm text-slate-400">원하는 기능을 선택하세요</p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-10 gap-y-10 sm:gap-x-12 lg:gap-x-16 lg:gap-y-12">
          {APPS.map((app) =>
            app.disabled ? (
              <div key={app.label} className="flex flex-col items-center gap-3 opacity-50">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-slate-300 to-slate-400 text-4xl shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_-3px_6px_rgba(15,23,42,0.15)_inset,0_10px_20px_-8px_rgba(15,23,42,0.4)] sm:h-24 sm:w-24 sm:text-[2.75rem] lg:h-28 lg:w-28 lg:text-5xl">
                  <span aria-hidden="true">{app.icon}</span>
                  <span className="absolute -bottom-2 rounded-full bg-slate-600 px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white shadow-sm">
                    준비중
                  </span>
                </div>
                <span className="text-center text-xs font-medium text-slate-500 lg:text-sm">{app.label}</span>
              </div>
            ) : (
              <Link key={app.href} href={app.href} className="group flex flex-col items-center gap-3">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br ${app.gradient} text-4xl shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_-3px_6px_rgba(0,0,0,0.15)_inset,0_10px_22px_-8px_rgba(15,23,42,0.5)] transition-all duration-150 group-hover:-translate-y-1.5 group-hover:shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_-3px_6px_rgba(0,0,0,0.15)_inset,0_16px_28px_-8px_rgba(15,23,42,0.55)] group-active:translate-y-0 group-active:scale-90 group-active:shadow-[0_2px_4px_rgba(0,0,0,0.25)_inset] sm:h-24 sm:w-24 sm:text-[2.75rem] lg:h-28 lg:w-28 lg:text-5xl`}
                >
                  <span aria-hidden="true">{app.icon}</span>
                </div>
                <span className="text-center text-xs font-medium text-slate-700 lg:text-sm">{app.label}</span>
              </Link>
            )
          )}
        </div>
      </div>
    </main>
  );
}
