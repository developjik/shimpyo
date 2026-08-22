import { useMemo, useState } from "react";
import { ActionButton } from "seed-design/ui/action-button";
import { TextField, TextFieldInput } from "seed-design/ui/text-field";
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectTrigger } from "seed-design/ui/select";
import { Checkbox } from "seed-design/ui/checkbox";
import { useSnackbarAdapter, Snackbar } from "seed-design/ui/snackbar";
import {
  RULES, hiLocal, npClaimAge, npPension, withdrawAfterTax, nationalDecile,
  fmtW, pct, fmtM,
} from "../lib/engine";
import { shareURL, type SimState } from "../store";

interface Props {
  state: SimState;
  set: <K extends keyof SimState>(k: K, v: SimState[K]) => void;
  reset: () => void;
}

/* ---------- 공통: 정보 툴팁 (ⓘ) ---------- */
function Info({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="info-wrap">
      <button
        className="info-btn"
        aria-label="쉬운 설명 보기"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >i</button>
      {open && <span className="info-tip" role="tooltip">{children}</span>}
    </span>
  );
}

/* ---------- 공통: 프리셋 칩 ---------- */
function Chips({ label, options, cur, onPick, unit }: {
  label: string; options: number[]; cur: number; onPick: (v: number) => void; unit: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} className={cur === o ? "chip on" : "chip"} onClick={() => onPick(o)}>
          {o}{unit}
        </button>
      ))}
    </div>
  );
}

/* ---------- 결과 카드 (canvas PNG) ---------- */
function drawResultCard(state: SimState, headline: { goal4: number; effWr: number }): HTMLCanvasElement {
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const dark = document.documentElement.dataset.seedColorMode === "dark-only";
  const bg = dark ? "#17181a" : "#ffffff", panel = dark ? "#1e2023" : "#f7f8fa";
  const txt = dark ? "#e8eaee" : "#2c333d", dim = dark ? "#9aa3af" : "#6b7684";
  const accent = "#e65200", ok = dark ? "#5ecb8b" : "#2e9e5b";
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = accent; g.fillRect(0, 0, 8, H);
  g.fillStyle = txt; g.font = "700 40px -apple-system, 'Apple SD Gothic Neo', sans-serif";
  g.fillText("쉼표", 48, 78);
  const w0 = g.measureText("쉼표").width;
  g.fillStyle = accent; g.fillText("_", 48 + w0 + 4, 78);
  g.fillStyle = dim; g.font = "24px -apple-system, 'Apple SD Gothic Neo', sans-serif";
  g.fillText("몇억이면 쉴 수 있는가 · 근거 전부 공개", 48, 116);
  g.fillStyle = txt; g.font = "700 34px -apple-system, 'Apple SD Gothic Neo', sans-serif";
  g.fillText("필요 자산 @4% (세전 인출 기준)", 48, 200);
  g.fillStyle = accent; g.font = "800 88px -apple-system, 'Apple SD Gothic Neo', sans-serif";
  g.fillText(`${(headline.goal4 / 1e8).toFixed(2)}억`, 48, 290);
  g.fillStyle = dim; g.font = "26px -apple-system, 'Apple SD Gothic Neo', sans-serif";
  const gap4 = state.asset * 1e8 - headline.goal4;
  g.fillText(`보유 ${state.asset}억 → ${gap4 >= 0 ? "달성" : `부족 ${(-gap4 / 1e8).toFixed(2)}억`} · 월 지출 ${state.spend}만원`, 48, 340);
  g.fillStyle = panel; g.fillRect(640, 170, 512, 190);
  (["3.5%", "4.0%", "5.0%"] as const).forEach((label, i) => {
    const r = Number(label.replace("%", "")) / 100;
    const v = state.spend * 10000 * 12 / r;
    const x = 668 + i * 168;
    g.fillStyle = dim; g.font = "22px -apple-system, sans-serif";
    g.fillText(`@${label}`, x, 214);
    g.fillStyle = txt; g.font = "700 36px -apple-system, sans-serif";
    g.fillText(`${(v / 1e8).toFixed(1)}억`, x, 254);
  });
  g.fillStyle = ok; g.font = "600 24px -apple-system, sans-serif";
  g.fillText(`유효 인출률 ${pct(headline.effWr, 2)} (세금·건보료 반영 후)`, 668, 322);
  g.fillStyle = dim; g.font = "20px -apple-system, 'Apple SD Gothic Neo', sans-serif";
  g.fillText(`rules ${RULES.version} · 상수 검증 ${RULES.verified} · 골든 케이스 상시 회귀 · 현행 규칙 기준`, 48, 560);
  g.fillStyle = accent; g.fillText("developjik.github.io/shimpyo", 48, 596);
  return c;
}

export default function SimView({ state, set, reset }: Props) {
  const snackbar = useSnackbarAdapter();
  const [showMore, setShowMore] = useState(false);
  const [showBand, setShowBand] = useState(false);
  const [hello, setHello] = useState(() => {
    try { return !localStorage.getItem("shimpyo.seen"); } catch { return false; }
  });

  const annual = state.spend * 10000 * 12;
  const assetWon = state.asset * 1e8;

  const np = useMemo(() => {
    if (!state.npauto) return { monthly: state.np * 10000, kbar: 0, rate: 0, P: 0, auto: false };
    const r = npPension(state.birth, state.npjoin, state.npsalary * 10000);
    return { ...r, auto: true };
  }, [state.npauto, state.np, state.birth, state.npjoin, state.npsalary]);

  const gross = assetWon * Number(state.rate);
  const w = withdrawAfterTax(gross, state.wdl, 0, 0, 0, state.dep * 1e8, Number(state.refl));
  const effWr = assetWon > 0 ? w.net / assetWon : 0;

  const claimAge = npClaimAge(state.birth);
  const bridge = Math.max(0, claimAge - state.retire);
  const age = new Date().getFullYear() - state.birth;

  /* ---------- 몬테카를로 (워커) ---------- */
  const [mc, setMc] = useState<null | { running: boolean; res?: any; sustainable?: number | null; ms?: number; err?: string; years?: number }>(null);
  const runMCJob = () => {
    setMc({ running: true });
    const years = Math.max(10, 95 - state.retire);
    try {
      const worker = new Worker(new URL("../workers/mc.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent) => {
        worker.terminate();
        if (e.data.ok) setMc({ running: false, res: e.data.res, sustainable: e.data.sustainable, ms: e.data.ms, years });
        else setMc({ running: false, err: e.data.error });
      };
      worker.onerror = (ev: any) => { worker.terminate(); setMc({ running: false, err: String(ev?.message ?? "worker error") }); };
      worker.postMessage({
        input: {
          asset: assetWon, rate: Number(state.rate), years, mixPct: state.mix,
          market: "blend", divKR: true,
          npAnnual: np.monthly * 12, npStartYear: bridge,
          inflFixed: state.infl === "hist" ? null : Number(state.infl),
          seed: 20260818,
        },
        paths: 4000, wantSustainable: true,
      });
    } catch (e: any) {
      setMc({ running: false, err: String(e?.message ?? e) });
    }
  };

  const toast = (msg: string) =>
    snackbar.create({ onClose: () => {}, render: () => <Snackbar message={msg} /> });

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("복사 실패"); }
  };

  const saveCard = () => {
    try {
      const canvas = drawResultCard(state, { goal4: annual / 0.04, effWr });
      canvas.toBlob((blob) => {
        if (!blob) { toast("카드 생성 실패"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `shimpyo-${state.spend}man-${state.asset}eok.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast("결과카드 PNG 저장됨");
      }, "image/png");
    } catch { toast("카드 생성 실패"); }
  };

  const mdSummary =
    `**쉼표 계산 결과** (rules ${RULES.version}, ${RULES.verified})\n` +
    `- 월 지출: ${state.spend}만원 · 투자자산: ${state.asset}억\n` +
    `- 목표자산: @3.5% ${(annual / 0.035 / 1e8).toFixed(2)}억 / @4% ${(annual / 0.04 / 1e8).toFixed(2)}억 / @5% ${(annual / 0.05 / 1e8).toFixed(2)}억\n` +
    `- 첫해 실가용: ${(w.net / 1e7).toFixed(1)}천만원 · 유효 인출률 ${(effWr * 100).toFixed(2)}%\n` +
    `- 국민연금 수령: ${claimAge}세 (공백기 ${bridge}년)\n` +
    `근거·출처: ${shareURL(state)}`;

  const goal4 = annual / 0.04;
  const gap4 = assetWon - goal4;
  const bandInvest = nationalDecile(state.asset);
  const bandWithDep = nationalDecile(state.asset + state.dep);
  const sustainNet = mc?.sustainable
    ? withdrawAfterTax(assetWon * mc.sustainable, state.wdl, 0, 0, 0, state.dep * 1e8, Number(state.refl)).net / 12
    : null;

  const issueURL = "https://github.com/developjik/shimpyo/issues/new?title=" +
    encodeURIComponent("[오류 제보] 시뮬레이터 숫자 이상") +
    "&body=" +
    encodeURIComponent(
      `rules ${RULES.version} (${RULES.verified})\n입력: 월지출 ${state.spend}만 · 자산 ${state.asset}억 · 출생 ${state.birth} · 인출 ${state.wdl}\n예상 vs 실제:\n\n(무엇이 이상한지 적어주세요 — 반영 내역은 체인지로그에 기록됩니다)`
    );

  const dismissHello = () => {
    setHello(false);
    try { localStorage.setItem("shimpyo.seen", "1"); } catch {}
  };

  return (
    <div>
      {/* ===== 첫 방문 안내 ===== */}
      {hello && (
        <div className="hello" role="note">
          <div>
            <b>세 개만 물어볼게요.</b> 월 지출·모은 돈·출생연도를 넣으면 바로 아래에 답이 나옵니다.
            모든 숫자는 어디서 왔는지 근거가 붙어 있고, 계산은 브라우저에서만 됩니다(서버 전송 0건).
          </div>
          <button onClick={dismissHello} aria-label="닫기">✕</button>
        </div>
      )}

      {/* ===== ① 내 조건 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">1</span>내 조건</span>
          <span className="mono-note">입력값은 이 브라우저에만 저장됩니다</span>
        </div>
        <div className="hero-grid">
          <div>
            <TextField label="월 지출" indicator="만원">
              <TextFieldInput type="number" inputMode="numeric" value={state.spend} onChange={(e: any) => set("spend", Number(e.target.value) || 0)} />
            </TextField>
            <Chips label="월 지출 빠른 선택" options={[150, 200, 250, 300]} cur={state.spend} onPick={(v) => set("spend", v)} unit="" />
          </div>
          <div>
            <TextField label="모은 돈 (투자 자산)" indicator="억원" description="전세보증금 제외">
              <TextFieldInput type="number" step="0.1" inputMode="decimal" value={state.asset} onChange={(e: any) => set("asset", Number(e.target.value) || 0)} />
            </TextField>
            <Chips label="모은 돈 빠른 선택" options={[3, 5, 7, 10]} cur={state.asset} onPick={(v) => set("asset", v)} unit="" />
          </div>
          <div>
            <TextField label="출생연도" indicator={`(${age}세)`}>
              <TextFieldInput type="number" inputMode="numeric" value={state.birth} onChange={(e: any) => set("birth", Number(e.target.value) || 1990)} />
            </TextField>
            <Chips label="출생연도 빠른 선택" options={[1980, 1985, 1990, 1995]} cur={state.birth} onPick={(v) => set("birth", v)} unit="" />
          </div>
        </div>
        <div className="row">
          <ActionButton variant="neutralOutline" onClick={() => setShowMore(!showMore)}>
            {showMore ? "상세 조건 접기" : "더 정확히 조정 (전문가용)"}
          </ActionButton>
          <ActionButton variant="brandSolid" onClick={() => copy(shareURL(state), "공유 URL 복사됨 (내 상태 포함)")}>내 결과 공유</ActionButton>
          <ActionButton variant="brandSolid" onClick={saveCard}>결과카드 이미지 저장</ActionButton>
          <ActionButton variant="neutralWeak" onClick={() => copy(mdSummary, "마크다운 요약 복사됨")}>마크다운 요약</ActionButton>
          <ActionButton variant="ghost" onClick={reset}>초기화</ActionButton>
        </div>
      </div>

      {/* ===== ② 답 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">2</span>답</span>
          <span className="mono-note">세전 인출 기준 · 아래에서 근거 확인</span>
        </div>
        {state.spend > 0 ? (
          <>
            <div className="answer-hero">
              <div className="answer-num">
                {(goal4 / 1e8).toFixed(1)}<span className="answer-unit">억</span>
              </div>
              <div>
                <div style={{ fontSize: 14, color: "var(--seed-color-fg-neutral)" }}>
                  월 {state.spend}만원을 쓰려면 <b>4% 룰</b>
                  <Info>미국 30년 데이터에서 나온 규칙: 자산의 4%만 매년 쓰면 대부분 30년을 버팁니다. 한국 데이터로는 더 보수적이어야 해서 3열로 같이 보여줍니다.</Info>
                  로 필요한 돈
                </div>
                <div className={`answer-state ${gap4 >= 0 ? "good" : "bad"}`}>
                  {gap4 >= 0
                    ? `지금 도달했어요 (+${(gap4 / 1e8).toFixed(1)}억 여유)`
                    : `${(-gap4 / 1e8).toFixed(1)}억이 더 필요해요`}
                </div>
              </div>
            </div>
            <div className="gauge" role="img" aria-label={`보유 ${state.asset}억 중 목표 ${(goal4 / 1e8).toFixed(1)}억`}>
              <div className="gauge-track">
                <div
                  className={`gauge-fill ${gap4 >= 0 ? "over" : "under"}`}
                  style={{ width: `${Math.max(2, Math.min(100, (assetWon / goal4) * 100))}%` }}
                />
                <div className="gauge-marker" style={{ left: "calc(100% - 2px)" }} />
              </div>
              <div className="gauge-legend">
                <span>보유 {state.asset}억</span>
                <span>목표(4%) {(goal4 / 1e8).toFixed(1)}억</span>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 13 }}>
              왜 "4%"가 실제로는 <b>{pct(effWr, 2)}</b>가 되는가 →{" "}
              <a href="./four-percent.html">4% 룰, 한국 데이터로 검증한 결과</a> ·{" "}
              <a href="./myeoneok.html">몇억이면 되나 — 계산으로 답한다</a>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 16, color: "var(--seed-color-fg-neutral)" }}>위에 월 지출을 넣어주세요.</div>
        )}
      </div>

      {/* ===== ③ 인출률 3열 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">3</span>안전한 만큼만 쓰면 (인출률 비교)</span>
          <span className="mono-note">하나를 고르라고 하지 않습니다</span>
        </div>
        <div className="kpis">
          {[0.035, 0.04, 0.05].map((r) => {
            const goal = annual / r;
            const gap = assetWon - goal;
            return (
              <div className="kpi" key={r}>
                <div className="k">연 {pct(r)}만 쓸 때</div>
                <div className="v">{(goal / 1e8).toFixed(2)}<span className="unit">억</span></div>
                <div className="s">
                  {gap >= 0 ? <span className="good">달성 (+{(gap / 1e8).toFixed(2)}억)</span> : <span className="neg">부족 {(-gap / 1e8).toFixed(2)}억</span>}
                  <br />
                  {r === 0.035 ? "가장 안전 (보수적)" : r === 0.04 ? "널리 쓰는 기준" : "공격적 (실패 위험↑)"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== ④ 첫해 현금흐름 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">4</span>지금 그만두면 첫해 현금흐름</span>
          <span className="mono-note">
            {{ interest: "전액 이자·배당 (보수적 상한)", dom_sell: "국내 상장주식 매도", mix: "연금계좌 + 국내주식 매도", fgn_sell: "해외주식 매도 (이익률 50%)" }[state.wdl]}
          </span>
        </div>
        <table className="dt">
          <tbody>
            <tr>
              <td>인출액 (세전)</td><td>{fmtW(gross)}원</td>
              <td className="faint">자산 {state.asset}억 × {pct(Number(state.rate))}</td>
            </tr>
            <tr>
              <td>세금<Info>이자·배당은 15.4% 원천징수 후 2,000만원 넘으면 누진과세(금융소득종합과세). 주식 매도는 양도세·거래세가 붙고, 연금계좌는 낮은 연금소득세만 냅니다.</Info></td>
              <td className="neg">-{fmtW(w.tax)}원</td>
              <td className="faint">{w.detail}</td>
            </tr>
            <tr>
              <td>건강보험료+장기요양<Info>직장을 그만두면 지역가입자가 되어 소득(이자·배당 100%, 연금 50%)과 재산에 보험료가 붙습니다. 은퇴 설계에서 가장 큰 숨은 비용이에요.</Info></td>
              <td className="neg">-{fmtW(w.ins)}원</td>
              <td className="faint">월 {fmtW(w.hiM + w.ltcM)} · 반영율 {pct(Number(state.refl), 0)}</td>
            </tr>
            <tr><td>실제 쓸 수 있는 돈 (연)</td><td className="brand">{fmtW(w.net)}원</td><td className="faint">월 {fmtW(w.net / 12)}</td></tr>
            <tr>
              <td>월 지출 대비</td>
              <td>{w.net >= annual ? <span className="good">여유 +{fmtW((w.net - annual) / 12)}/월</span> : <span className="neg">적자 {fmtW((annual - w.net) / 12)}/월</span>}</td>
              <td className="faint"></td>
            </tr>
            <tr>
              <td>유효 인출률<Info>세금과 건보료를 뺀 뒤 실제로 쓸 수 있는 돈의 비율. "4%"가 실제로는 3.2~4.0%로 줄어드는 이유입니다.</Info></td>
              <td className="brand">{pct(effWr, 2)} <span style={{ fontWeight: 400 }}>(명목 {pct(Number(state.rate))})</span></td>
              <td className="faint">이자배당 3.2% vs 국내주식 매도 3.96%</td>
            </tr>
          </tbody>
        </table>
        <div className="card-note">
          건보료가 왜 이렇게 크나 → <a href="./hi-bomb.html">건보료 폭탄 완전 정리</a> ·
          인출 방식(위 상세 조건에서 변경)에 따라 같은 자산에서 수백만원이 왕복합니다.
        </div>
      </div>

      {/* ===== ⑤ 국민연금 브리지 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">5</span>국민연금 — 언제부터 얼마나 받나</span>
          <span className="status-badge confirmed">수령 규칙: 1차 출처 확정</span>
        </div>
        <table className="dt">
          <tbody>
            <tr><td>수령 개시 연령</td><td>{claimAge}세</td><td className="faint">출생연도 매핑 (1969년생+ 65세)</td></tr>
            <tr>
              <td>공백기<Info>은퇴하고 국민연금이 시작되기 전까지 스스로 버텨야 하는 기간. 이 구간의 인출 순서(어떤 통장부터 쓸지)가 세금을 좌우합니다.</Info></td>
              <td>{bridge > 0 ? `${bridge}년` : "없음"}</td>
              <td className="faint">은퇴 {state.retire}세 → 수령 {claimAge}세</td>
            </tr>
            <tr>
              <td>예상 월액<Info>국민연금공단 계산기와 10원 단위까지 같은 내장 산식입니다. 가입 기간·평균 소득(상세 조건)으로 바뀝니다.</Info></td>
              <td className="brand">{fmtM(np.monthly)}만원</td>
              <td className="faint">{np.auto ? `공단 계산기와 10원 단위 일치` : "수동 입력값"}</td>
            </tr>
            <tr><td>더 일찍 받기 (조기노령)</td><td>최대 {claimAge - 5}세부터</td><td className="faint">5년 조기 시 70% = {fmtM(np.monthly * 0.7)}만원 · 소득 발생 시 정지</td></tr>
            <tr><td>더 늦게 받기 (연기)</td><td>최대 70세까지</td><td className="faint">5년 연기 시 136% = {fmtM(np.monthly * 1.36)}만원</td></tr>
            <tr>
              <td>건보료 영향</td>
              <td>공적연금 50% 반영</td>
              <td className="faint">수령 개시 후 건보료 월 +{fmtW(hiLocal(0, np.monthly * 12, 0, 0, state.dep * 1e8, Number(state.refl)).hi - hiLocal(0, 0, 0, 0, state.dep * 1e8, Number(state.refl)).hi)}</td>
            </tr>
          </tbody>
        </table>
        <div className="card-note">
          기금 소진 시점은 계산값이 아닌 시나리오입니다: 정부 공식 2071(수익률 5.5% 가정) / 2064(4.5%) / NABO 2065·2073 — 국가 지급보장이 법에 명문화(법 제3조의2)되어 있습니다.
        </div>
      </div>

      {/* ===== ⑥ 몬테카를로 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">6</span>100명이 같은 조건이면 — 고갈 확률<Info>미국 98년+한국 46년의 실제 역사를 3년 단위로 잘라 재조합해 수천 개의 미래를 만들어 본 결과입니다. 관측된 역사보다 나쁜 미래는 표현하지 못 한다는 한계가 있어요.</Info></span>
          <span className="mono-note">미국+한국 혼합 풀 · 시드 고정(같은 입력=같은 답)</span>
        </div>
        <div className="row">
          <ActionButton variant="brandSolid" onClick={runMCJob}>
            {mc?.running ? "계산 중…" : "4,000개 미래 계산해 보기"}
          </ActionButton>
        </div>
        {mc?.err && <div className="card-note" style={{ color: "var(--bad)" }}>계산 실패: {mc.err}</div>}
        {mc?.res && (
          <div style={{ marginTop: 12 }}>
            <div className="mc-visual">
              <Donut failRate={mc.res.depletionRate} />
              <div className="mc-sentence">
                100명이 내 조건으로 은퇴하면{" "}
                <b style={{ color: mc.res.depletionRate > 0.2 ? "var(--bad)" : mc.res.depletionRate > 0.1 ? "var(--warn)" : "var(--ok)" }}>
                  {Math.round(mc.res.depletionRate * 100)}명
                </b>
                은 중간에 돈이 바닥나고,{" "}
                <b style={{ color: "var(--ok)" }}>{100 - Math.round(mc.res.depletionRate * 100)}명</b>은 끝날 때 돈이 남습니다.
                {mc.sustainable && (
                  <>
                    <br />
                    매년 <b>{pct(mc.sustainable)}</b>까지만 쓰면 100명 중 90명은 안전합니다
                    {sustainNet && <> (세후 월 {fmtW(sustainNet)})</>}.
                  </>
                )}
                <br />
                <span style={{ fontSize: 12, color: "var(--seed-color-fg-neutral)" }}>
                  {mc.years}년 인출 · 국민연금 상쇄 반영 · 세금 미반영 · 실행 {mc.ms}ms
                </span>
              </div>
            </div>
            <div className="kpis" style={{ marginTop: 12 }}>
              <div className="kpi">
                <div className="k">고갈 확률 ({mc.years}년, {pct(Number(state.rate))})</div>
                <div className="v" style={{ color: mc.res.depletionRate > 0.2 ? "var(--bad)" : mc.res.depletionRate > 0.1 ? "var(--warn)" : "var(--ok)" }}>
                  {pct(mc.res.depletionRate)}
                </div>
                <div className="s">국민연금 상쇄 반영 · 세금 미반영</div>
              </div>
              <div className="kpi">
                <div className="k">지속가능 인출률 (고갈 ≤10%)</div>
                <div className="v">{mc.sustainable ? pct(mc.sustainable) : "—"}</div>
                <div className="s">시작 연도 운이 아니라 분포로 판정</div>
              </div>
              <div className="kpi">
                <div className="k">지속가능 월 인출 (세후)</div>
                <div className="v">{sustainNet ? fmtW(sustainNet) : "—"}</div>
                <div className="s">첫해 기준 · 현재 인출 방식 기준</div>
              </div>
            </div>
            <div className="card-note">
              {mc.res.sampleNote} · <b>한계 고지:</b> 관측된 역사(1928~2025)의 재조합이라 그보다 나쁜 꼬리는 없습니다.
              <button onClick={() => setShowBand(!showBand)} style={{ marginLeft: 8, border: "none", background: "none", color: "var(--brand)", cursor: "pointer", textDecoration: "underline", fontSize: "inherit", padding: 0 }}>
                {showBand ? "연도별 그래프 접기" : "연도별 그래프 보기"}
              </button>
            </div>
            {showBand && <BandChart p10={mc.res.real.p10} p50={mc.res.real.p50} p90={mc.res.real.p90} />}
          </div>
        )}
        {!mc && (
          <div className="card-note">
            순환 백테스트의 한계: 한국 데이터 46년이라 30년 창이 17개뿐 — "시작 연도 운"이 확률을 지배합니다.
            역사를 재조합한 수천 경로로 시퀀스 리스크를 분포로 봅니다. 방법론·한계 전문: <a href="./methodology.html">방법론과 한계</a>
          </div>
        )}
      </div>

      {/* ===== ⑦ 또래 비교 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">7</span>또래 중 나는 어디쯤</span>
          <span className="mono-note">가계금융복지조사 2025 · 전국 가구 순자산 10분위</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.6 }}>
          투자자산만 {state.asset}억 → <b>{bandInvest}</b>
          {state.dep > 0 && <> · 전세보증금 포함 {state.asset + state.dep}억 → <b>{bandWithDep}</b></>}
        </div>
        <div className="card-note">
          전세보증금은 만기 전에 쓸 수 없는 돈이라 따로 보여줍니다 · 통계는 가구 기준이라 1인 가구 비교에는 한계 · 자세히: <a href="#band">또래 밴드 탭</a>
        </div>
      </div>

      {/* ===== ⑧ 제보·문서 ===== */}
      <div className="card">
        <div className="card-title">
          <span><span className="step-num">8</span>숫자가 이상하면 제보해주세요</span>
          <span className="mono-note">제보 → 검증 → 반영까지 기록</span>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", fontSize: 13 }}>
          <a href={issueURL} target="_blank" rel="noreferrer">GitHub 이슈로 제보 (입력값 자동 첨부)</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="./isa-2026.html">ISA 만기 데드라인 (2026년 4분기)</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="./report-0.html">또래 밴드 리포트 #0</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="./methodology.html">방법론과 한계</a>
        </div>
      </div>

      {/* ===== 상세 조건 (전문가용) ===== */}
      {showMore && (
        <div className="card">
          <div className="card-title">상세 조건 <span className="mono-note">기본값은 한국 현행 규칙 자동 선택 — 출처 상충 항목만 여기서</span></div>
          <div className="field-grid">
            <TextField label="은퇴(인출 개시) 연령">
              <TextFieldInput type="number" value={state.retire} onChange={(e: any) => set("retire", Number(e.target.value) || 45)} />
            </TextField>
            <TextField label="국민연금 가입 시작 나이" description="자동 계산용 (공단 계산기와 10원 단위 일치)">
              <TextFieldInput type="number" value={state.npjoin} onChange={(e: any) => set("npjoin", Number(e.target.value) || 25)} />
            </TextField>
            <TextField label="평균 소득월액" indicator="만원" description="현재 가치 기준 생애 평균">
              <TextFieldInput type="number" value={state.npsalary} onChange={(e: any) => set("npsalary", Number(e.target.value) || 400)} />
            </TextField>
            <TextField label="국민연금 월액 (수동)" indicator="만원" description="자동 해제 시 사용">
              <TextFieldInput type="number" value={state.np} onChange={(e: any) => set("np", Number(e.target.value) || 60)} />
            </TextField>
            <div style={{ display: "flex", alignItems: "end", paddingBottom: 8 }}>
              <Checkbox label="국민연금 자동 계산" checked={state.npauto} onCheckedChange={(c: any) => set("npauto", c === true)} />
            </div>
            <TextField label="전세보증금" indicator="억원" description="건보료 재산평가 30% 적용">
              <TextFieldInput type="number" step="0.1" value={state.dep} onChange={(e: any) => set("dep", Number(e.target.value) || 0)} />
            </TextField>
            <SelectRoot label="인출 방식" value={[state.wdl]} onValueChange={(v: any) => set("wdl", v[0])}>
              <SelectTrigger placeholder="선택" />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="interest" label="이자·배당 수령 (보수적 상한)" />
                  <SelectItem value="dom_sell" label="국내 상장주식 매도 (소액주주 비과세)" />
                  <SelectItem value="mix" label="연금계좌 1,500만 + 국내주식 매도" />
                  <SelectItem value="fgn_sell" label="해외주식 매도 (이익률 50% 가정)" />
                </SelectGroup>
              </SelectContent>
            </SelectRoot>
            <SelectRoot label="기준 인출률" value={[state.rate]} onValueChange={(v: any) => set("rate", v[0])}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="0.035" label="3.5%" />
                  <SelectItem value="0.04" label="4.0%" />
                  <SelectItem value="0.05" label="5.0%" />
                </SelectGroup>
              </SelectContent>
            </SelectRoot>
            <SelectRoot label="인플레이션 가정" value={[state.infl]} onValueChange={(v: any) => set("infl", v[0])}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="hist" label="역사 CPI" />
                  <SelectItem value="0.025" label="고정 2.5%" />
                  <SelectItem value="0.0325" label="생활물가 3.25%" />
                </SelectGroup>
              </SelectContent>
            </SelectRoot>
            <SelectRoot label="인출 전략" value={[state.strat]} onValueChange={(v: any) => set("strat", v[0])}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="fixed" label="고정 실질 (4%류)" />
                  <SelectItem value="pct" label="포트폴리오 비율" />
                  <SelectItem value="guard" label="가드레일" />
                </SelectGroup>
              </SelectContent>
            </SelectRoot>
            <SelectRoot label="건보료 반영율 (출처 상충 토글)" value={[state.refl]} onValueChange={(v: any) => set("refl", v[0])}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="0.5" label="현행 50% (2022.9~)" />
                  <SelectItem value="0.3" label="과거 30% (재현용)" />
                </SelectGroup>
              </SelectContent>
            </SelectRoot>
            <TextField label="주식 비중" indicator={`% (${state.mix}주식/${100 - state.mix}채권)`}>
              <TextFieldInput type="number" step="5" min="0" max="100" value={state.mix} onChange={(e: any) => set("mix", Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
            </TextField>
          </div>
        </div>
      )}

      {/* ===== 모바일 하단 고정 답 바 ===== */}
      <div className="sticky-bar" aria-hidden="false">
        <div className="sb-main">
          <div className="sb-num">
            {state.spend > 0 ? (
              <>
                {(goal4 / 1e8).toFixed(1)}억
                <span style={{ fontSize: 13, fontWeight: 700, color: gap4 >= 0 ? "var(--ok)" : "var(--bad)", marginLeft: 8 }}>
                  {gap4 >= 0 ? `도달 (+${(gap4 / 1e8).toFixed(1)})` : `${(-gap4 / 1e8).toFixed(1)}억 더`}
                </span>
              </>
            ) : "지출 입력"}
          </div>
          <div className="sb-sub">월 {state.spend || "-"}만원 기준 4% 룰 · 상태는 공유 링크에만 담깁니다</div>
        </div>
        <ActionButton variant="brandSolid" className="shrink" onClick={() => copy(shareURL(state), "공유 URL 복사됨")}>공유</ActionButton>
      </div>
    </div>
  );
}

/* ---------- MC 도넛 ---------- */
function Donut({ failRate }: { failRate: number }) {
  const R = 44, C = 2 * Math.PI * R;
  const failLen = C * Math.min(1, Math.max(0, failRate));
  return (
    <svg className="donut" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`100명 중 ${Math.round(failRate * 100)}명 고갈`}>
      <circle className="track" cx="60" cy="60" r={R} fill="none" strokeWidth="12" />
      <circle className="pass" cx="60" cy="60" r={R} fill="none" strokeWidth="12" strokeDasharray={`${C - failLen} ${C}`} transform="rotate(-90 60 60)" strokeLinecap="round" opacity="0.9" />
      <circle className="fail" cx="60" cy="60" r={R} fill="none" strokeWidth="12" strokeDasharray={`${failLen} ${C}`} strokeDashoffset={-(C - failLen)} transform="rotate(-90 60 60)" strokeLinecap="round" />
      <text x="60" y="56" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--seed-color-fg-normal)">{Math.round(failRate * 100)}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="11" fill="var(--seed-color-fg-neutral)">명 고갈 / 100</text>
    </svg>
  );
}

/* ---------- 연도별 밴드 SVG ---------- */
function BandChart({ p10, p50, p90 }: { p10: number[]; p50: number[]; p90: number[] }) {
  const W = 100, H = 40;
  const n = p50.length;
  const maxY = Math.max(1.2, ...p90.map((v) => v));
  const x = (i: number) => (i / Math.max(1, n - 1)) * W;
  const y = (v: number) => H - (v / maxY) * (H - 4) - 2;
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `${line(p90)} L${x(n - 1).toFixed(2)},${y(p10[n - 1]).toFixed(2)} ${p10.slice().reverse().map((v, i) => `L${x(n - 1 - i).toFixed(2)},${y(v).toFixed(2)}`).join(" ")} Z`;
  return (
    <div style={{ marginTop: 10 }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180, background: "rgba(127,127,127,0.08)", borderRadius: 8 }}>
        <line x1="0" y1={y(1)} x2={W} y2={y(1)} stroke="rgba(127,127,127,0.5)" strokeDasharray="1 1" strokeWidth="0.3" />
        <text x="1" y={y(1) - 0.8} fontSize="2" fill="rgba(127,127,127,0.9)">초기자산 1.0×</text>
        <path d={area} fill="rgba(230,82,0,0.15)" />
        <path d={line(p10)} fill="none" stroke="#e65200" strokeWidth="0.4" strokeDasharray="1.5 1" />
        <path d={line(p90)} fill="none" stroke="#e65200" strokeWidth="0.4" strokeDasharray="1.5 1" />
        <path d={line(p50)} fill="none" stroke="#e65200" strokeWidth="0.8" />
      </svg>
      <div className="card-note" style={{ marginTop: 6 }}>
        실질(인플레 조정) 포트폴리오 · 주황 실선 p50, 점선 p10/p90, 음영 p10~p90 구간 · 가로축 인출 1~{n}년차
      </div>
    </div>
  );
}
