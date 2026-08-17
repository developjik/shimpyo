import { useMemo, useState } from "react";
import { SelectContent, SelectGroup, SelectItem, SelectRoot, SelectTrigger } from "seed-design/ui/select";
import { TextField, TextFieldInput } from "seed-design/ui/text-field";
import { ActionButton } from "seed-design/ui/action-button";
import { BAND, bandPercentile, nationalDecile } from "../lib/engine";
import type { SimState } from "../store";

const TK_KEY = "shimpyo.tracker.v1";

interface TrackRow { d: string; net: number; fin: number; goal: number }

export default function BandView({ state }: { state: SimState }) {
  const [bandKey, setBandKey] = useState<keyof typeof BAND.age_bands>("30s");
  const [mine, setMine] = useState(() => Number((state.asset + state.dep).toFixed(1)));
  const [tkNet, setTkNet] = useState(mine);
  const [tkFin, setTkFin] = useState(2);
  const [tkGoal, setTkGoal] = useState(50);
  const [tracks, setTracks] = useState<TrackRow[]>(() => {
    try { return JSON.parse(localStorage.getItem(TK_KEY) || "[]"); } catch { return []; }
  });

  const band = BAND.age_bands[bandKey];
  const prev = (BAND.age_bands_2024 as any)[bandKey];

  const bars = useMemo(() => {
    const maxV = Math.max(mine, band.net_p50, band.net_avg, BAND.national_deciles.P90) * 1.05;
    const rows = [
      { label: "P90 (전국)", v: BAND.national_deciles.P90, brand: false },
      { label: "평균", v: band.net_avg, brand: false },
      { label: "중앙값", v: band.net_p50, brand: false },
      { label: "저축중앙", v: band.sav_med, brand: false },
    ];
    return { rows, maxV };
  }, [mine, bandKey]);

  const saveTrack = () => {
    const rec = { d: new Date().toISOString().slice(0, 10), net: tkNet, fin: tkFin, goal: tkGoal };
    const next = [...tracks, rec];
    setTracks(next);
    try { localStorage.setItem(TK_KEY, JSON.stringify(next)); } catch {}
  };
  const delTrack = (i: number) => {
    const next = tracks.filter((_, idx) => idx !== i);
    setTracks(next);
    try { localStorage.setItem(TK_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          또래 밴드 — 내 위치는 공공 통계로
          <span className="mono-note">가계금융복지조사 {BAND.survey_year} (자산 {BAND.survey_year}.3월말) · 한은 통계표 + KOSIS 교차 일치</span>
        </div>
        <div className="field-grid">
          <SelectRoot label="연령대 (가구주)" value={[bandKey as string]} onValueChange={(v: any) => setBandKey(v[0])}>
            <SelectTrigger />
            <SelectContent>
              <SelectGroup>
                {(Object.keys(BAND.age_bands) as (keyof typeof BAND.age_bands)[]).map((k) => (
                  <SelectItem key={k} value={k as string} label={(BAND.age_bands[k] as any).label} />
                ))}
              </SelectGroup>
            </SelectContent>
          </SelectRoot>
          <TextField label="내 순자산" indicator="억원" description="시뮬레이터 입력(투자자산+전세보증금)과 연동">
            <TextFieldInput type="number" step="0.1" value={mine} onChange={(e: any) => setMine(Number(e.target.value) || 0)} />
          </TextField>
        </div>

        <table className="dt" style={{ marginTop: 12 }}>
          <tbody>
            <tr>
              <td>내 위치 (또래 순자산)</td>
              <td className="brand">{bandPercentile(mine, bandKey as any)} · {mine.toFixed(2)}억</td>
              <td className="faint">중앙값 대비 {(mine / band.net_p50).toFixed(2)}배</td>
            </tr>
            <tr><td>내 위치 (전국 10분위)</td><td>{nationalDecile(mine)}</td><td className="faint">전 세대 기준 — 연령 보정 안 됨</td></tr>
            <tr>
              <td>순자산 중앙값 ({band.label})</td>
              <td>{band.net_p50.toFixed(2)}억</td>
              <td className="faint">{prev ? `전년 ${prev.net_p50.toFixed(2)}억 ${band.net_p50 >= prev.net_p50 ? "▲" : "▼"} ${Math.abs(band.net_p50 - prev.net_p50).toFixed(2)}` : ""}</td>
            </tr>
            <tr><td>순자산 평균</td><td>{band.net_avg.toFixed(2)}억</td><td className="faint">상위 가구에 끌림 — 중앙값과 함께</td></tr>
            <tr><td>저축액 중앙값 (보증금 제외)</td><td>{band.sav_med.toFixed(2)}억</td><td className="faint">내 투자자산 {state.asset.toFixed(2)}억 vs 저축 중앙값 → 가장 비교 가능한 한 쌍</td></tr>
            <tr><td>가구소득 중앙값</td><td>{band.income_med.toFixed(0)}만원</td><td className="faint">경상소득</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: 12 }}>
          {bars.rows.map((r) => (
            <div className="bar-row" key={r.label}>
              <span className="bar-label">{r.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(100, (r.v / bars.maxV) * 100)}%` }} />
              </div>
              <span className="bar-value">{r.v.toFixed(2)}억</span>
            </div>
          ))}
          <div className="bar-row">
            <span className="bar-label" style={{ color: "var(--seed-color-fg-brand)", fontWeight: 700 }}>나</span>
            <div className="bar-track" style={{ border: "1px solid var(--seed-color-fg-brand)" }}>
              <div className="bar-fill brand" style={{ width: `${Math.min(100, (mine / bars.maxV) * 100)}%` }} />
              <div className="bar-marker" style={{ left: `${Math.min(100, (mine / bars.maxV) * 100)}%` }} />
            </div>
            <span className="bar-value brand">{mine.toFixed(2)}억</span>
          </div>
        </div>
        <div className="card-note">
          연령별 P25/75/90은 한국은행·KOSIS에 공표되지 않아 중앙값·평균 기반입니다(원시 마이크로데이터로 확대 예정).
          순자산은 부동산 포함 — 시뮬레이터의 "투자자산+전세"와 정의가 다르므로 대략 비교. 이 표는 통계이며 개인 성과와 무관합니다.
        </div>
      </div>

      <div className="card">
        <div className="card-title">내 기록 — 익명 점수 트래커 <span className="status-badge confirmed">브라우저 로컬 저장 · 서버 전송 0건</span></div>
        <div className="field-grid">
          <TextField label="기록할 순자산" indicator="억">
            <TextFieldInput type="number" step="0.1" value={tkNet} onChange={(e: any) => setTkNet(Number(e.target.value) || 0)} />
          </TextField>
          <TextField label="금융자산" indicator="억 · 전세 제외">
            <TextFieldInput type="number" step="0.1" value={tkFin} onChange={(e: any) => setTkFin(Number(e.target.value) || 0)} />
          </TextField>
          <TextField label="은퇴 목표 나이">
            <TextFieldInput type="number" value={tkGoal} onChange={(e: any) => setTkGoal(Number(e.target.value) || 50)} />
          </TextField>
          <div style={{ display: "flex", alignItems: "end", paddingBottom: 4 }}>
            <ActionButton variant="brandSolid" onClick={saveTrack}>기록 저장</ActionButton>
          </div>
        </div>
        {tracks.length > 0 ? (
          <table className="dt" style={{ marginTop: 12 }}>
            <thead><tr><th>기록일</th><th>순자산</th><th>금융자산</th><th>목표 나이</th><th></th></tr></thead>
            <tbody>
              {tracks.map((t, i) => (
                <tr key={t.d + i}>
                  <td>{t.d}</td><td>{t.net}억</td><td>{t.fin}억</td><td>{t.goal}세</td>
                  <td><ActionButton variant="ghost" size="small" onClick={() => delTrack(i)}>삭제</ActionButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="card-note">기록이 없습니다. 분기마다 한 줄씩 남겨보세요 — 데이터는 이 브라우저에만 있습니다.</div>
        )}
        <div className="card-note">
          원격 익명 집계는 백엔드 연결 후 켭니다(스키마·전환 플래그 저장소 준비 완료, 신원 항목 0개·구간 값만).
        </div>
      </div>

      <div className="card">
        <div className="card-title">편집 캘린더 — 재방문 사유는 주기가 만든다</div>
        <table className="dt">
          <thead><tr><th>항목</th><th>시점</th><th>내용</th><th>상태</th></tr></thead>
          <tbody>
            <tr><td>발표 #0</td><td>즉시</td><td className="faint">공공 데이터 기반 또래 밴드 리포트</td><td><a href="./report-0.html">보기</a></td></tr>
            <tr><td>발표 #1 (분기)</td><td>분기 말</td><td className="faint">상수 갱신 리포트 + 밴드 리뷰</td><td>준비</td></tr>
            <tr><td>정기 점검</td><td>매년 1~2월</td><td className="faint">고시 시즌 상수 갱신 (A값·건보료·세율)</td><td>규칙</td></tr>
            <tr><td>골든 케이스</td><td>매월 5일</td><td className="faint">ECOS 갱신 + 회귀 테스트 (Actions 자동)</td><td>자동</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
