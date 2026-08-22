// ==========================================================
// 쉼표 종목 데이터 v1 — 2026Q3 큐레이션 (2026-08-22 검증)
// 원칙: 직전 실적의 '확정' 배당만, 특별배당 제외, 미검증 수치는 status:"pending"
// 출처 tier: 1=공시/공식보도 2=운용사 공식 3=집계사이트(교차확인)
// 갱신: 분기 1회 수동 큐레이션 (DART/운용사/EDGAR) — 방법론 문서 참조
// ==========================================================

export type Market = "KR_STOCK" | "KR_ETF" | "US" | "REIT_KR";
export type Freq = "monthly" | "quarterly" | "semiannual" | "annual";
export type Status = "confirmed" | "pending";

export interface Instrument {
  id: string;            // 티커/종목코드
  name: string;
  market: Market;
  cat: string;           // 카테고리 칩 라벨
  divPerShare: number;   // 연간 주당 배당 (KRW 또는 USD)
  currency: "KRW" | "USD";
  fx?: number;           // USD → KRW 환산율 (고정값, asOf 표기)
  freq: Freq;
  payMonths: number[];   // 실제 지급월 (1~12)
  yieldLabel: string;    // 표시용 배당률 (계산에 미사용)
  taxNote: string;       // 세제 한 줄
  src: { tier: 1 | 2 | 3; label: string; url: string };
  verified: string;      // 검증일
  status: Status;
}

export const FX_USD = 1340; // 환산 고정값 — 2026-08 기준, asOf 라벨과 함께 표시

export const INSTRUMENTS: Instrument[] = [
  // ── 국내 주식 ──
  {
    id: "005930", name: "삼성전자", market: "KR_STOCK", cat: "국내주식",
    divPerShare: 1444, currency: "KRW", freq: "quarterly", payMonths: [4, 5, 8, 11],
    yieldLabel: "0.54%", taxNote: "국내 원천 15.4% · 금종과세 합산",
    src: { tier: 1, label: "2024년 배당 총합(분기 361×4), 특별배당 제외 — 공시 보도", url: "https://dart.fss.or.kr" },
    verified: "2026-08-22", status: "confirmed",
  },
  {
    id: "024110", name: "기업은행", market: "KR_STOCK", cat: "국내주식",
    divPerShare: 2080, currency: "KRW", freq: "quarterly", payMonths: [4, 8, 10, 12],
    yieldLabel: "4.8%", taxNote: "국내 원천 15.4% · 2026년 분기 전환",
    src: { tier: 3, label: "2026년 분기 지급 실적(4월 1,048원 등) — 집계", url: "https://investing.com" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "000810", name: "삼성화재", market: "KR_STOCK", cat: "국내주식",
    divPerShare: 12000, currency: "KRW", freq: "annual", payMonths: [4],
    yieldLabel: "3.14%", taxNote: "국내 원천 15.4%",
    src: { tier: 3, label: "배당률 3.14%(2026-01) 기준 환산 — 주당액 공시 확인 필요", url: "https://investing.com" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "033780", name: "KT&G", market: "KR_STOCK", cat: "국내주식",
    divPerShare: 5000, currency: "KRW", freq: "annual", payMonths: [5],
    yieldLabel: "3.84%", taxNote: "국내 원천 15.4%",
    src: { tier: 3, label: "배당률 3.84%(2026) 기준 환산 — 주당액 공시 확인 필요", url: "https://investing.com" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "271560", name: "오리온", market: "KR_STOCK", cat: "국내주식",
    divPerShare: 2000, currency: "KRW", freq: "annual", payMonths: [4],
    yieldLabel: "2.42%", taxNote: "국내 원천 15.4% · 배당 변동성 주의(2026-08 -50%)",
    src: { tier: 3, label: "배당률 2.42% 기준 환산 — 주당액 공시 확인 필요", url: "https://investing.com" },
    verified: "2026-08-22", status: "pending",
  },
  // ── 국내 ETF ──
  {
    id: "279530", name: "KODEX 고배당주", market: "KR_ETF", cat: "국내ETF",
    divPerShare: 1100, currency: "KRW", freq: "monthly", payMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
    yieldLabel: "4.09%", taxNote: "국내 원천 15.4% · 국내주식형이라 매매차익 비과세",
    src: { tier: 2, label: "삼성운용 공식 — 월분배, 배당률 4.09%(2026-08)", url: "https://www.samsungfund.com" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "489250", name: "KODEX 미국배당다우존스", market: "KR_ETF", cat: "국내ETF",
    divPerShare: 700, currency: "KRW", freq: "monthly", payMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
    yieldLabel: "3.34%", taxNote: "국내 원천 15.4% (펀드 미국세 차감 후 분배 구조)",
    src: { tier: 3, label: "SCHD 지수 추종 월배당 — 배당률 3.34%", url: "https://www.samsungfund.com" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "446720", name: "SOL 미국배당다우존스", market: "KR_ETF", cat: "국내ETF",
    divPerShare: 470, currency: "KRW", freq: "monthly", payMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
    yieldLabel: "2.85%", taxNote: "국내 원천 15.4%",
    src: { tier: 2, label: "신한운용 공식 월배당 — 배당률 2.85%", url: "https://www.shinsol.com" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "069500", name: "KODEX 200", market: "KR_ETF", cat: "국내ETF",
    divPerShare: 855, currency: "KRW", freq: "quarterly", payMonths: [1, 4, 7, 10],
    yieldLabel: "1.9%", taxNote: "국내 원천 15.4% · 매매차익 비과세",
    src: { tier: 3, label: "2025년 분배 총 855원(110+429+176+140) — 집계 교차확인", url: "https://investing.com" },
    verified: "2026-08-22", status: "confirmed",
  },
  // ── 리츠 ──
  {
    id: "088260", name: "이리츠코크렙", market: "REIT_KR", cat: "리츠",
    divPerShare: 340, currency: "KRW", freq: "semiannual", payMonths: [3, 9],
    yieldLabel: "7.58%", taxNote: "국내 원천 15.4% · 2025년 연배당 -10.3% 이력",
    src: { tier: 3, label: "배당률 7.58% 기준 환산 — 공시 확인 필요", url: "https://dart.fss.or.kr" },
    verified: "2026-08-22", status: "pending",
  },
  // ── 미국 직투 ──
  {
    id: "SCHD", name: "SCHD (Schwab 미국 배당 ETF)", market: "US", cat: "미국직투",
    divPerShare: 1.048, currency: "USD", fx: FX_USD, freq: "quarterly", payMonths: [3, 6, 9, 12],
    yieldLabel: "3.04%", taxNote: "미국 원천 15% · 국내 추가 징수 0% (한미조약)",
    src: { tier: 2, label: "2025년 $1.0476 (+5.35%) — Schwab 공식/S&P MI", url: "https://www.schwabassetmanagement.com/products/schd" },
    verified: "2026-08-22", status: "confirmed",
  },
  {
    id: "VOO", name: "VOO (Vanguard S&P500)", market: "US", cat: "미국직투",
    divPerShare: 7.07, currency: "USD", fx: FX_USD, freq: "quarterly", payMonths: [3, 6, 9, 12],
    yieldLabel: "1.3%", taxNote: "미국 원천 15% · 국내 추가 징수 0%",
    src: { tier: 3, label: "2025년 $7.07 — S&P MI 집계", url: "https://stockanalysis.com/etf/voo/dividend/" },
    verified: "2026-08-22", status: "confirmed",
  },
  {
    id: "JEPI", name: "JEPI (JPM 커버드콜)", market: "US", cat: "미국직투",
    divPerShare: 4.58, currency: "USD", fx: FX_USD, freq: "monthly", payMonths: [1,2,3,4,5,6,7,8,9,10,11,12],
    yieldLabel: "7.90%", taxNote: "미국 원천 15% · 월배당 변동 큼(커버드콜)",
    src: { tier: 3, label: "연 $4.58 — 집계(변동성 높음)", url: "https://stockanalysis.com/etf/jepi/dividend/" },
    verified: "2026-08-22", status: "pending",
  },
  {
    id: "VYM", name: "VYM (Vanguard 고배당)", market: "US", cat: "미국직투",
    divPerShare: 3.3, currency: "USD", fx: FX_USD, freq: "quarterly", payMonths: [3, 6, 9, 12],
    yieldLabel: "2.29%", taxNote: "미국 원천 15% · 국내 추가 징수 0%",
    src: { tier: 2, label: "배당률 2.29%(Vanguard 공식 2026-07) — 주당액 환산", url: "https://investor.vanguard.com" },
    verified: "2026-08-22", status: "pending",
  },
];

export const DATA_VERSION = "2026Q3";
export const DATA_AS_OF = "2026-08-22";

/* 프리셋 3종 — 주수 기반 예시 구성 (비중이 아닌 실제 보유 수) */
export const PRESETS: { key: string; label: string; desc: string; rows: { id: string; qty: number; account: "taxable" | "isa" | "pension" }[] }[] = [
  {
    key: "monthly", label: "월급통장형", desc: "국내 상장 월배당 중심 · ISA/연금 가정 · 세전 약 4%",
    rows: [
      { id: "279530", qty: 300, account: "isa" },
      { id: "446720", qty: 300, account: "isa" },
      { id: "005930", qty: 200, account: "taxable" },
      { id: "088260", qty: 300, account: "taxable" },
    ],
  },
  {
    key: "balanced", label: "50/50 현금흐름형", desc: "월배당 ETF + 미국 직투 혼합 · 세전 약 3.5%",
    rows: [
      { id: "279530", qty: 300, account: "taxable" },
      { id: "489250", qty: 200, account: "isa" },
      { id: "SCHD", qty: 60, account: "taxable" },
      { id: "005930", qty: 200, account: "taxable" },
      { id: "024110", qty: 200, account: "taxable" },
    ],
  },
  {
    key: "growth", label: "배당성장형", desc: "SCHD 중심 · 낮은 배당률, 높은 배당성장 · 재투자 가정",
    rows: [
      { id: "SCHD", qty: 120, account: "taxable" },
      { id: "VYM", qty: 40, account: "taxable" },
      { id: "489250", qty: 300, account: "isa" },
      { id: "005930", qty: 300, account: "pension" },
    ],
  },
];
