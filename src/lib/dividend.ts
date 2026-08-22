// ==========================================================
// 쉼표 배당 포트폴리오 엔진 v1 — DOM 없는 순수 모듈 (앱/CI 공유)
// 과세 로직 (2026-08-22 검증, 출처: 국세청 보도자료·법제처·증권사 공식):
//  - 국내 주식/ETF/리츠(과세계좌): 국내 원천 15.4%
//  - 미국 직투(과세계좌): 미국 원천 15%, 국내 추가 징수 0% (max(0,14%-15%)=0)
//  - ISA/연금계좌: 보유 중 배당 비과세 (연금은 수령 시 5.5% — 라벨로 고지)
//  - 금종과세 연말정산·FTC 환급은 원천징수 기준 세후로 라벨 (P2 유보)
// 건보료는 여기서 계산하지 않는다 (기존 hiLocal이 소득 합계 기반으로 처리).
// ==========================================================
import { INSTRUMENTS, type Instrument } from "./instruments.ts";

export type Account = "taxable" | "isa" | "pension";
export interface Holding { id: string; qty: number; account: Account; }

export interface DividendRow {
  inst: Instrument; qty: number; account: Account;
  grossAnnual: number; taxAnnual: number; netAnnual: number;
  byMonthNet: number[]; // 12
}

export interface DividendResult {
  grossAnnual: number; taxAnnual: number; netAnnual: number;
  byMonthGross: number[]; byMonthNet: number[];
  byClass: Record<"kr" | "us" | "taxfree", { gross: number; net: number }>;
  rows: DividendRow[];
  hasPending: boolean;
}

const TAX = {
  kr: 0.154,   // 국내 원천 (소득세법 §127)
  us: 0.15,    // 미국 원천 (한미조약) — 국내 추가 0% (§127의2)
  taxfree: 0,
};

export function taxClassOf(inst: Instrument, account: Account): "kr" | "us" | "taxfree" {
  if (account !== "taxable") return "taxfree";
  return inst.market === "US" ? "us" : "kr";
}

export function divPerShareKRW(inst: Instrument): number {
  if (inst.currency === "KRW") return inst.divPerShare;
  return inst.divPerShare * (inst.fx ?? 1340);
}

/* 종목 1개의 연 배당 → 월 분배 (지급월 균등 분할) */
export function rowOf(h: Holding): DividendRow | null {
  const inst = INSTRUMENTS.find((i) => i.id === h.id);
  if (!inst || !Number.isFinite(h.qty) || h.qty <= 0) return null;
  const annualGross = divPerShareKRW(inst) * h.qty;
  const cls = taxClassOf(inst, h.account);
  const rate = TAX[cls];
  const perMonthGross = annualGross / inst.payMonths.length;
  const byMonthNet = Array.from({ length: 12 }, (_, m) =>
    inst.payMonths.includes(m + 1) ? perMonthGross * (1 - rate) : 0,
  );
  return {
    inst, qty: h.qty, account: h.account,
    grossAnnual: annualGross,
    taxAnnual: annualGross * rate,
    netAnnual: annualGross * (1 - rate),
    byMonthNet,
  };
}

export function dividendIncome(holdings: Holding[]): DividendResult {
  const rows = holdings.map(rowOf).filter(Boolean) as DividendRow[];
  const res: DividendResult = {
    grossAnnual: 0, taxAnnual: 0, netAnnual: 0,
    byMonthGross: Array(12).fill(0), byMonthNet: Array(12).fill(0),
    byClass: { kr: { gross: 0, net: 0 }, us: { gross: 0, net: 0 }, taxfree: { gross: 0, net: 0 } },
    rows, hasPending: false,
  };
  for (const r of rows) {
    res.grossAnnual += r.grossAnnual;
    res.taxAnnual += r.taxAnnual;
    res.netAnnual += r.netAnnual;
    if (r.inst.status === "pending") res.hasPending = true;
    const cls = taxClassOf(r.inst, r.account);
    res.byClass[cls].gross += r.grossAnnual;
    res.byClass[cls].net += r.netAnnual;
    r.inst.payMonths.forEach((m) => {
      const perG = r.grossAnnual / r.inst.payMonths.length;
      res.byMonthGross[m - 1] += perG;
      res.byMonthNet[m - 1] += perG * (1 - TAX[cls]);
    });
  }
  return res;
}

/* ---------- 골든 케이스 G21~G24 ---------- */
export function runGoldenDiv() {
  const cases: any[] = [];

  // G21: 국내주 과세계좌 — 삼성전자 100주 × 1,444원 × (1-15.4%)
  const g21 = dividendIncome([{ id: "005930", qty: 100, account: "taxable" }]);
  cases.push({ id: "G21", title: "배당: 삼성전자 100주 과세계좌 세후 연액", expect: 122162, got: Math.round(g21.netAnnual), note: "144,400 × 0.846 · 국내 원천 15.4%" });

  // G22: 미국 직투 과세계좌 — SCHD 80주, $1.048 × 1,340원 × 15% 원천
  const g22 = dividendIncome([{ id: "SCHD", qty: 80, account: "taxable" }]);
  cases.push({ id: "G22", title: "배당: SCHD 80주 과세계좌 세후 연액", expect: 95494, got: Math.round(g22.netAnnual), note: "($1.048×1,340×80) × 0.85 · 미국 원천 15%, 국내 0%" });

  // G23: ISA 면세 — KODEX 고배당주 500주
  const g23 = dividendIncome([{ id: "279530", qty: 500, account: "isa" }]);
  cases.push({ id: "G23", title: "배당: KODEX 고배당주 500주 ISA 세후 연액", expect: 550000, got: Math.round(g23.netAnnual), note: "세전=세후 · ISA 내 비과세" });

  // G24: 월별 캘린더 — 월배당(ISA 500주) + 연1회 4월(삼성전자 100주 과세)
  const g24 = dividendIncome([
    { id: "279530", qty: 500, account: "isa" },
    { id: "005930", qty: 100, account: "taxable" },
  ]);
  const jan = Math.round(g24.byMonthNet[0]);
  const apr = Math.round(g24.byMonthNet[3]);
  const dec = Math.round(g24.byMonthNet[11]);
  // 1월 = ISA 월분배만 45,833 | 4월 = 월분배 + 국내주 세후 122,162 | 12월 = 1월과 동일
  cases.push({ id: "G24a", title: "배당 캘린더: 1월 세후 (월분배만)", expect: 45833, got: jan, note: "550,000/12 · 국내 4월 집중 이전 월" });
  cases.push({ id: "G24b", title: "배당 캘린더: 4월 세후 (월분배+삼성전자 분기 1/4)", expect: 76374, got: apr, note: "45,833 + 122,162/4 · 분기 지급은 지급월에 균등 분할" });
  cases.push({ id: "G24c", title: "배당 캘린더: 12월 = 1월 (대칭 검증)", expect: jan, got: dec, note: "연말-연초 대칭" });

  return cases;
}
