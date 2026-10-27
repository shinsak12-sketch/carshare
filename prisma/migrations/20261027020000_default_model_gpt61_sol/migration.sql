-- 기본 모델 교체: 관리자 설정에 이전 기본(gpt-5.6-sol)이 저장돼 있으면 gpt-6.1-sol로 치환.
-- 관리자가 다른 모델을 골라둔 경우는 건드리지 않음.
UPDATE "AppSetting"
SET "value" = jsonb_set("value", '{model}', '"gpt-6.1-sol"'::jsonb)
WHERE "key" = 'ai-model'
  AND ("value" ->> 'model') = 'gpt-5.6-sol';
