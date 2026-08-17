# 쉼표 (shimpyo) — 배포 가이드

Phase 2 산출. GitHub Pages 정적 배포 + ECOS 월간 자동갱신 + 골든 케이스 배포 차단까지 전부 준비된 상태.

## 파일 구성

```
shimpyo/
├── index.html                  앱 (6뷰: 시뮬레이터/백테스트/또래 밴드/근거/검증/방법론)
├── myeoneok.html               L0 문서 1 — 몇억이면 되나 (SEO 랜딩)
├── four-percent.html           L0 문서 2 — 4% 룰 한국 데이터
├── hi-bomb.html                L0 문서 3 — 건보료 폭탄 완전 정리
├── report-0.html               발표 #0 — 또래 밴드 리포트 (가계금융복지조사 2025)
├── .github/workflows/
│   └── monthly-data-update.yml 매월 5일 ECOS 갱신 + 회귀 테스트 + 실패 시 배포 차단
├── scripts/
│   ├── ecos_update.py          ECOS API 호출 (키 필요)
│   ├── golden_runner.mjs       CI 골든 케이스 (index.html 로직 직접 로드 — 복제본 아님)
│   └── update_freshness.mjs    데이터 신선도 기록
├── supabase/
│   └── schema.sql              익명 분포 원격 집계 준비물 (insert-only RLS, 신원 0항목)
└── data/                       (Actions가 생성) ecos_snapshot.json, freshness.json
```

## 배포 절차 (사용자가 직접 할 일 3가지)

1. **도메인 등록** — shimpyo.kr (주력) + shimpyo.dev (방어). 2026-08-17 rdap 실측 전부 미등록 상태였음. .kr은 후이즈/가비아 등에서 등록.
2. **저장소 생성** — GitHub에서 새 repo 생성 후 이 폴더 전체를 푸시. (developjik 계정, main 브랜치 루트 배포 — 고래지도와 동일 패턴)
3. **ECOS 키 발급** — https://ecos.bok.or.kr 오픈API 신청(무료) → repo Settings → Secrets → Actions에 `ECOS_KEY` 등록.

그다음은 자동:
- Settings → Pages → main 루트 지정 → https://developjik.github.io/{repo} 로 배포
- 도메인 연결: Pages → Custom domain에 shimpyo.kr 입력, DNS A/CNAME 레코드 안내대로 세팅
- Actions가 매월 5일 06:00 KST에 ECOS를 받아 회귀 테스트 → 전부 PASS일 때만 커밋/배포

## 유지보수 캘린더 (죽음 테스트)

| 시점 | 할 일 | 도구 |
|---|---|---|
| 매월 5일 | ECOS 자동 갱신 + 골든 13케이스 자동 검증 | Actions (자동) |
| 매년 1~2월 | 고시 시즌: A값·건보료 단가·세율 구간 갱신 | rules 테이블 수동 + 골든 기대값 갱신 → 검증 탭에서 PASS 확인 |
| 6개월 무갱신 시 | 앱 헤더에 "상수 검증 N일 경과" 경고 배지 자동 표시 | stalenessCheck() (이미 구현됨) |
| 규칙 개정 뉴스 | rules_v0.json의 watchlist 7건 대조 | 문서화된 체크리스트 |

## 검증 상태 (2026-08-17, Phase 3 종료 시점)

- 골든 케이스 15/15 PASS (국민연금 G1~G3 공단 10원 단위 일치 · 별표4 G11/G12 원문 일치)
- 콘솔 에러 0, 모바일 375px 6뷰(밴드 포함) 오버플로우 0
- 또래 밴드: 가계금융복지조사 2025본 (한은 통계표 + KOSIS 교차 일치, 산술 검증 완료)
- 백테스트: 미국 94.1% @4% (트리니티 정합), 한국 42.9% (PR) / 57.1% (TR 근사, 배당 토글)
- 인출 방식별 유효 인출률: 이자배당 3.20% / 해외매도 3.59% / 연금혼합 3.89% / 국내매도 3.96%

## 라이선스/출처 주의

- KOSPI 지수 수치는 재배포 금지 원칙으로 수익률(변환값)만 임베드, 원본은 ECOS/KRX 링크 처리
- 상업 전환 시 GitHub Pages 상업 제약 검토 + KRX 라이선스 재검토 (현행 비상업)
- 모든 제도 상수의 출처 URL은 앱 "근거·출처" 탭과 rules_v0.json에 있음
