-- 쉼표 익명 분포 집계 스키마 (준비물 — 백엔드 연결 시 활성화)
-- 원칙: 신원 항목 0개, 원천이 아닌 구간 값, 로컬 트래커와 동일 필드
-- 활성화: REMOTE_AGGREGATION 플래그 + anon 키만으로 동작 (RLS: insert-only, select는 서비스 롤만)

create table if not exists anon_scores (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  age_band     text not null check (age_band in ('20s','30s','40s','50s','60s')),
  net_band     text not null,  -- 예: '3-5eok' (구간 라벨만)
  fin_ratio    text not null,  -- 예: '40-60pct'
  retire_goal  int  null       -- 은퇴 목표 나이 (선택)
);

-- 익명 insert만 허용 (anon 키): read는 정책상 불가 → 집계는 운영자가 서비스 롤로
alter table anon_scores enable row level security;
create policy "anon insert only" on anon_scores
  for insert to anon with check (true);
-- select 정책 없음 = 익명 열람 차단
