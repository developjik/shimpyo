// ==========================================================
// 쉼표 몬테카를로 하네스 v1 — 역사 3년 블록 부트스트랩 단일 모델
// DOM 없는 순수 모듈: React 앱(워커)과 CI 골든 러너가 같은 소스를 공유.
//
// 설계 결정 (2026-08-18 멀티 에이전트 토론 D4):
//  - v1은 "역사 블록 부트스트랩" 단일 모델. 파라메트릭(로그정규·블렌드 σ)은
//    수요 임계(꼬리 문의 8주 10건) 충족 후 SampleModel 토글로 추가.
//  - 결정론: mulberry32 시드 고정 → 같은 입력+시드는 영원히 같은 출력 (골든 G16).
//  - 정직성: 관측 범위 밖 시나리오(표본보다 나쁜 꼬리)는 미표현 — 밴드에 라벨.
//  - 국민연금: 인출 상쇄로 반영(실질 가치 일정 가정). 세금·건보료는 미반영(방법론 명시).
// ==========================================================
import { DATA, KR_DIV } from "./engine.ts";

export interface MCInput {
  asset: number;            // 초기 포트폴리오 (원)
  rate: number;             // 초기 인출률 (연)
  years: number;            // 인출 기간 (연)
  mixPct: number;           // 주식 비중 (0~100)
  market?: "blend" | "us" | "kr"; // 표본 풀 (기본 blend)
  divKR?: boolean;          // 한국 TR 근사 포함 (기본 true)
  npAnnual?: number;        // 국민연금 연액 (원, 실질 일정 가정)
  npStartYear?: number;     // 인출 개시 후 몇 년째부터 수령 (0-based)
  inflFixed?: number | null;    // null = 역사 CPI(블록 샘플), 숫자 = 고정 인플레
  seed?: number;
}

export interface MCResult {
  paths: number;
  seed: number;
  market: string;
  depletionRate: number;        // 고갈 확률 (0~1)
  real: { p10: number[]; p50: number[]; p90: number[] }; // 연도별 실질 포트폴리오 (초기자산 배수)
  sampleNote: string;
}

/* ---------- 시드 고정 RNG (mulberry32) ---------- */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 표본 풀: [stock, bond, cpi] 연도열 (블록은 시계열 내에서만) ---------- */
function buildPool(market: "blend" | "us" | "kr", divKR: boolean, needBond: boolean) {
  const us = DATA.us.rows.filter((r) => r[1] != null && (!needBond || r[2] != null));
  let kr = DATA.kr.rows.filter((r) => r[1] != null && (!needBond || r[2] != null));
  if (divKR) {
    kr = kr.map((r) => {
      const d = (KR_DIV as Record<number, number>)[r[0]];
      return d == null ? r : [r[0], (1 + r[1]!) * (1 + d) - 1, r[2], r[3]];
    });
  }
  const series = market === "us" ? [us] : market === "kr" ? [kr] : [us, kr];
  const weights = series.map((s) => Math.max(0, s.length - 2)); // 3년 블록 시작 가능 수
  return { series, weights, total: weights.reduce((x, y) => x + y, 0) };
}

const BLOCK = 3;

/* ---------- 몬테카를로 실행 ---------- */
export function runMC(input: MCInput, opts?: { paths?: number }): MCResult {
  const paths = opts?.paths ?? 2000;
  const seed = input.seed ?? 20260818;
  const market = input.market ?? "blend";
  const mix = Math.min(1, Math.max(0, (input.mixPct ?? 60) / 100));
  const needBond = mix < 1;
  const pool = buildPool(market, input.divKR ?? true, needBond);
  const years = Math.max(1, Math.round(input.years));
  const rnd = mulberry32(seed);

  const yearVals: number[][] = Array.from({ length: years }, () => []);
  let depleted = 0;
  const w0 = input.asset * input.rate;

  for (let p = 0; p < paths; p++) {
    let port = input.asset, inflCum = 1, dead = false;
    let buf: number[][] = [], bi = 0;
    for (let t = 0; t < years; t++) {
      if (bi >= buf.length) {
        let x = rnd() * pool.total, si = 0;
        for (; si < pool.weights.length - 1; si++) { x -= pool.weights[si]; if (x < 0) break; }
        const s = pool.series[si];
        const start = Math.floor(rnd() * (s.length - BLOCK + 1));
        buf = s.slice(start, start + BLOCK); bi = 0;
      }
      const r = buf[bi++];
      const cpi = input.inflFixed != null ? input.inflFixed : (r[3] ?? 0.02);
      const npNow = input.npAnnual && t >= (input.npStartYear ?? 0) ? input.npAnnual : 0;
      const w = Math.max(0, w0 * inflCum - npNow); // 국민연금이 인출 상쇄
      if (port - w < 0) { dead = true; depleted++; break; }
      port -= w;
      port *= 1 + (mix * r[1]! + (1 - mix) * (r[2] ?? 0));
      inflCum *= 1 + cpi;
      yearVals[t].push(port / inflCum / input.asset);
    }
    if (dead) { /* 고갈 경로: 이후 연도는 0으로 기록(분포 하단) */ }
  }

  const q = (arr: number[], k: number) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const i = Math.min(s.length - 1, Math.max(0, Math.round(k * (s.length - 1))));
    return s[i];
  };
  const p10: number[] = [], p50: number[] = [], p90: number[] = [];
  for (let t = 0; t < years; t++) {
    p10.push(q(yearVals[t], 0.10)); p50.push(q(yearVals[t], 0.50)); p90.push(q(yearVals[t], 0.90));
  }
  const us = pool.series[0]?.length ?? 0;
  const kr = pool.series[pool.series.length - 1]?.length ?? 0;
  return {
    paths, seed, market,
    depletionRate: depleted / paths,
    real: { p10, p50, p90 },
    sampleNote: `${market === "blend" ? `미국 ${us}년 + 한국 ${kr}년 혼합 풀` : market === "us" ? `미국 ${us}년` : `한국 ${kr}년`} · ${BLOCK}년 블록 리샘플 · 관측 범위 밖 시나리오 미표현`,
  };
}

/* ---------- 지속가능 인출률: 고갈 확률 ≤ maxFail 인 최대 인출률 ---------- */
export function sustainableRate(
  input: Omit<MCInput, "rate">,
  opts?: { maxFail?: number; paths?: number; lo?: number; hi?: number; step?: number; seed?: number },
): number {
  const maxFail = opts?.maxFail ?? 0.10;
  const paths = opts?.paths ?? 800;
  const lo = opts?.lo ?? 0.02, hi = opts?.hi ?? 0.06, step = opts?.step ?? 0.001;
  let best = 0;
  for (let r = lo; r <= hi + 1e-9; r += step) {
    const d = runMC({ ...input, rate: r, seed: opts?.seed ?? 20260818 }, { paths }).depletionRate;
    if (d <= maxFail) best = Math.round(r * 10000) / 10000;
    else break; // 고갈률은 인출률에 대해 단조 증가 — 초과 시 탐색 종료
  }
  return best;
}

/* ---------- 골든 케이스 (G16~G20) ---------- */
export function runGoldenMC() {
  const cases: any[] = [];
  const base = { asset: 1e9, years: 30, mixPct: 60, market: "blend" as const, divKR: true, npAnnual: 0, npStartYear: 0, inflFixed: null };

  // G16: 결정론 — 동일 시드 2회 실행은 완전 동일
  const a = runMC({ ...base, rate: 0.04, seed: 42 }, { paths: 400 });
  const b = runMC({ ...base, rate: 0.04, seed: 42 }, { paths: 400 });
  const same = a.depletionRate === b.depletionRate && a.real.p50[29] === b.real.p50[29] && a.real.p10[29] === b.real.p10[29];
  cases.push({ id: "G16", title: "MC 결정론: 동일 시드 2회 실행 동일 결과", expect: 1, got: same ? 1 : 0, note: "mulberry32 시드 고정 — 새로고침해도 같은 답" });

  // G17: 시드 스냅샷 — blend 60/40 @4% 30년 p50 실질 잔존 (bp)
  const s = runMC({ ...base, rate: 0.04, seed: 20260818 }, { paths: 2000 });
  cases.push({ id: "G17", title: "MC 스냅샷: blend 60/40 @4% 30년 p50 실질 잔존", expect: 15148, got: Math.round(s.real.p50[29] * 10000), tol: 30, note: `고갈률 ${(s.depletionRate * 100).toFixed(1)}% · 시드 20260818` });

  // G18: 스트레스 — 한국 주식 100% @6% 40년은 고갈 >90%
  const stress = runMC({ asset: 1e9, years: 40, mixPct: 100, market: "kr", divKR: true, npAnnual: 0, npStartYear: 0, inflFixed: null, rate: 0.06, seed: 7 }, { paths: 400 });
  cases.push({ id: "G18", title: "MC 스트레스: 한국 주식100% @6% 40년 고갈 >60%", expect: 1, got: stress.depletionRate > 0.6 ? 1 : 0, note: `고갈률 ${(stress.depletionRate * 100).toFixed(1)}%` });

  // G19: 양성 — 미국 60/40 @3% 30년은 고갈 <15%
  const benign = runMC({ asset: 1e9, years: 30, mixPct: 60, market: "us", divKR: true, npAnnual: 0, npStartYear: 0, inflFixed: null, rate: 0.03, seed: 7 }, { paths: 400 });
  cases.push({ id: "G19", title: "MC 양성: 미국 60/40 @3% 30년 고갈 <15%", expect: 1, got: benign.depletionRate < 0.15 ? 1 : 0, note: `고갈률 ${(benign.depletionRate * 100).toFixed(1)}%` });

  // G20: 지속가능 인출률 스냅샷 (고갈 ≤10%)
  const sr = sustainableRate({ ...base }, { paths: 300, maxFail: 0.10 });
  cases.push({ id: "G20", title: "MC 지속가능 인출률 (고갈≤10%, blend 60/40 30년)", expect: 390, got: Math.round(sr * 10000), tol: 20, note: "그리드 2.0%~6.0%×0.1% · 시드 고정" });

  return cases;
}
