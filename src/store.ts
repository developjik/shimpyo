// 전역 상태 — localStorage(shimpyo.v1) + URL 파라미터 (구 버전 링크와 호환)
import { useEffect, useState, useCallback } from "react";

export interface SimState {
  spend: number; asset: number; birth: number; retire: number;
  np: number; npjoin: number; npsalary: number; npauto: boolean;
  dep: number; mix: number; strat: string; rate: string; infl: string; wdl: string; refl: string;
  divnet: number; // 포트폴리오 탭에서 주입하는 세후 연 배당 (원)
}

export const DEFAULTS: SimState = {
  spend: 250, asset: 5, birth: 1990, retire: 45,
  np: 60, npjoin: 25, npsalary: 400, npauto: true,
  dep: 1.5, mix: 60, strat: "fixed", rate: "0.04", infl: "hist", wdl: "interest", refl: "0.5", divnet: 0,
};

const LS_KEY = "shimpyo.v1";
const NUM_KEYS = ["spend","asset","birth","retire","np","npjoin","npsalary","dep","mix","divnet"] as const;

function coerceNum(v: string | null, d: number): number {
  const n = Number(v);
  return v === null || Number.isNaN(n) ? d : n;
}

function load(): SimState {
  const s = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch {}
  if (typeof location !== "undefined" && location.hash.includes("?")) {
    const p = new URLSearchParams(location.hash.split("?")[1]);
    for (const k of NUM_KEYS) if (p.has(k)) (s as any)[k] = coerceNum(p.get(k), (s as any)[k]);
    for (const k of ["strat","rate","infl","wdl","refl"]) if (p.has(k)) (s as any)[k] = p.get(k)!;
    if (p.has("npauto")) s.npauto = p.get("npauto") === "1";
  }
  return s;
}

export function useSimState() {
  const [state, setState] = useState<SimState>(load);
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }, [state]);
  const set = useCallback(<K extends keyof SimState>(key: K, value: SimState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);
  const reset = useCallback(() => {
    try { localStorage.removeItem(LS_KEY); } catch {}
    setState(DEFAULTS);
  }, []);
  return { state, set, reset };
}

export function shareURL(state: SimState): string {
  const p = new URLSearchParams();
  (Object.keys(state) as (keyof SimState)[]).forEach((k) => {
    p.set(k, String(state[k]));
  });
  p.set("u", "share"); // 채널 코드 — 공유 링크 유입 측정용(경로그래) · 상태 복원에는 무관
  return `${location.origin}${location.pathname}#sim?${p.toString()}`;
}

export function themeCycle(): "light" | "dark" | "system" {
  const el = document.documentElement;
  try {
    const saved = localStorage.getItem("shimpyo.theme");
    if (saved === "light") { localStorage.setItem("shimpyo.theme", "dark"); el.dataset.seedColorMode = "dark-only"; return "dark"; }
    if (saved === "dark") { localStorage.removeItem("shimpyo.theme"); delete el.dataset.seedColorMode; return "system"; }
    localStorage.setItem("shimpyo.theme", "light"); el.dataset.seedColorMode = "light-only"; return "light";
  } catch { return "system"; }
}
