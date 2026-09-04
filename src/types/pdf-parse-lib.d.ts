// pdf-parse의 패키지 루트(index.js)는 번들러 환경에서 부작용이 있어
// 내부 구현(lib/pdf-parse.js)을 직접 import한다 — 그 경로엔 타입 선언이
// 없어서 @types/pdf-parse와 동일한 시그니처로 선언해줌.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse from "pdf-parse";
  export = PdfParse;
}
