// MC 워커 — 메인 스레드 블로킹 없이 몬테카를로 실행 (Vite module worker)
// 결과는 연도별 백분위 배열(수백 개 숫자)만 전달 — 경로 전체는 전송하지 않음.
import { runMC, sustainableRate, type MCInput } from "../lib/mc.ts";

self.onmessage = (e: MessageEvent) => {
  const { input, paths = 4000, wantSustainable = true, sustainablePaths = 1200 } = e.data as {
    input: MCInput; paths?: number; wantSustainable?: boolean; sustainablePaths?: number;
  };
  try {
    const t0 = Date.now();
    const res = runMC(input, { paths });
    let sustainable: number | null = null;
    let sustainableNetMonthly: number | null = null;
    if (wantSustainable && res.depletionRate > 0) {
      const { rate: _drop, ...rest } = input;
      sustainable = sustainableRate(rest, { paths: sustainablePaths, maxFail: 0.10 });
    }
    const ms = Date.now() - t0;
    (self as any).postMessage({ ok: true, res, sustainable, ms });
  } catch (err: any) {
    (self as any).postMessage({ ok: false, error: String(err?.message ?? err) });
  }
};
