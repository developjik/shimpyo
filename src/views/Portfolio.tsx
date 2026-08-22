import { useMemo, useState } from "react";
import { ActionButton } from "seed-design/ui/action-button";
import { TextField, TextFieldInput } from "seed-design/ui/text-field";
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectTrigger } from "seed-design/ui/select";
import { INSTRUMENTS, PRESETS, DATA_VERSION, DATA_AS_OF } from "../lib/instruments";
import { dividendIncome, type Holding, type Account } from "../lib/dividend";
import { fmtW } from "../lib/engine";
import type { SimState } from "../store";

const PF_KEY = "shimpyo.portfolio.v1";

function loadHoldings(): Holding[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PF_KEY) || "null");
    if (raw?.v === 1 && Array.isArray(raw.rows)) return raw.rows;
  } catch {}
  return [];
}
function saveHoldings(rows: Holding[]) {
  try { localStorage.setItem(PF_KEY, JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), rows })); } catch {}
}

const CATS = ["전체", "국내주식", "국내ETF", "미국직투", "리츠"];
const FREQ_LABEL: Record<string, string> = { monthly: "월배당", quarterly: "분기", semiannual: "반기", annual: "연1회" };
const ACC_LABEL: Record<Account, string> = { taxable: "일반 (과세)", isa: "ISA", pension: "연금계좌" };

export default function PortfolioView({ state, set }: { state: SimState; set: <K extends keyof SimState>(k: K, v: SimState[K]) => void }) {
  const [rows, setRows] = useState<Holding[]>(loadHoldings);
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");
  const [selMonth, setSelMonth] = useState<number | null>(null);

  const res = useMemo(() => dividendIncome(rows), [rows]);

  const persist = (next: Holding[]) => { setRows(next); saveHoldings(next); set("divnet", Math.round(dividendIncome(next).netAnnual)); };
  const add = (id: string) => { if (rows.some((r) => r.id === id)) return; persist([...rows, { id, qty: 100, account: "taxable" }]); };
  const remove = (id: string) => persist(rows.filter((r) => r.id !== id));
  const update = (id: string, patch: Partial<Holding>) => persist(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const applyPreset = (key: string) => { const p = PRESETS.find((x) => x.key === key); if (p) persist(p.rows.map((r) => ({ ...r }))); };

  const list = INSTRUMENTS.filter(
    (i) => (cat === "전체" || i.cat === cat) && (!q || i.name.includes(q) || i.id.includes(q.toUpperCase())),
  );

  const maxMonth = Math.max(1, ...res.byMonthNet);
  const monthlyAvg = res.netAnnual / 12;
  const cover = state.spend > 0 ? Math.min(100, (monthlyAvg / (state.spend * 10000)) * 100) : 0;

  return (
    <div>
      {/* 답 */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">1</span>내 배당 포트폴리오</span>
          <span className="mono-note">데이터 {DATA_VERSION} ({DATA_AS_OF}) · 직전 실적 기준</span>
        </div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 15, lineHeight: 1.7 }}>
            아래 프리셋 중 하나로 시작하거나, 종목을 골라 주수만 적으면 월별 배당이 계산됩니다.
            <div className="row">
              {PRESETS.map((p) => (
                <ActionButton key={p.key} variant="neutralOutline" onClick={() => applyPreset(p.key)}>{p.label}</ActionButton>
              ))}
            </div>
            <div className="card-note">
              {PRESETS.map((p) => <div key={p.key} style={{ marginTop: 4 }}><b>{p.label}</b> — {p.desc}</div>)}
            </div>
          </div>
        ) : (
          <>
            <div className="answer-hero">
              <div className="answer-num">
                {fmtW(res.netAnnual)}<span className="answer-unit">원/년</span>
              </div>
              <div>
                <div style={{ fontSize: 14, color: "var(--seed-color-fg-neutral)" }}>세후 기준 · 세전 {fmtW(res.grossAnnual)}원 · 원천세 {fmtW(res.taxAnnual)}원</div>
                <div className="answer-state" style={{ color: "var(--ok)" }}>
                  월 평균 {fmtW(monthlyAvg)}원
                  {state.spend > 0 && <> · 월 지출({state.spend}만원)의 {cover.toFixed(0)}% 커버</>}
                </div>
              </div>
            </div>
            {state.spend > 0 && (
              <div className="gauge">
                <div className="gauge-track">
                  <div className="gauge-fill over" style={{ width: `${Math.max(2, cover)}%` }} />
                </div>
                <div className="gauge-legend">
                  <span>배당 커버 {cover.toFixed(0)}%</span>
                  <span>나머지 {(100 - cover).toFixed(0)}%는 자산 인출로</span>
                </div>
              </div>
            )}
            <div className="row">
              {PRESETS.map((p) => (
                <ActionButton key={p.key} variant="neutralWeak" onClick={() => applyPreset(p.key)}>{p.label}로 바꾸기</ActionButton>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 보유 목록 */}
      {rows.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span><span className="step-num">2</span>보유 종목 ({rows.length})</span>
            <span className="mono-note">주수 기준 — 시세와 무관하게 배당금이 정확</span>
          </div>
          <table className="dt">
            <thead>
              <tr><th>종목</th><th>주수</th><th>계좌</th><th>세전/년</th><th>세후/년</th><th>세후/월</th><th></th></tr>
            </thead>
            <tbody>
              {res.rows.map((r) => (
                <tr key={r.inst.id}>
                  <td>
                    {r.inst.name} <span className="mono-note">{r.inst.id}</span>
                    {r.inst.status === "pending" && <span className="status-badge pending" style={{ marginLeft: 4 }}>검증중</span>}
                  </td>
                  <td>
                    <div style={{ width: 90 }}>
                      <TextFieldInput type="number" inputMode="numeric" value={r.qty}
                        onChange={(e: any) => update(r.inst.id, { qty: Number(e.target.value) || 0 })} />
                    </div>
                  </td>
                  <td>
                    <SelectRoot label="" value={[r.account]} onValueChange={(v: any) => update(r.inst.id, { account: v[0] })}>
                      <SelectTrigger />
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="taxable" label="일반 (과세)" />
                          <SelectItem value="isa" label="ISA" />
                          <SelectItem value="pension" label="연금계좌" />
                        </SelectGroup>
                      </SelectContent>
                    </SelectRoot>
                  </td>
                  <td>{fmtW(r.grossAnnual)}</td>
                  <td className="brand">{fmtW(r.netAnnual)}</td>
                  <td>{fmtW(r.netAnnual / r.inst.payMonths.length)}</td>
                  <td><ActionButton variant="ghost" size="small" onClick={() => remove(r.inst.id)} aria-label={`${r.inst.name} 삭제`}>✕</ActionButton></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="card-note">
            계좌별 세제: 일반=국내 원천 15.4% / 미국 직투 15%(국내 추가 0%) · ISA·연금=보유 중 비과세(연금은 수령 시 5.5%).
            {res.hasPending && " ⚠ '검증중' 종목은 주당 배당액이 집계치 기반 — 운용사 공시 확인 전까지 참고용."}
          </div>
        </div>
      )}

      {/* 월별 캘린더 */}
      {rows.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span><span className="step-num">3</span>1년 배당 캘린더 (세후)</span>
            <span className="mono-note">국내 개별주는 4월 집중 — 월평균이 아닌 실제 지급월</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3, alignItems: "end", height: 140 }}>
            {res.byMonthNet.map((v, i) => {
              const kr = res.byClass.kr.net / 12, us = res.byClass.us.net / 12;
              const h = (v / maxMonth) * 100;
              const grossM = res.byMonthGross[i];
              const krShare = grossM > 0 ? Math.min(1, (kr * (v > 0 ? 1 : 0)) / (grossM || 1)) : 0;
              return (
                <button key={i} onClick={() => setSelMonth(selMonth === i ? null : i)}
                  style={{ height: `${Math.max(2, h)}%`, background: "#e65200", opacity: selMonth === i ? 1 : 0.75, border: "none", borderRadius: 3, cursor: "pointer", position: "relative" }}
                  aria-label={`${i + 1}월 세후 ${fmtW(v)}원`}
                  title={`${i + 1}월: ${fmtW(v)}원`} />
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", fontSize: 10.5, color: "var(--seed-color-fg-neutral)", marginTop: 4, textAlign: "center" }}>
            {Array.from({ length: 12 }, (_, i) => <span key={i}>{i + 1}</span>)}
          </div>
          {selMonth != null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{selMonth + 1}월 지급 종목 (세후)</div>
              <table className="dt">
                <tbody>
                  {res.rows.filter((r) => r.inst.payMonths.includes(selMonth + 1)).map((r) => (
                    <tr key={r.inst.id}>
                      <td>{r.inst.name} <span className="mono-note">{r.inst.id}</span></td>
                      <td>{fmtW(r.netAnnual / r.inst.payMonths.length)}</td>
                      <td className="faint">{ACC_LABEL[r.account]} · {FREQ_LABEL[r.inst.freq]}</td>
                    </tr>
                  ))}
                  <tr><td><b>{selMonth + 1}월 합계</b></td><td className="brand"><b>{fmtW(res.byMonthNet[selMonth])}</b></td><td className="faint"></td></tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="card-note">
            막대를 눌러 해당 월의 지급 종목을 보세요. 국내 개별주(연1회·분기)는 4~5월에 몰리고, 월배당 ETF가 나머지 달을 메웁니다.
            실제 지급일은 배당락일과 다를 수 있습니다 (삼성전자: 12월 말 락 → 4월 지급).
          </div>
        </div>
      )}

      {/* 종목 추가 */}
      <div className="card">
        <div className="card-title"><span><span className="step-num">{rows.length > 0 ? 4 : 2}</span>종목 추가</span></div>
        <div className="chips" role="group" aria-label="카테고리">
          {CATS.map((c) => (
            <button key={c} className={cat === c ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <TextField label="종목명/코드 검색" indicator={`${list.length}개`}>
              <TextFieldInput type="search" value={q} onChange={(e: any) => setQ(e.target.value)} placeholder="예: 삼성전자, SCHD, 279530" />
            </TextField>
          </div>
        </div>
        <table className="dt" style={{ marginTop: 8 }}>
          <thead><tr><th>종목</th><th>주기</th><th>연 배당률</th><th>주당 연 배당</th><th>세제</th><th>상태</th><th></th></tr></thead>
          <tbody>
            {list.map((i) => (
              <tr key={i.id}>
                <td>{i.name} <span className="mono-note">{i.id}</span></td>
                <td>{FREQ_LABEL[i.freq]}</td>
                <td>{i.yieldLabel}</td>
                <td>{i.currency === "USD" ? `$${i.divPerShare} (₩${Math.round(i.divPerShare * (i.fx ?? 0)).toLocaleString()})` : `₩${i.divPerShare.toLocaleString()}`}</td>
                <td className="faint" style={{ whiteSpace: "normal" }}>{i.taxNote}</td>
                <td><span className={`status-badge ${i.status}`}>{i.status === "confirmed" ? "확정" : "검증중"}</span></td>
                <td>
                  <ActionButton variant="brandSolid" size="small" onClick={() => add(i.id)} disabled={rows.some((r) => r.id === i.id)}>
                    {rows.some((r) => r.id === i.id) ? "추가됨" : "추가"}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card-note">
          큐레이션 {INSTRUMENTS.length}종목 (국내주식·국내ETF·미국직투·리츠). 더 필요한 종목은 시뮬레이터 하단 제보로 요청해 주세요 — 분기 심사로 추가됩니다.
          모든 배당 수치는 직전 실적 기준이며 미래 배당을 보장하지 않습니다.
        </div>
      </div>

      {/* 시뮬레이터 연동 */}
      {rows.length > 0 && (
        <div className="card">
          <div className="card-title">시뮬레이터에 반영됨</div>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            월 평균 <b>{fmtW(monthlyAvg)}원</b> 배당이 계산돼 시뮬레이터 첫 화면에 "내 배당 포트폴리오" 카드로 나타납니다.
            월 지출에서 배당이 커버하는 만큼 인출 부담이 줄어드는 구조를 확인해 보세요.
          </div>
          <div className="row">
            <ActionButton variant="brandSolid" onClick={() => (location.hash = "#sim")}>시뮬레이터에서 보기</ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
