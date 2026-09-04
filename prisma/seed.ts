import { PrismaClient } from "@prisma/client";
import { PROMPT_VERSION_TAG, SYSTEM_PROMPT } from "../src/lib/assessment-prompt";
import type { AssessmentResult } from "../src/lib/assessment-types";

const prisma = new PrismaClient();

// 실제 접수된 선견적(202607765851)을 사람이 직접 검토해서 만든 샘플 케이스.
// 사진은 채팅에 직접 붙여넣어진 것이라 파일로 저장할 경로가 없어 이번 샘플엔
// 이미지가 없음 — 실제 파일로 첨부되면 images 관계로 추가할 것.
const NIRO_ESTIMATE_TEXT = `
접수번호: 202607765851 / 사고일자: 2026-08-26 / 청구일자: 2026-08-31
업체: 제이에스모터스 (울산 울주군) / 담보: 대물

[청구 내역]
1. 리어범퍼어셈블리 교환 (2.9H, 탈착교환 132,250원)
2. 커버-리어 범퍼 상부 (부품 105,000원)
3~6. 몰딩/스테이 어셈블리 좌우 (부품 각 2,600~9,800원)
7. 리어범퍼 교환 컬러서페이서 도장 (2.64H, 재료 65,900원 + 공임 83,530원)
8~9. 리어범퍼언더커버(사이드) 좌/우 탈착 (각 0.14H)
10. 후방감지센서 탈착 (0.3H)
11~12. 리어컴비네이션램프 좌/우 탈착 (각 0.28H)
13~14. 머드가드(리어) 좌/우 탈착 (각 0.07H)
15. 컬러매칭 도장 (1.9H)
16. 가열건조비

청구액 합계: 557,006원 (부품 129,800 + 공임 376,569 + 부가세 50,637)
`.trim();

const NIRO_AI_RESULT: AssessmentResult = {
  estimate_provided: true,
  overall_repair_scope_review: {
    appropriate: false,
    concerns: [
      {
        item: "리어범퍼어셈블리 전체 교환",
        issue: "사진상 확인되는 손상은 표면 스크래치 수준으로, 범퍼 전체를 교환할 정도의 " +
          "소재 손상(구멍, 파단 등)이 보이지 않습니다.",
        reasoning: "일반적인 충돌수리 정비 절차상 이 정도의 표면 손상은 판금·도장 복원으로 " +
          "처리 가능한 범위이며, 전체 교환은 손상 규모 대비 과잉수리로 판단됩니다.",
      },
    ],
  },
  parts: [
    {
      part_name: "리어범퍼어셈블리",
      claimed_action: "교환",
      damage_type: "2유형",
      reasoning:
        "사진상 범퍼 코너~쿼터패널 하단부에 선형 스크래치 여러 줄이 확인됨. 흰색 차량 " +
        "특성상 투명 코팅막 손상(1유형)인지 도장막(색상)까지 손상된 것(2유형)인지 육안 " +
        "구분이 쉽지 않으나, 스크래치 폭과 진하기로 볼 때 도장막까지 손상된 2유형에 " +
        "가깝다고 판단함. 함몰·찌그러짐 등 소재 변형이나 구멍·파단은 사진에서 확인되지 " +
        "않아 3유형 이상 가능성은 낮음. 경미손상 교환 인정 예외조건(수리비>교환비, " +
        "이중패널 이탈, 파단·천공, 복원 불가)에 해당하는 근거도 사진상 확인되지 않음.",
      evidence_confidence: "낮음",
      labor_time_check: {
        claimed_h: 2.9,
        reference_h: null,
        reference_verdict: "기준 미제공 - 확인 필요",
        general_assessment: "과다 의심",
        note: "표면 스크래치 수준의 손상 대비 전체 교환(탈부착 2.9H)은 정비 절차상 " +
          "과다한 작업범위로 판단됩니다. 판금·도장 복원으로 대체 가능할 것으로 보입니다.",
      },
      ancillary_work_check: [
        {
          item: "리어범퍼언더커버(사이드) 좌/우 탈착",
          in_allowed_list: null,
          mechanically_plausible: true,
          note: "범퍼 탈거 시 언더커버가 겹치는 구조라 정비 절차상 통상 필요. 다만 범퍼 " +
            "교환 자체가 협의대상이므로 함께 재검토 필요",
        },
        {
          item: "후방감지센서 탈착",
          in_allowed_list: null,
          mechanically_plausible: true,
          note: "범퍼에 매립된 센서라 범퍼 탈거 시 정비 절차상 통상 수반됨. 상동 사유로 재검토 필요",
        },
        {
          item: "리어컴비네이션램프 좌/우 탈착",
          in_allowed_list: null,
          mechanically_plausible: true,
          note: "범퍼 코너와 결합부가 겹치는 차종이 많아 통상 필요. 상동",
        },
        {
          item: "머드가드(리어) 좌/우 탈착",
          in_allowed_list: null,
          mechanically_plausible: true,
          note: "범퍼 하단 체결부와 겹쳐 통상 필요. 상동",
        },
      ],
      verdict: "협의대상",
      required_action:
        "손상 부위 근접·측광 사진 추가 확보(색상층 노출 여부, 함몰 유무 확인용) 필요. " +
        "소재손상이 확인되지 않을 경우 교환이 아닌 경미손상 1~2유형(폴리싱 또는 보수도장) 기준 재산정 검토.",
    },
  ],
  claimed_but_not_visible: [
    "리어범퍼 소재손상(구멍·파단 등 교환 사유) - 사진상 표면 스크래치만 확인되고 " +
      "소재 파손·변형 흔적은 확인되지 않음",
  ],
  damage_but_not_claimed: [],
  other_findings: [],
  physical_consistency: { consistent: true, warning: "" },
  overall_opinion:
    "청구액 557,006원 중 대부분(범퍼 부품비 129,800원 + 교환·도장 공임 다수)이 '전체 교환' " +
    "전제로 산정되어 있으나, 제공된 사진 근거로는 경미손상 기준상 교환을 정당화할 손상(소재 " +
    "파손·파단 등)이 확인되지 않음. 실물 확인 또는 근접 사진 추가 확보 전까지 협의 대상으로 분류를 권고함.",
  disputed_items: [
    "리어범퍼어셈블리 교환 인정 여부",
    "교환 전제 부수작업(언더커버·후방감지센서·컴비네이션램프·머드가드) 탈착공임 인정 여부",
  ],
};

async function main() {
  const promptVersion = await prisma.promptVersion.upsert({
    where: { id: "seed-prompt-v1" },
    update: {},
    create: {
      id: "seed-prompt-v1",
      createdBy: "system",
      promptText: SYSTEM_PROMPT,
      changeSummary: `초기 버전 (${PROMPT_VERSION_TAG})`,
      isActive: true,
    },
  });

  await prisma.assessmentCase.upsert({
    where: { id: "seed-case-niro-202607765851" },
    update: {},
    create: {
      id: "seed-case-niro-202607765851",
      createdBy: "샘플 등록",
      manufacturer: "기아",
      model: "니로 (부품코드 기준 추정)",
      damagedPart: "리어범퍼",
      memo: "공업사 선견적 접수번호 202607765851 기준 샘플 케이스. 사진은 채팅 첨부분이라 파일 미저장.",
      estimateText: NIRO_ESTIMATE_TEXT,
      aiResult: NIRO_AI_RESULT as unknown as object,
      promptVersionId: promptVersion.id,
    },
  });

  console.log("샘플 케이스 등록 완료: 기아 니로 리어범퍼 (seed-case-niro-202607765851)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
