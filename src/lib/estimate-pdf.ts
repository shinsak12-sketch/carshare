export function isPdfFile(file: File): boolean {
  // 모바일 브라우저/파일 앱에 따라 PDF의 file.type이 빈 문자열이나
  // "application/octet-stream"으로 잘못 잡히는 경우가 있어, 확장자도 같이 확인함.
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function extractEstimateText(file: File): Promise<string> {
  // pdf-parse의 패키지 루트(index.js)는 require.main 체크가 번들러 환경에서
  // 오작동해 테스트용 하드코딩 파일을 읽으려다 ENOENT가 남 — 내부 구현을
  // 직접 import해서 그 부작용을 우회함.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdfParse(buffer);
  return result.text;
}
