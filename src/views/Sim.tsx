import { useMemo, useState } from "react";
import { ActionButton } from "seed-design/ui/action-button";
import { TextField, TextFieldInput } from "seed-design/ui/text-field";
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectTrigger } from "seed-design/ui/select";
import { Checkbox } from "seed-design/ui/checkbox";
import { useSnackbarAdapter, Snackbar } from "seed-design/ui/snackbar";
import {
  RULES, finTax, hiLocal, npClaimAge, npPension, withdrawAfterTax,
  fmtW, pct, fmtM,
} from "../lib/engine";
import { shareURL, type SimState } from "../store";

interface Props {
  state: SimState;
  set: <K extends keyof SimState>(k: K, v: SimState[K]) => void;
  reset: () => void;
}

export default function SimView({ state, set, reset }: Props) {
  const snackbar = useSnackbarAdapter();
  const [showMore, setShowMore] = useState(false);

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

  const toast = (msg: string) =>
    snackbar.create({
      onClose: () => {},
      render: () => <Snackbar message={msg} />,
    });

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("복사 실패"); }
  };

  const mdSummary =
    `**쉼표 계산 결과** (rules ${RULES.version}, ${RULES.verified})\n` +
    `- 월 지출: ${state.spend}만원 · 투자자산: ${state.asset}억\n` +
    `- 목표자산: @3.5% ${(annual / 0.035 / 1e8).toFixed(2)}억 / @4% ${(annual / 0.04 / 1e8).toFixed(2)}억 / @5% ${(annual / 0.05 / 1e8).toFixed(2)}억\n` +
    `- 첫해 실가용: ${(w.net / 1e7).toFixed(1)}천만원 · 유효 인출률 ${(effWr * 100).toFixed(2)}%\n` +
    `- 국민연금 수령: ${claimAge}세 (공백기 ${bridge}년)\n` +
    `근거·출처: ${shareURL(state)}`;

  return (
    <div>
      <div className="card">
        <div className="card-title">
          입력
          <span className="mono-note">입력값은 브라우저(localStorage)에만 저장됩니다 · 서버 전송 없음</span>
        </div>
        <div className="hero-grid">
          <TextField label="월 지출" indicator="만원">
            <TextFieldInput type="number" value={state.spend} onChange={(e: any) => set("spend", Number(e.target.value) || 0)} />
          </TextField>
          <TextField label="투자 자산" indicator="억원" description="전세보증금 제외">
            <TextFieldInput type="number" step="0.1" value={state.asset} onChange={(e: any) => set("asset", Number(e.target.value) || 0)} />
          </TextField>
        </div>

        <div className="row">
          <ActionButton variant="neutralOutline" onClick={() => setShowMore(!showMore)}>
            {showMore ? "상세 조건 접기" : "상세 조건 열기"}
          </ActionButton>
          <ActionButton variant="brandSolid" onClick={() => copy(shareURL(state), "공유 URL 복사됨")}>URL 공유 복사</ActionButton>
          <ActionButton variant="neutralWeak" onClick={() => copy(mdSummary, "마크다운 요약 복사됨")}>마크다운 요약</ActionButton>
          <ActionButton variant="ghost" onClick={reset}>초기화</ActionButton>
        </div>

        {showMore && (
          <div className="field-grid" style={{ marginTop: 12 }}>
            <TextField label="출생연도">
              <TextFieldInput type="number" value={state.birth} onChange={(e: any) => set("birth", Number(e.target.value) || 1990)} />
            </TextField>
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
        )}
      </div>

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
        <div className="card-note">매도 인출(양도세·기본공제)이나 연금계좌(건보료 면제) 전환 시 실가용이 달라집니다. 인출 방식을 바꿔가며 비교해 보세요.</div>
      </div>

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
    </div>
  );
}
