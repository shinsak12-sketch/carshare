import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">차량 손상 AI 진단</h1>
      <p className="text-slate-500">
        경미손상 판정기준에 따라 사진과 선견적을 검토하고, 근거를 갖춘 판정 결과를
        생성합니다.
      </p>
      <div className="flex gap-3">
        <Link
          href="/assess/new"
          className="rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_8px_20px_-6px_rgba(37,99,235,0.55)] active:translate-y-0 active:scale-95"
        >
          신규 진단 시작
        </Link>
        <Link
          href="/history"
          className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md active:translate-y-0 active:scale-95"
        >
          진단 이력 보기
        </Link>
      </div>
    </main>
  );
}
