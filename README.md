# 쉼표 (shimpyo) — 배포 가이드

**라이브**: https://developjik.github.io/shimpyo/ · repo: https://github.com/developjik/shimpyo · 배포일 2026-08-17 (Seed Design 리뉴얼 v1.0)

## 프레임워크 (2026-08-17 리뉴얼)

- **Vite 6 + React 19 + TypeScript + 당근 Seed Design** (@seed-design/react 2.3 · css 2.5 · vite-plugin 2.1, Apache-2.0)
- 계산 엔진은 DOM 없는 순수 모듈 `src/lib/engine.ts` — 앱과 CI 골든 러너가 같은 소스 공유 (복제본 이중관리 없음)
- 골든 러너: `npm run golden` (Node 내장 --experimental-strip-types, esbuild 불필요)
- 테마: 시스템/라이트/다크 3단 토글 (data-seed-color-mode, localStorage shimpyo.theme)
- L0 문서 4편(public/)은 Seed 라이트 팔레트에 맞춰 리스타일

**주의 (운영)**: Pages는 Fastly 캐시(TTL ~10분)를 앞에 두고 있어 배포 직후 구 index.html이 보일 수 있음 — 구 JS 해시 404는 이 캐시 때문. 10분 후 재확인할 것.

Phase 2 산출. GitHub Pages 정적 배포 + ECOS 월간 자동갱신 + 골든 케이스 배포 차단까지 전부 준비된 상태.

## 파일 구성

```
shimpyo/ (Vite 루트)
├── index.html               Vite 엔트리 (data-seed 테마 속성 + OG 메타)
├── src/
│   ├── main.tsx / App.tsx / store.ts / styles.css
│   ├── lib/engine.ts        계산 엔진 (DOM 없음 — 앱/CI 공유, 골든 15개)
│   └── views/               Sim · BT · Band · Rules · Golden · About (6탭)
├── seed-design/             CLI로 복사된 SEED 스니펫 (내 소스 — 수정 가능)
├── public/                  L0 문서 4편 + robots.txt + .nojekyll (dist 루트로 복사됨)
├── .github/workflows/
│   ├── ci.yml               푸시마다 골든 + 프로덕션 빌드 검증
│   ├── deploy.yml           골든 통과 → 빌드 → Pages 배포 (Actions 방식)
│   └── monthly-data-update.yml 매월 5일 ECOS 갱신 + 회귀 + 빌드 + 커밋
├── scripts/                 ecos_update.py · golden_runner.ts · update_freshness.mjs
├── supabase/schema.sql      익명 분포 원격 집계 준비물 (insert-only RLS)
└── data/                    (Actions 생성) ecos_snapshot.json, freshness.json
```

## 배포 절차 (사용자가 직접 할 일 3가지)

1. ~~**도메인 등록**~~ → **추후 결정** (2026-08-17): 초기 테스트는 github.io URL로 진행. 커뮤니티 링크 확산·검색 노출이 자리잡으면 그때 shimpyo.kr(+.dev) 등록 후 Custom domain 연결. 나중 연결 시 기존 github.io 주소는 새 도메인로 301 리다이렉트되므로 지금 퍼진 링크는 죽지 않음.
2. ~~**저장소 생성·푸시**~~ → **완료** (2026-08-17, gh CLI + device auth)
3. **ECOS 키 발급** → 남음: https://ecos.bok.or.kr 오픈API 신청(무료) → repo Settings → Secrets and variables → Actions → `ECOS_KEY` 등록. 등록 전까지 워크플로는 골든 케이스만 돌고 데이터 수집을 건너뛰도록 설계됨.

그다음은 자동:
- ~~Settings → Pages → main 루트 지정~~ → **완료** (API로 활성화, HTTPS 강제 적용됨) — https://developjik.github.io/shimpyo/
- 도메인 연결 시: Pages → Custom domain에 shimpyo.kr 입력, DNS A/CNAME 레코드 안내대로 세팅, HTTPS 대기 후 Enforce
- Actions가 매월 5일 06:00 KST에 ECOS를 받아 회귀 테스트 → 전부 PASS일 때만 커밋/배포 (ECOS 키 등록 후 활성화)

## 유지보수 캘린더 (죽음 테스트)

| 시점 | 할 일 | 도구 |
|---|---|---|
| 매월 5일 | ECOS 자동 갱신 + 골든 13케이스 자동 검증 | Actions (자동) |
| 매년 1~2월 | 고시 시즌: A값·건보료 단가·세율 구간 갱신 | rules 테이블 수동 + 골든 기대값 갱신 → 검증 탭에서 PASS 확인 |
| 6개월 무갱신 시 | 앱 헤더에 "상수 검증 N일 경과" 경고 배지 자동 표시 | stalenessCheck() (이미 구현됨) |
| 규칙 개정 뉴스 | rules_v0.json의 watchlist 7건 대조 | 문서화된 체크리스트 |
| 매일 07:30 | 법령 해시 diff (건보법·시행령·소득세법·조특법·국민연금법) | Actions law-watch (LAW_API_KEY 등록 후) |
| 데이터 변경 시 | `npm run snapshot` 으로 리니지 갱신 → 골든 재검증 | CI가 매니페스트 불일치를 차단 |

## 검증 상태 (2026-08-19, Phase 4 적용 후)

- 골든 케이스 **20/20 PASS** (기존 15 + MC G16~G20: 결정론·스냅샷·스트레스·양성·지속가능 인출률)
- 몬테카를로 v1: 역사 3년 블록 부트스트랩 단일 모델, 시드 고정(mulberry32) — 10k 경로 155ms (Node 기준)
- 데이터 스냅샷 리니지: manifest sha256 (US_CSV/KR_CSV/KR_DIV/ecos) CI 검증, 앱 푸터 "데이터 기준" 표시
- 콘솔 에러 0, 모바일 375px 오버플로우 0 (Phase 3 시점 — Phase 4 UI도 동일 기준으로 라이브 검증)
- 또래 밴드: 가계금융복지조사 2025본 (한은 통계표 + KOSIS 교차 일치)
- 백테스트: 미국 94.1% @4% (트리니티 정합), 한국 42.9% (PR) / 57.1% (TR 근사, 배당 토글)
- 인출 방식별 유효 인출률: 이자배당 3.20% / 해외매도 3.59% / 연금혼합 3.89% / 국내매도 3.96%

## Phase 4 — "측정과 첫 줄 답" (2026-08-19, 멀티 에이전트 토론 기반)

계획 문서: 쉼표 고도화 계획 v1 (5페르소나 × 2라운드 토론 합성). 구현 내용:

| 항목 | 상태 | 비고 |
|---|---|---|
| LICENSE (Apache-2.0) | ✅ | 포크 보험 (cFIREsim-open 방식) |
| sitemap.xml + robots Sitemap | ✅ | index + L0 6편 |
| Cloudflare Web Analytics | ⏸ 토큰 대기 | index.html 주석 스터브 — 발급 후 주석 해제 |
| 공유 루프: 상태 URL + `u=share` 채널코드 + 결과카드 PNG | ✅ | canvas 카드 (첫줄 답 + 3열 미니 + rules 칩) |
| 3질문 온보딩 → 첫 줄 답 → 3열 → 상세 (4단 구조) | ✅ | 상세는 전문가용 접힘 |
| Sim→L0 역방향 링크 (용어별) | ✅ | 4%/건보료/몇억/ISA/방법론/리포트0 |
| 또래 밴드 두 숫자 한 줄 (전세금 포함/제외) | ✅ | 가계금융복지조사 10분위 |
| 피드백: GitHub 이슈 프리필 | ✅ | 입력값 자동 첨부 |
| ISA 만기 데드라인 L0 + 절세 계산기 | ✅ | isa-2026.html (개편안 pending 라벨) |
| 몬테카를로 v1 (블록 부트스트랩, 워커, 골든 G16~G20) | ✅ | 방법론 문서 동반 |
| 방법론 문서 (표본 경계·꼬리 한계·리니지) | ✅ | methodology.html |
| 데이터 스냅샷 매니페스트 (sha256 + CI 검증) | ✅ | data/snapshots/manifest.json |
| 법령 감시 (국가법령정보센터 API, 일 1회) | ⏸ 키 대기 | law-watch.yml — LAW_API_KEY 등록 후 활성화 |
| 연금 수령 순서 엔진 | ⛔ 게이트 대기 | 온보딩 배포 2주 후 상세조건 진입자 연금·건보료 조정 ≥15% 시 착수 |
| giscus 댓글 / Supabase L2 | ⛔ 유보 | 제보 5건 / 유입 임계 도달 후 재검토 |

## Phase 5 — 실제 종목 배당 포트폴리오 (2026-08-22)

4개 에이전트 조사(데이터소스/포트폴리오/세제/UX) 기반. 골든 26/26 (G21~G24c 배당 6본 추가).

- **포트폴리오 탭** (신규): 프리셋 3종(월급통장/5050/배당성장) · 큐레이션 14종목(국내주식·국내ETF·미국직투·리츠) · 주수 입력 · 계좌별 세제(일반 15.4%·미국직투 15%(국내 0%)·ISA/연금 면세) · 월별 배당 캘린더(국내주 4월 집중 재현, 월 클릭 드릴다운)
- **세제 정정(중대)**: 미국 직투 배당의 국내 추가 원천징수는 0% (max(0,14%−15%)=0, 소득세법 §127의2) — 과거 오답(15.4% 추가) 수정. 국세청 보도자료·법제처 원문 기반
- **데이터 정책**: 직전 실적 확정 배당만, 특별배당 제외, 미검증 수치 status:pending 배지. 갱신은 분기 수동 큐레이션(DART/운용사/EDGAR)
- **Sim 연동**: 세후 연 배당 스칼라(divnet)가 SimState로 주입 — 첫 화면에 배당 카드, 공유 URL에 포함(중복계산 방지를 위해 표시 전용)

사용자 등록이 필요한 것 2가지:
1. **Cloudflare Web Analytics 토큰** — dash.cloudflare.com → Web Analytics → 사이트 추가 → 토큰 → index.html 내 `beaco_TOKEN_` 교체 후 주석 해제
2. **국가법령정보센터 Open API 키** — law.go.kr/openApi 가입 → repo Secrets에 `LAW_API_KEY` 등록 (ECOS_KEY와 동일 패턴, 미등록 시 우회 종료)

## 라이선스/출처 주의

- KOSPI 지수 수치는 재배포 금지 원칙으로 수익률(변환값)만 임베드, 원본은 ECOS/KRX 링크 처리
- 상업 전환 시 GitHub Pages 상업 제약 검토 + KRX 라이선스 재검토 (현행 비상업)
- 모든 제도 상수의 출처 URL은 앱 "근거·출처" 탭과 rules_v0.json에 있음
