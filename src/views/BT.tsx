import { useMemo, useState } from "react";
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectTrigger } from "seed-design/ui/select";
import { TextField, TextFieldInput } from "seed-design/ui/text-field";
import { Checkbox } from "seed-design/ui/checkbox";
import { SegmentedControl, SegmentedControlItem } from "seed-design/ui/segmented-control";
import { DATA, KR_DIV, runBacktest, runGuard, pct } from "../lib/engine";

export default function BTView() {
  const [market, setMarket] = useState<"us" | "kr">("us");
  const [years, setYears] = useState("30");
  const [mix, setMix] = useState(60);
  const [strat, setStrat] = useState("fixed");
  const [div, setDiv] = useState(false);

  const d = useMemo(() => {
    if (market === "us") return DATA.us;
    const rows = div
      ? DATA.kr.rows.map((r) => {
          const dv = (KR_DIV as Record<number, number>)[r[0]];
          return dv == null ? r : [r[0], (1 + (r[1] as number)) * (1 + dv) - 1, r[2], r[3]];
        })
      : DATA.kr.rows;
    return {
      rows,
      kind: div ? "KOSPI TR 근사 + 국고채3Y YTM" : DATA.kr.kind,
      src: DATA.kr.src,
    };
  }, [market, div]);

  const result = useMemo(() => {
    const y = Number(years);
    const probe = strat === "guard" ? runGuard(d.rows, mix, y, 0.04) : runBacktest(d.rows, mix, y, 0.04, strat);
    let mixUse = mix, mixNote = "";
    if (market === "kr" && mix < 100 && probe.length < 5) {
      mixUse = 100;
      mixNote = `주식 100%로 대체 표시 — 국고채3Y(1998~)와 KOSPI(1982~)가 겹치는 구간으로는 ${y}년 혼합 사이클 ${probe.length}개뿐`;
    }
    const rates = [0.035, 0.04, 0.05].map((rate) => {
      const cyc = strat === "guard" ? runGuard(d.rows, mixUse, y, rate) : runBacktest(d.rows, mixUse, y, rate, strat);
      const okN = cyc.filter((c) => c.ok).length;
      const worst = cyc.filter((c) => c.ok).sort((a, b) => a.terminal - b.terminal)[0];
      return { rate, sr: cyc.length ? okN / cyc.length : 0, okN, n: cyc.length, worst, fails: cyc.length - okN };
    });
    const cyc4 = strat === "guard" ? runGuard(d.rows, mixUse, y, 0.04) : runBacktest(d.rows, mixUse, y, 0.04, strat);
    const fails = cyc4.filter((c) => !c.ok);
    const worsts = cyc4.filter((c) => c.ok).sort((a, b) => a.terminal - b.terminal).slice(0, 8);
    return { rates, mixUse, mixNote, fails, worsts };
  }, [d, years, mix, strat, market]);

  return (
    <div>
      <div className="card">
        <div className="card-title">역사 백테스트 — 성공확률 <span className="mono-note">미국+한국 동시 공개 · 연 단위 사이클</span></div>
        <div className="field-grid">
          <div>
            <div className="mono-note" style={{ marginBottom: 6 }}>시장</div>
            <SegmentedControl value={market} onValueChange={(v: any) => setMarket(v)}>
              <SegmentedControlItem value="us" label="미국 (1928~)" />
              <SegmentedControlItem value="kr" label="한국 (1980~)" />
            </SegmentedControl>
          </div>
          <SelectRoot label="기간" value={[years]} onValueChange={(v: any) => setYears(v[0])}>
            <SelectTrigger />
            <SelectContent>
              <SelectGroup>
                {[25, 30, 40, 50].map((y) => <SelectItem key={y} value={String(y)} label={`${y}년`} />)}
              </SelectGroup>
            </SelectContent>
          </SelectRoot>
          <SelectRoot label="전략" value={[strat]} onValueChange={(v: any) => setStrat(v[0])}>
            <SelectTrigger />
            <SelectContent>
              <SelectGroup>
                <SelectItem value="fixed" label="고정 실질" />
                <SelectItem value="pct" label="포트폴리오 비율" />
                <SelectItem value="guard" label="가드레일" />
              </SelectGroup>
            </SelectContent>
          </SelectRoot>
          <TextField label="주식 비중" indicator="%">
            <TextFieldInput type="number" step="5" min="0" max="100" value={mix} onChange={(e: any) => setMix(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
          </TextField>
          {market === "kr" && (
            <div style={{ display: "flex", alignItems: "end", paddingBottom: 8 }}>
              <Checkbox
                label="KOSPI 배당 포함 (TR 근사, 2001~)"
                checked={div}
                onCheckedChange={(c: any) => setDiv(c === true)}
              />
            </div>
          )}
        </div>

        <div className="kpis" style={{ marginTop: 14 }}>
          {result.rates.map((r) => (
            <div className="kpi" key={r.rate}>
              <div className="k">성공확률 @ {pct(r.rate)}{result.mixUse !== mix ? " · 주식100%" : ""}</div>
              <div className={`v ${r.sr >= 0.9 ? "good" : r.sr >= 0.75 ? "warn" : "pos"}`}>{pct(r.sr)}</div>
              <div className="s">{r.okN}/{r.n} 사이클 · 최악종료 {r.worst ? (r.worst.terminal * 100).toFixed(0) + "%" : "-"} · 실패 {r.fails}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">실패·최악 사이클 (@4% 고정) — 숨기지 않습니다</div>
        <table className="dt">
          <thead>
            <tr><th>시작 연도</th><th>종료</th><th>종료 잔액 (초기 대비)</th><th>비고</th></tr>
          </thead>
          <tbody>
            {result.fails.map((c) => (
              <tr key={c.start}><td>{c.start}</td><td>{c.end}</td><td className="pos">실패 (파산)</td><td className="faint">{c.bottomYear}년 바닥</td></tr>
            ))}
            {result.worsts.map((c) => (
              <tr key={c.start}><td>{c.start}</td><td>{c.end}</td><td className="warn">{(c.terminal * 100).toFixed(0)}%</td><td className="faint">{c.bottomYear}년 바닥 ({(c.bottom * 100).toFixed(0)}%)</td></tr>
            ))}
          </tbody>
        </table>
        <div className="card-note">
          {market === "kr"
            ? `한국: ${d.rows[0][0]}~${d.rows[d.rows.length - 1][0]} · ${d.kind} · ${d.src}. ${result.mixNote ? result.mixNote + ". " : ""}KOSPI는 배당 미포함(PR) 시 표시보다 실제 성공률이 높게 편향되고, 국고채3년은 만기수익률 근사입니다. 이 한계가 "믿을 수 있는 경계선"입니다.`
            : `미국: ${d.rows[0][0]}~${d.rows[d.rows.length - 1][0]} · ${DATA.us.kind} · ${DATA.us.src}. ${years}년 사이클 ${result.rates[1].n}개. 연 단위 계산(월 단위 대비 하한 정확도).`}
        </div>
      </div>
    </div>
  );
}
