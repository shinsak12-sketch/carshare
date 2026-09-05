import Link from "next/link";

interface AppTile {
  href: string;
  label: string;
  icon: string;
  gradient: string;
}

// 나중에 기능이 늘어나면 여기에 항목만 추가하면 홈 화면 아이콘이 늘어남.
const APPS: AppTile[] = [
  {
    href: "/assess/new",
    label: "선견적진단",
    icon: "🚗",
    gradient: "from-blue-500 to-blue-700",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="grid grid-cols-4 gap-x-4 gap-y-7 sm:grid-cols-5">
        {APPS.map((app) => (
          <Link key={app.href} href={app.href} className="group flex flex-col items-center gap-2">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br ${app.gradient} text-3xl shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_8px_18px_-6px_rgba(15,23,42,0.45)] transition-all duration-150 group-hover:-translate-y-1 group-hover:shadow-[0_12px_22px_-6px_rgba(15,23,42,0.5)] group-active:translate-y-0 group-active:scale-90`}
            >
              <span aria-hidden="true">{app.icon}</span>
            </div>
            <span className="text-center text-xs font-medium text-slate-700">{app.label}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
