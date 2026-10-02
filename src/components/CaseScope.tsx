"use client";

import { setCaseScope } from "@/lib/case-store";

// 로그인한 사용자 ID로 브라우저 캐시(IndexedDB·localStorage) 범위를 잡는다.
// 렌더 중에 설정해야 자식 페이지의 effect(캐시 읽기)보다 먼저 적용된다.
export function CaseScope({ userId }: { userId: string }) {
  setCaseScope(userId);
  return null;
}
