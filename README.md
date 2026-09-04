# 차량 손상 AI 진단

경미손상 판정기준에 따라 파손 사진(+선택적으로 선견적)을 검토해 근거를 갖춘
판정 결과를 생성하는 내부 도구입니다.

## 스택

- Next.js (App Router) — 프론트+백엔드, Vercel 배포
- Neon (Postgres) + Prisma — 진단 이력 + 사진(바이너리)까지 한 곳에 저장
- OpenAI GPT-4o (Vision) — 손상유형 판정 (사진은 base64로 직접 전달)

## 로컬 실행

```bash
npm install
cp .env.example .env
# .env에 OPENAI_API_KEY, DATABASE_URL, DIRECT_URL 채우기
npx prisma migrate dev --name init
npm run dev
```

## 배포 (Vercel)

1. Vercel에 이 저장소 연결
2. 프로젝트 설정 → Storage → **Neon** 통합 추가 (DATABASE_URL / DIRECT_URL 자동 주입)
3. 환경변수에 `OPENAI_API_KEY` 수동 추가
4. 배포 시 빌드 커맨드에서 `prisma migrate deploy`가 실행되도록
   `package.json`의 `build` 스크립트를 `prisma migrate deploy && next build`로
   맞추거나, 배포 전 `npx prisma migrate deploy`를 한 번 수동 실행

## 참고

- GPT 판정 프롬프트는 `src/lib/assessment-prompt.ts`에 있고, 버전 태그
  (`PROMPT_VERSION_TAG`)가 바뀔 때마다 `PromptVersion` 테이블에 새 레코드로
  기록해 오답 리뷰 → 프롬프트 개선 루프에 활용합니다.
- 지금은 "경미손상(판금·도장 유형판정)" 범위로 한정되어 있고, 표준작업시간/
  부수작업 허용목록 조회(참고자료 자동 주입)는 아직 연결되지 않았습니다 —
  다음 단계로 추가 예정.
