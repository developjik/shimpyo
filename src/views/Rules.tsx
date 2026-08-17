import { RULES } from "../lib/engine";

const T = RULES.tax, H = RULES.hi, N = RULES.np;

const GROUPS: [string, string, string, [string, string, "confirmed" | "pending" | "conflicted"][]][] = [
  ["국민연금", N.src, N.srcUrl, [
    ["수령 개시 연령(1969년생+)", "65세", "confirmed"],
    ["조기 감액", "연 6% (최대 5년, 70~94%)", "confirmed"],
    ["연기 가산", "월 0.6% (최대 5년, +36%)", "confirmed"],
    ["A값 (2026)", "3,193,511원", "confirmed"],
    ["계수 스택", "~2007 1.8 · 2008~25 1.5→1.245 · 2026~ 1.29 (=3×43%)", "confirmed"],
  ]],
  ["건강보험 (지역가입)", H.src, H.srcUrl, [
    ["보험료율 (2026)", "7.19%", "confirmed"],
    ["이자·배당 반영", "100%", "confirmed"],
    ["근로·공적연금 반영", "50% (2022.9~)", "confirmed"],
    ["재산 기본공제", "일괄 1억 (2024.2~)", "confirmed"],
    ["재산등급표", "별표4 60등급 (22점~2,341점, 2026.2 시행본)", "confirmed"],
    ["재산점수당", "211.5원 (2026)", "confirmed"],
    ["장기요양", "건보료의 13.14%", "confirmed"],
    ["하한/상한", "20,160원 ~ 4,591,740원", "confirmed"],
    ["자동차 부과", "폐지 (2024.2~)", "confirmed"],
  ]],
  ["소득세·양도세", T.src, T.srcUrl, [
    ["금종과세 임계", "2,000만원", "confirmed"],
    ["원천징수", "15.4%", "confirmed"],
    ["종합 누진 (최저~최고)", "6.6% ~ 49.5% (2026 구간)", "confirmed"],
    ["연금소득 저율", "5.5 / 4.4 / 3.3%", "confirmed"],
    ["연금소득 종합과세 임계", "1,500만원", "confirmed"],
    ["ISA 초과분", "9.9%", "confirmed"],
    ["해외주식 양도세", "22% · 기본공제 250만", "confirmed"],
    ["증권거래세 (2026)", "실효 0.20%", "confirmed"],
    ["고배당 분리과세", "14~30% (2026~2028 한시)", "confirmed"],
  ]],
  ["ISA 개편", "2026 세제개편안 (계류)", "https://imnews.imbc.com/replay/2026/nwtoday/article/6844125_37012.html", [
    ["현행 체계", "200/400만 비과세 · 9.9% · 이월 가능", "confirmed"],
    ["생산적금융 ISA", "국내주식 전액 비과세안 — 12월 국회 목표", "pending"],
  ]],
  ["기금 소진 (표시 전용)", "복지부 · NABO", "https://nabo.go.kr/ko/notice/noticeAllView.do?idx=8755", [
    ["정부 공식", "2071 (수익률 5.5% 가정)", "confirmed"],
    ["정부 4.5% 시나리오", "2064 (2차 확인)", "conflicted"],
    ["NABO", "2065 · +1%p 시 2073", "confirmed"],
  ]],
];

export default function RulesView() {
  return (
    <div className="card">
      <div className="card-title">
        이 사이트의 모든 상수
        <span className="mono-note">계산 코어에는 상수가 없습니다. 전부 이 테이블에서 옵니다.</span>
      </div>
      {GROUPS.map(([title, srcName, srcUrl, rows]) => (
        <div key={title} style={{ marginBottom: 20 }}>
          <table className="dt">
            <thead><tr><th style={{ width: "38%" }}>{title} 상수</th><th>값</th><th>상태</th></tr></thead>
            <tbody>
              {rows.map(([k, v, s]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                  <td><span className={`status-badge ${s}`}>{s === "confirmed" ? "확정" : s === "pending" ? "계류" : "상충·토글"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="src-line">출처: <a href={srcUrl} target="_blank" rel="noreferrer">{srcName}</a> · 확인 {RULES.verified}</div>
        </div>
      ))}
      <div className="card-note">
        출처 등급: law 법령 원문 &gt; notice 고시·보도자료 &gt; page 공단 페이지 &gt; media 언론.
        NHIS 공단 홈페이지 일부 정적 페이지는 2020년 값이 잔존해 신뢰 금지 목록에 있습니다 — 이 사이트 초기 리서치에서 실제로 오염되었고, 위 값들은 그 정정본입니다.
      </div>
    </div>
  );
}
