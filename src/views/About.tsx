import { RULES } from "../lib/engine";

export default function AboutView() {
  return (
    <div className="card">
      <div className="card-title">방법론과 한계</div>
      <table className="dt">
        <tbody>
          <tr><td>세전→세후 순서</td><td className="faint" style={{ whiteSpace: "normal" }}>금융소득(원천 15.4% → 2,000만 초과분 종합과세, 인적공제 150만 적용 근사) → 연금소득(연 1,500만 임계) → 건보료(지역가입: 이자·배당 100%, 공적연금 50% 반영, 재산은 과표 기준 1억 공제 후 별표4 등급 lookup, LTC 13.14%)</td></tr>
          <tr><td>재산보험료</td><td className="faint" style={{ whiteSpace: "normal" }}>시행령 [별표4] 원문 60등급표(시행 2026.2.19본)로 계산. 재산금액 = 재산세과표 + 전월세보증금×30% − 1억(−주택부채공제) 후 등급 lookup, 점수×211.5원. 초기 근사식은 과표 9억에서 +347% 과대평가로 폐기(G12)</td></tr>
          <tr><td>국민연금</td><td className="faint" style={{ whiteSpace: "normal" }}>월액 = floor10(K̄×(A+B)×(P/240)/12)+부양가족. 계수 스택(~2007 1.8 / 2008~25 1.5→1.245 / 2026~ 1.29=3×43%)과 10원 절사까지 공단 예상연금 간단계산과 10원 단위 일치(2026-08-17, G1~G3). B값은 "평균 실질 소득" 단일 입력 근사</td></tr>
          <tr><td>백테스트</td><td className="faint" style={{ whiteSpace: "normal" }}>연 단위. 미국 1928~(S&P500 TR + 10Y 국채 TR, Damodaran·FRED 교차검증). 한국 1982~(KOSPI PR, 배당 토글 시 2001~ TR 근사) + 국고채3Y YTM(1998~2025). 혼합 포트폴리오의 한국 30년 사이클은 겹침 부족으로 주식 100% 대체 표시</td></tr>
          <tr><td>데이터 갱신</td><td className="faint" style={{ whiteSpace: "normal" }}>매월 5일 GitHub Actions가 ECOS(한국은행)를 받아 골든 케이스 15개를 재검증 — 실패 시 배포 차단. 제도 상수(고시)는 연 1~2회 수동 갱신 후 검증 탭에서 확인</td></tr>
          <tr><td>계류 이슈</td><td className="faint" style={{ whiteSpace: "normal" }}>생산적금융 ISA(2026.12 국회 목표), 건보료 상하한 개편안, 배당가산율 11%(2027). 통과 시 rules 테이블 갱신 + 골든 케이스가 검증</td></tr>
          <tr><td>면책</td><td className="faint" style={{ whiteSpace: "normal" }}>투자자문이 아닙니다. 부부 세대 분리, 임의계속가입, 퇴직소득, 비상장·부동산은 미반영. 숫자 옆 출처를 열어 직접 검증하세요</td></tr>
        </tbody>
      </table>
      <div className="src-line">쉼표 v1.0 (Seed Design 리뉴얼) · 상수 검증 {RULES.verified} · 골든 케이스 러너가 상시 상주합니다</div>
    </div>
  );
}
