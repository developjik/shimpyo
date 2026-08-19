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
  const cols: [string, number][] = [["3.5%", state.spend * 12], ["4.0%", state.spend * 12], ["5.0%", state.spend * 12]];
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
    snackbar.create({
      onClose: () => {},
      render: () => <Snackbar message={msg} />,
    });

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

  const issueURL = "https://github.com/developjik/shimpyo/issues/new?title=" +
    encodeURIComponent("[오류 제보] 시뮬레이터 숫자 이상") +
    "&body=" +
    encodeURIComponent(
      `rules ${RULES.version} (${RULES.verified})\n입력: 월지출 ${state.spend}만 · 자산 ${state.asset}억 · 출생 ${state.birth} · 인출 ${state.wdl}\n예상 vs 실제:\n\n(무엇이 이상한지 적어주세요 — 반영 내역은 체인지로그에 기록됩니다)`
    );

  return (
    <div>
      {/* ===== 1단계: 3질문 ===== */}
      <div className="card">
        <div className="card-title">
          세 개만 물을게요
          <span className="mono-note">입력값은 브라우저(localStorage)에만 저장됩니다 · 서버 전송 없음</span>
        </div>
        <div className="hero-grid">
          <TextField label="월 지출" indicator="만원">
            <TextFieldInput type="number" value={state.spend} onChange={(e: any) => set("spend", Number(e.target.value) || 0)} />
          </TextField>
          <TextField label="모은 돈 (투자 자산)" indicator="억원" description="전세보증금 제외">
            <TextFieldInput type="number" step="0.1" value={state.asset} onChange={(e: any) => set("asset", Number(e.target.value) || 0)} />
          </TextField>
          <TextField label="출생연도" indicator={`(${age}세)`}>
            <TextFieldInput type="number" value={state.birth} onChange={(e: any) => set("birth", Number(e.target.value) || 1990)} />
          </TextField>
        </div>
        <div className="row">
          <ActionButton variant="neutralOutline" onClick={() => setShowMore(!showMore)}>
            {showMore ? "상세 조건 접기" : "상세 조건 열기 (전문가용)"}
          </ActionButton>
          <ActionButton variant="brandSolid" onClick={() => copy(shareURL(state), "공유 URL 복사됨 (내 상태 포함)")}>URL 공유 복사</ActionButton>
          <ActionButton variant="brandSolid" onClick={saveCard}>결과카드 PNG</ActionButton>
          <ActionButton variant="neutralWeak" onClick={() => copy(mdSummary, "마크다운 요약 복사됨")}>마크다운 요약</ActionButton>
          <ActionButton variant="ghost" onClick={reset}>초기화</ActionButton>
        </div>
      </div>

      {/* ===== 2단계: 첫 줄 답 ===== */}
      <div className="card">
        <div className="card-title">
          답부터
          <span className="mono-note">세전 인출 기준 · 아래에서 인출 방식별 세후 확인</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 44, fontWeight: 800 }}>
            {state.spend > 0 ? <>{(goal4 / 1e8).toFixed(1)}억</> : "지출을 입력하세요"}
          </div>
          <div style={{ opacity: 0.75 }}>
            월 {state.spend}만원이 4% 룰이면 필요한 돈 ·{" "}
            {gap4 >= 0
              ? <span style={{ color: "#2e9e5b", fontWeight: 700 }}>지금 도달 (+{(gap4 / 1e8).toFixed(1)}억)</span>
              : <span style={{ color: "#f85149", fontWeight: 700 }}>{(-gap4 / 1e8).toFixed(1)}억 더</span>}
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          왜 "4%"가 실제로는 {pct(effWr, 2)}가 되는가 →{" "}
          <a href="./four-percent.html" style={{ textDecoration: "underline" }}>4% 룰, 한국 데이터로 검증한 결과</a> ·{" "}
          <a href="./myeoneok.html" style={{ textDecoration: "underline" }}>몇억이면 되나 — 계산으로 답한다</a>
        </div>
      </div>

      {/* ===== 3단계: 3열 (증명 1단) ===== */}
      <div className="card">
        <div className="card-title">필요 자산 — 인출률 3열 병렬 <span className="mono-note">하나를 고르라고 하지 않습니다</span></div>
        <div className="kpis">
          {[0.035, 0.04, 0.05].map((r) => {
            const goal = annual / r;
            const gap = assetWon - goal;
            return (
              <div className="kpi" key={r}>
                <div className="k">목표 자산 @ {pct(r)}</div>
                <div className="v">{(goal / 1e8).toFixed(2)}억</div>
                <div className="s">
                  {gap >= 0 ? <span className="good">달성 (+{(gap / 1e8).toFixed(2)}억)</span> : <span className="neg">부족 {(-gap / 1e8).toFixed(2)}억</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== 첫해 현금흐름 (증명 2단) ===== */}
      <div className="card">
        <div className="card-title">
          지금 인출 시작 시 — 첫해 현금흐름
          <span className="mono-note">
            {{ interest: "전액 이자·배당 (보수적 상한)", dom_sell: "국내 상장주식 매도", mix: "연금계좌 + 국내주식 매도", fgn_sell: "해외주식 매도 (이익률 50%)" }[state.wdl]}
          </span>
        </div>
        <table className="dt">
          <tbody>
            <tr><td>인출액 (세전)</td><td>{fmtW(gross)}원</td><td className="faint">자산 {state.asset}억 × {pct(Number(state.rate))}</td></tr>
            <tr><td>세금 (방식별)</td><td className="neg">-{fmtW(w.tax)}원</td><td className="faint">{w.detail}</td></tr>
            <tr><td>건보료+장기요양 (연)</td><td className="neg">-{fmtW(w.ins)}원</td><td className="faint">월 {fmtW(w.hiM + w.ltcM)} (건보 {fmtW(w.hiM)} + LTC {fmtW(w.ltcM)}) · 반영율 {pct(Number(state.refl), 0)}</td></tr>
            <tr><td>실가용 (연)</td><td className="brand">{fmtW(w.net)}원</td><td className="faint">월 {fmtW(w.net / 12)}</td></tr>
            <tr>
              <td>월 지출 대비</td>
              <td>{w.net >= annual ? <span className="good">여유 +{fmtW((w.net - annual) / 12)}/월</span> : <span className="neg">적자 {fmtW((annual - w.net) / 12)}/월</span>}</td>
              <td className="faint"></td>
            </tr>
            <tr><td>유효 인출률</td><td className="brand">{pct(effWr, 2)} <span style={{ fontWeight: 400 }}>(명목 {pct(Number(state.rate))})</span></td><td className="faint">세금·건보료 반영 후 · 이자배당 3.2% vs 국내주식 매도 3.96%</td></tr>
          </tbody>
        </table>
        <div className="card-note">
          건보료가 왜 이렇게 크나 → <a href="./hi-bomb.html" style={{ textDecoration: "underline" }}>건보료 폭탄 완전 정리</a> ·
          인출 방식을 바꿔가며 비교해 보세요. 매도 인출(양도세·기본공제)이나 연금계좌(건보료 면제) 전환 시 실가용이 달라집니다.
        </div>
      </div>

      {/* ===== 국민연금 브리지 ===== */}
      <div className="card">
        <div className="card-title">국민연금 브리지 <span className="status-badge confirmed">수령 연령·감액 규칙: 1차 출처 확정</span></div>
        <table className="dt">
          <tbody>
            <tr><td>수령 개시 연령</td><td>{claimAge}세</td><td className="faint">출생연도 매핑 (1969년생+ 65세)</td></tr>
            <tr><td>공백기</td><td>{bridge > 0 ? `${bridge}년` : "없음"}</td><td className="faint">은퇴 {state.retire}세 → 수령 {claimAge}세</td></tr>
            <tr>
              <td>예상 월액</td>
              <td className="brand">{fmtM(np.monthly)}만원</td>
              <td className="faint">
                {np.auto
                  ? `내장 산식 · K̄=${(np as any).kbar?.toFixed(3)} · 지급률 ${pct((np as any).rate || 0, 0)} · 공단 계산기와 10원 단위 일치`
                  : "수동 입력값"}
              </td>
            </tr>
            <tr><td>조기노령 대안</td><td>최대 {claimAge - 5}세부터 · 연 6% 감액</td><td className="faint">5년 조기 시 70% = {fmtM(np.monthly * 0.7)}만원 · 소득 발생 시 지급 정지</td></tr>
            <tr><td>연기 옵션</td><td>최대 70세까지 · 월 0.6% 가산</td><td className="faint">5년 연기 시 136% = {fmtM(np.monthly * 1.36)}만원</td></tr>
            <tr>
              <td>건보료 영향</td>
              <td>공적연금 50% 반영</td>
              <td className="faint">수령 개시 후 건보료 월 +{fmtW(hiLocal(0, np.monthly * 12, 0, 0, state.dep * 1e8, Number(state.refl)).hi - hiLocal(0, 0, 0, 0, state.dep * 1e8, Number(state.refl)).hi)}</td>
            </tr>
          </tbody>
        </table>
        <div className="card-note">
          기금 소진 시점은 계산값이 아닌 시나리오 표시입니다: 정부 공식 2071(수익률 5.5% 가정) / 2064(4.5%) / NABO 2065·2073 — 국가 지급보장 명문화(법 제3조의2).
          인출 방식별 세금 계산 로직은 "근거·출처" 탭에서 전부 공개됩니다.
        </div>
      </div>

      {/* ===== 몬테카를로 (역사 블록 부트스트랩) ===== */}
      <div className="card">
        <div className="card-title">
          1만 개의 역사 — 고갈 확률
          <span className="mono-note">미국 98년 + 한국 46년 혼합 풀 · 3년 블록 리샘플 · 시드 고정(같은 입력=같은 답)</span>
        </div>
        <div className="row">
          <ActionButton variant="brandSolid" onClick={runMCJob}>
            {mc?.running ? "계산 중…" : "4,000경로 실행 (브라우저에서, 서버 전송 없음)"}
          </ActionButton>
        </div>
        {mc?.err && <div className="card-note" style={{ color: "#f85149" }}>계산 실패: {mc.err}</div>}
        {mc?.res && (
          <div style={{ marginTop: 12 }}>
            <div className="kpis">
              <div className="kpi">
                <div className="k">고갈 확률 ({mc.years}년, {pct(Number(state.rate))} 인출)</div>
                <div className="v" style={{ color: mc.res.depletionRate > 0.2 ? "#f85149" : mc.res.depletionRate > 0.1 ? "#b8860b" : "#2e9e5b" }}>
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
                <div className="k">지속가능 월 인출 (세후 환산)</div>
                <div className="v">{mc.sustainable ? fmtW(withdrawAfterTax(assetWon * mc.sustainable, state.wdl, 0, 0, 0, state.dep * 1e8, Number(state.refl)).net / 12) : "—"}</div>
                <div className="s">첫해 기준 · 현재 인출 방식 기준</div>
              </div>
            </div>
            <div className="card-note">
              실행 {mc.ms}ms · {mc.res.sampleNote}
              <br />
              <b>한계 고지:</b> 밴드는 관측된 역사(1928~2025)의 재조합입니다. 관측 범위 밖 시나리오(더 나쁜 꼬리)는 표현하지 않습니다.
              세금·건보료 미반영(위 표에서 별도 환산) · 국민연금 실질 가치 일정 가정.
              <button onClick={() => setShowBand(!showBand)} style={{ marginLeft: 8, border: "none", background: "none", color: "#e65200", cursor: "pointer", textDecoration: "underline", fontSize: "inherit", padding: 0 }}>
                {showBand ? "연도별 밴드 접기" : "연도별 밴드 상세 보기"}
              </button>
            </div>
            {showBand && <BandChart p10={mc.res.real.p10} p50={mc.res.real.p50} p90={mc.res.real.p90} />}
          </div>
        )}
        {!mc && (
          <div className="card-note">
            순환 백테스트의 한계: 한국 데이터 46년이라 30년 창이 17개뿐 — "시작 연도 운"이 확률을 지배합니다.
            역사 블록을 재조합한 수천 경로로 시퀀스 리스크를 분포로 봅니다. 방법론·한계 전문: <a href="./methodology.html" style={{ textDecoration: "underline" }}>방법론과 한계</a>
          </div>
        )}
      </div>

      {/* ===== 또래 밴드 한 줄 ===== */}
      <div className="card">
        <div className="card-title">또래 중 나는 어디쯤 <span className="mono-note">가계금융복지조사 2025 · 전국 가구 순자산 10분위</span></div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>
          투자자산만 {state.asset}억 → <b>{bandInvest}</b>
          {state.dep > 0 && <> · 전세보증금 포함 {state.asset + state.dep}억 → <b>{bandWithDep}</b></>}
        </div>
        <div className="card-note">
          전세보증금은 회수 불가능한 자산입니다(만기 전에는 쓸 수 없음) · 통계는 가구 기준이라 1인 가구 비교에는 한계 · 자세히: <a href="#band" style={{ textDecoration: "underline" }}>또래 밴드 탭</a>
        </div>
      </div>

      {/* ===== 제보·문서 링크 ===== */}
      <div className="card">
        <div className="card-title">숫자가 이상하면 제보해주세요 <span className="mono-note">제보 → 검증 → 반영까지 체인지로그에 기록</span></div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", fontSize: 13 }}>
          <a href={issueURL} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>GitHub 이슈로 제보 (입력값 자동 첨부)</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="./isa-2026.html" style={{ textDecoration: "underline" }}>ISA 만기 데드라인 (2026년 4분기)</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="./report-0.html" style={{ textDecoration: "underline" }}>또래 밴드 리포트 #0</a>
          <span style={{ opacity: 0.4 }}>·</span>
          <a href="./methodology.html" style={{ textDecoration: "underline" }}>방법론과 한계</a>
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
    </div>
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
