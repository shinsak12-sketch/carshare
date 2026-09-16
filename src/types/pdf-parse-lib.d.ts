// pdf-parse의 패키지 루트(index.js)는 번들러 환경에서 부작용이 있어
// 내부 구현(lib/pdf-parse.js)을 직접 import한다 — 그 경로엔 타입 선언이
// 없어서 @types/pdf-parse와 동일한 시그니처로 선언해줌.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse from "pdf-parse";
  export = PdfParse;
}

// pdf-parse가 번들한 pdf.js 빌드를 직접 써서 텍스트 위치(x,y)까지 얻기 위함 — 견적서 표 파싱용
declare module "pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js" {
  export interface PdfTextItem {
    str: string;
    transform: number[];
    width: number;
    height: number;
  }
  export interface PdfPageProxy {
    getTextContent(): Promise<{ items: PdfTextItem[] }>;
  }
  export interface PdfDocumentProxy {
    numPages: number;
    getPage(n: number): Promise<PdfPageProxy>;
  }
  export function getDocument(src: { data: Uint8Array }): {
    promise: Promise<PdfDocumentProxy>;
  };
}
