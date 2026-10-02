"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtKst } from "@/lib/kst";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] transition-all duration-150 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
const primary =
  "rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-95 disabled:opacity-50";

export function TotpPanel({
  enabled,
  enabledAt,
}: {
  enabled: boolean;
  enabledAt: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "setup" | "codes" | "disable">(
    "idle",
  );
  const [qr, setQr] = useState<{ qrDataUrl: string; secret: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "처리에 실패했습니다.");
    return data;
  }

  async function startSetup() {
    setBusy(true);
    setError(null);
    try {
      const d = await post("/api/auth/totp/setup");
      setQr({ qrDataUrl: d.qrDataUrl, secret: d.secret });
      setPhase("setup");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    setBusy(true);
    setError(null);
    try {
      const d = await post("/api/auth/totp/enable", { code });
      setRecoveryCodes(d.recoveryCodes ?? []);
      setPhase("codes");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/totp/disable", { password, code });
      setPhase("idle");
      setCode("");
      setPassword("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  }

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 무시
    }
  }

  const card =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-16px_rgba(15,23,42,0.25)]";

  return (
    <section className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            2단계 인증 (인증 앱)
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${enabled ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}
            >
              {enabled ? "켜짐" : "꺼짐"}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {enabled && enabledAt
              ? `${fmtKst(enabledAt)}부터 사용 중. 로그인할 때 비밀번호 다음에 인증 앱 6자리 코드를 입력합니다.`
              : "Google Authenticator·Microsoft Authenticator 같은 앱의 6자리 코드를 로그인에 추가합니다. 비밀번호가 새도 코드 없이는 못 들어옵니다."}
          </p>
        </div>
        {phase === "idle" &&
          (enabled ? (
            <button
              onClick={() => setPhase("disable")}
              className="shrink-0 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 shadow-sm transition-all hover:bg-red-50 active:scale-95"
            >
              해제
            </button>
          ) : (
            <button
              onClick={startSetup}
              disabled={busy}
              className={`shrink-0 ${primary}`}
            >
              {busy ? "준비 중…" : "설정 시작"}
            </button>
          ))}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {phase === "setup" && qr && (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.qrDataUrl}
              alt="QR"
              className="h-[220px] w-[220px] rounded-lg bg-white p-1"
            />
            <p className="text-center text-[11px] text-slate-500">
              QR을 못 찍으면 수동 입력:
              <br />
              <code className="font-mono text-xs font-bold tracking-wider text-slate-800">
                {qr.secret}
              </code>
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <ol className="list-decimal pl-5 text-sm leading-relaxed text-slate-700">
              <li>휴대폰에 인증 앱을 설치(Google Authenticator 등).</li>
              <li>앱에서 + → QR 스캔.</li>
              <li>앱에 뜬 6자리 코드를 아래에 입력하고 확인.</li>
            </ol>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className={`${inputClass} text-center font-mono text-lg tracking-[0.3em]`}
            />
            <div className="flex gap-2">
              <button
                onClick={confirmSetup}
                disabled={busy || code.length !== 6}
                className={primary}
              >
                {busy ? "확인 중…" : "확인하고 켜기"}
              </button>
              <button
                onClick={() => setPhase("idle")}
                className="rounded-full px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "codes" && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            2단계 인증이 켜졌습니다. 복구 코드를 지금 저장하세요.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            휴대폰을 잃어버리면 이 코드로 로그인합니다. 각 코드는 한 번만 쓸 수
            있고, 이 화면을 닫으면 다시 볼 수 없습니다.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm font-bold text-slate-900 sm:grid-cols-4">
            {recoveryCodes.map((c) => (
              <span
                key={c}
                className="rounded-lg bg-white px-2 py-1.5 text-center shadow-sm"
              >
                {c}
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={copyCodes} className={primary}>
              {copied ? "복사됨 ✓" : "복사"}
            </button>
            <button
              onClick={() => {
                setPhase("idle");
                router.refresh();
              }}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700"
            >
              저장했음, 닫기
            </button>
          </div>
        </div>
      )}

      {phase === "disable" && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            해제하려면 비밀번호와 현재 인증 앱 코드를 입력하세요.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            autoComplete="current-password"
            className={inputClass}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className={`${inputClass} text-center font-mono tracking-[0.3em]`}
          />
          <div className="flex gap-2">
            <button
              onClick={disable}
              disabled={busy || !password || code.length !== 6}
              className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 disabled:opacity-50"
            >
              {busy ? "해제 중…" : "2단계 인증 해제"}
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="rounded-full px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
