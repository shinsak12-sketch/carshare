// AI손해사정 새 화면(/adjustment/new, /api/adjustment-lab)이 쓰는 프롬프트.
// 실험 단계에서 복제본으로 시작했지만 지금은 원본과 같은 내용이라 재수출만 한다 —
// 프롬프트 수정은 adjustment-prompt.ts 한 곳에서.
export {
  ADJUSTMENT_PROMPT_VERSION_TAG,
  ADJUSTMENT_SYSTEM_PROMPT,
  ADJUSTMENT_RESPONSE_SCHEMA,
} from "./adjustment-prompt";
