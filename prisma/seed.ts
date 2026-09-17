import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { DEFAULT_RATE, DEFAULT_MODEL } from "../src/lib/pricing-defaults";

const prisma = new PrismaClient();

// 최초 관리자 계정 부트스트랩. 이 값들은 반드시 배포 환경변수로 덮어써야 함
// (기본값 그대로 두면 안 됨 — 첫 로그인 후 관리자 페이지에서 비밀번호를
// 초기화하거나, 배포 시점에 ADMIN_INITIAL_PASSWORD를 강한 값으로 지정할 것).
const ADMIN_EMPLOYEE_ID = process.env.ADMIN_EMPLOYEE_ID || "admin";
const ADMIN_NAME = process.env.ADMIN_NAME || "시스템 관리자";
const ADMIN_INITIAL_PASSWORD =
  process.env.ADMIN_INITIAL_PASSWORD || "changeme123!";

async function main() {
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.warn(
      "\n⚠ ADMIN_INITIAL_PASSWORD 환경변수가 설정되지 않아 기본 비밀번호(changeme123!)로 " +
        "관리자 계정을 생성/유지합니다. 이 값은 이 저장소에 공개된 값이라 위험합니다 — " +
        "지금 바로 Vercel 환경변수에 ADMIN_INITIAL_PASSWORD를 강한 값으로 지정하고 " +
        "재배포하거나, 로그인 후 관리자 페이지에서 비밀번호를 초기화하세요.\n",
    );
  }
  const adminPasswordHash = await hashPassword(ADMIN_INITIAL_PASSWORD);
  await prisma.user.upsert({
    where: { employeeId: ADMIN_EMPLOYEE_ID },
    update: {},
    create: {
      employeeId: ADMIN_EMPLOYEE_ID,
      name: ADMIN_NAME,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(
    `관리자 계정 준비 완료: 사번 ${ADMIN_EMPLOYEE_ID} (환경변수 ADMIN_INITIAL_PASSWORD로 초기 비밀번호 지정 안 했으면 기본값이니 로그인 후 반드시 변경할 것)`,
  );

  // 단가 초기값(예측치). 관리자 페이지 > 단가 에서 수정하면 이후 실행부터 적용됨.
  const existing = await prisma.pricingRate.findFirst({
    where: { model: DEFAULT_MODEL },
  });
  if (!existing) {
    await prisma.pricingRate.create({
      data: {
        model: DEFAULT_MODEL,
        updatedBy: "seed",
        note: "초기 단가(2026-09 실제 청구 1건으로 역산). 청구서와 다르면 수정",
        ...DEFAULT_RATE,
      },
    });
    console.log(`단가 초기값 등록: ${DEFAULT_MODEL}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
