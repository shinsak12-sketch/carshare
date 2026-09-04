"use client";

import { useState } from "react";

type Role = "EMPLOYEE" | "ADMIN";
type Status = "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED";

interface AccountRow {
  id: string;
  employeeId: string;
  name: string;
  role: Role;
  status: Status;
  requestNote: string | null;
  createdAt: string;
}

const statusBadge: Record<Status, string> = {
  PENDING: "bg-amber-600",
  ACTIVE: "bg-emerald-600",
  REJECTED: "bg-slate-400",
  DISABLED: "bg-red-600",
};

const statusLabel: Record<Status, string> = {
  PENDING: "승인 대기",
  ACTIVE: "활성",
  REJECTED: "거절됨",
  DISABLED: "비활성화",
};

export function AccountsTable({ initialUsers }: { initialUsers: AccountRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  async function callAction(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "처리에 실패했습니다.");
      if (data.user) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...data.user } : u)));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleResetPassword(id: string) {
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    const ok = await callAction(id, { action: "reset_password", newPassword });
    if (ok) {
      setResetTargetId(null);
      setNewPassword("");
    }
  }

  const pending = users.filter((u) => u.status === "PENDING");
  const others = users.filter((u) => u.status !== "PENDING");

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-amber-800">승인 대기 ({pending.length})</h2>
          {pending.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{u.name}</span>
                  <span className="font-mono text-xs text-slate-500">{u.employeeId}</span>
                </div>
                {u.requestNote && <p className="mt-1 text-xs text-slate-600">신청 사유: {u.requestNote}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  신청일 {new Date(u.createdAt).toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busyId === u.id}
                  onClick={() => callAction(u.id, { action: "approve" })}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-700 active:translate-y-0 active:scale-95 disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  disabled={busyId === u.id}
                  onClick={() => callAction(u.id, { action: "reject" })}
                  className="rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 transition-all duration-150 hover:-translate-y-0.5 hover:bg-red-50 active:translate-y-0 active:scale-95 disabled:opacity-50"
                >
                  거절
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-slate-700">전체 계정 ({others.length})</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-500">
                <th className="px-4 py-3 font-semibold">사번 / 이름</th>
                <th className="px-4 py-3 font-semibold">역할</th>
                <th className="px-4 py-3 font-semibold">상태</th>
                <th className="px-4 py-3 font-semibold">가입일</th>
                <th className="px-4 py-3 font-semibold">작업</th>
              </tr>
            </thead>
            <tbody>
              {others.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="font-mono text-xs text-slate-400">{u.employeeId}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busyId === u.id}
                      onClick={() =>
                        callAction(u.id, { action: "set_role", role: u.role === "ADMIN" ? "EMPLOYEE" : "ADMIN" })
                      }
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-all duration-150 hover:bg-slate-100 active:scale-95 disabled:opacity-50"
                      title="클릭하여 역할 전환"
                    >
                      {u.role === "ADMIN" ? "관리자" : "일반직원"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold text-white ${statusBadge[u.status]}`}
                    >
                      {statusLabel[u.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.status === "ACTIVE" && (
                        <button
                          disabled={busyId === u.id}
                          onClick={() => callAction(u.id, { action: "disable" })}
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                        >
                          비활성화
                        </button>
                      )}
                      {(u.status === "DISABLED" || u.status === "REJECTED") && (
                        <button
                          disabled={busyId === u.id}
                          onClick={() => callAction(u.id, { action: "enable" })}
                          className="rounded-full border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-all duration-150 hover:bg-emerald-50 active:scale-95 disabled:opacity-50"
                        >
                          재활성화
                        </button>
                      )}

                      {resetTargetId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="새 비밀번호 (8자 이상)"
                            className="w-40 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] outline-none focus:border-blue-500"
                          />
                          <button
                            disabled={busyId === u.id}
                            onClick={() => handleResetPassword(u.id)}
                            className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white active:scale-95 disabled:opacity-50"
                          >
                            확인
                          </button>
                          <button
                            onClick={() => {
                              setResetTargetId(null);
                              setNewPassword("");
                            }}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResetTargetId(u.id)}
                          className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-95"
                        >
                          비밀번호 초기화
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {others.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    등록된 계정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
