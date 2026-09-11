// 업로드 전 브라우저에서 리사이즈/압축 — 폰 카메라 원본(장당 몇 MB)을 긴 변 1400px·JPEG 0.8로
// 줄여 Blob 업로드·GPT 처리 속도를 올림. 손상 판독엔 충분한 해상도.
export async function compressImage(
  file: File,
  maxDimension = 1400,
  quality = 0.8,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // 압축 실패 시 원본 그대로 진행 (구형 브라우저 등)
    return file;
  }
}
