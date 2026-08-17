import { useMemo, useState } from "react";
import { ActionButton } from "seed-design/ui/action-button";
import { runGolden, RULES, DATA } from "../lib/engine";

export default function GoldenView() {
  const [nonce, setNonce] = useState(0);
  const cases = useMemo(() => runGolden(), [nonce]);
  let pass = 0, fail = 0, defer = 0;
  cases.forEach((c) => { if ((c as any).deferred) defer++; else Math.abs((c as any).got - (c as any).expect) <= 1 ? pass++ : fail++; });

  return (
    <div className="card">
      <div className="card-title">
        골든 케이스 회귀 테스트
        <ActionButton variant="neutralOutline" size="small" onClick={() => setNonce(nonce + 1)}>재실행</ActionButton>
      </div>
      <div className="card-note" style={{ marginTop: 0, marginBottom: 10 }}>
        상수를 갱신하면 과거 고시로 재계산해 이 값이 나오는지 검증합니다. 하나라도 깨지면 배포하지 않는 규칙입니다 —
        CI(GitHub Actions)도 매 푸시마다 동일한 로직으로 이 테스트를 돌려 실패 시 배포를 차단합니다. 현재{" "}
        <b className={fail ? "pos" : "good"}>{pass} PASS / {fail} FAIL / {defer} 이연</b>
        (rules {RULES.version} · {RULES.verified} · 미국 {DATA.us.rows.length}년 · 한국 {DATA.kr.rows.length}년 임베드)
      </div>
      {cases.map((c: any, i: number) =>
        c.deferred ? (
          <div key={c.id + i}>
            <div className="test-line"><span>{c.id} {c.title} <span className="status-badge pending">이연</span></span></div>
            <div className="test-sub">{c.note}</div>
          </div>
        ) : (
          <div key={c.id + i}>
            <div className="test-line">
              <span>{c.id} {c.title}</span>
              <span className={Math.abs(c.got - c.expect) <= 1 ? "good" : "pos"}>
                {Math.abs(c.got - c.expect) <= 1 ? "PASS" : `FAIL ${c.got} ≠ ${c.expect}`}
              </span>
            </div>
            <div className="test-sub">{c.note}</div>
          </div>
        ),
      )}
    </div>
  );
}
