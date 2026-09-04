import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">차량 손상 AI 진단</h1>
      <p className="text-slate-500">
        경미손상 판정기준에 따라 사진과 선견적을 검토하고, 근거를 갖춘 판정 결과를
        생성합니다.
      </p>
      <Link
        href="/assess/new"
        className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        신규 진단 시작
      </Link>
    </main>
  );
}
