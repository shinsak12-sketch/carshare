# 차량 손상 AI 진단

경미손상 판정기준에 따라 파손 사진(+선택적으로 선견적)을 검토해 근거를 갖춘
판정 결과를 생성하는 사내 직원 전용 도구입니다. 사번/비밀번호 로그인이
필요하며, 신규 계정은 관리자 승인 후 사용할 수 있습니다.

## 스택

- Next.js (App Router) — 프론트+백엔드, Vercel 배포
- Neon (Postgres) + Prisma — 계정, 진단 이력, 프롬프트 버전, 접속/활동 로그 저장
  (파손 사진은 저장소 절약을 위해 DB에 저장하지 않고, GPT 호출 시점에만
  메모리에서 base64로 사용 후 버립니다)
- OpenAI GPT-4o (Vision) — 손상유형 판정
- bcryptjs — 비밀번호 해시(솔트 라운드 12), DB 세션 기반 로그인(쿠키에는
  무작위 토큰만 저장)

## 계정 체계

- `/login` 사번+비밀번호 로그인 (일반 직원/관리자 공용)
- `/request-access` 신규 계정 권한 신청 → 관리자 승인 전까지 로그인 불가
- `/admin` 관리자 전용 페이지 (역할이 `ADMIN`인 계정만 접근 가능)
  - 계정 관리: 승인/거절/비활성화/재활성화/비밀번호 초기화/역할 변경
  - 진단 이력: 전체 진단 결과 조회 (일반 직원 화면에는 이력 메뉴가 없음)
  - 접속·활동 기록: 로그인 성공/실패/차단, 계정 관리 조작, AI 진단 실행 로그

로그인 실패가 15분 내 5회를 넘으면 해당 사번은 일시적으로 차단됩니다.

## 로컬 실행

```bash
npm install
cp .env.example .env
# .env에 OPENAI_API_KEY, DATABASE_URL, DIRECT_URL, ADMIN_INITIAL_PASSWORD 채우기
npx prisma migrate dev
npx prisma db seed   # 관리자 계정(ADMIN_EMPLOYEE_ID) + 샘플 케이스 생성
npm run dev
```

## 배포 (Vercel)

1. Vercel에 이 저장소 연결
2. 프로젝트 설정 → Storage → **Neon** 통합 추가 (DATABASE_URL / DIRECT_URL 자동 주입)
3. 환경변수에 `OPENAI_API_KEY`, `ADMIN_EMPLOYEE_ID`, `ADMIN_INITIAL_PASSWORD` 추가
   (`ADMIN_INITIAL_PASSWORD`는 반드시 강한 값으로 — 비워두면 기본값으로 생성되어 위험)
4. 배포 시 빌드 커맨드에서 `prisma migrate deploy`가 실행되도록
   `package.json`의 `build` 스크립트를 `prisma migrate deploy && next build`로
   맞춤 (이미 반영됨)
5. 최초 배포 후 `npx prisma db seed`를 한 번 실행해 관리자 계정을 만들고,
   `/login`으로 로그인 → 이후 계정 관리는 `/admin/accounts`에서 진행

## 참고

- GPT 판정 프롬프트는 `src/lib/assessment-prompt.ts`에 있고, 버전 태그
  (`PROMPT_VERSION_TAG`)가 바뀔 때마다 `PromptVersion` 테이블에 새 레코드로
  기록해 오답 리뷰 → 프롬프트 개선 루프에 활용합니다.
- 표준작업시간/방청제/ADAS검교정/타이어 참고자료는 `src/lib/reference-sections.ts`에서
  견적서 키워드 매칭으로 자동 첨부됩니다(벡터 검색 없는 경량 방식).
- 지금은 "경미손상(판금·도장 유형판정) + 전체 수리범위 적정성" 범위로
  한정되어 있고, 다른 손해사정 영역(대차료, 시세하락손해 등)은 아직 다루지
  않습니다.
