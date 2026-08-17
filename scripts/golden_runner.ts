/**
 * golden_runner.ts — 계산 엔진(src/lib/engine.ts)을 직접 임포트해 골든 케이스를 검증.
 * 하나라도 FAIL이면 exit 1 (배포 차단). 앱과 CI가 같은 소스를 공유한다.
 */
import { runGolden, RULES, DATA } from "../src/lib/engine.ts";

const cases = runGolden();
let fail = 0, pass = 0, defer = 0;
for (const c of cases as any[]) {
  if (c.deferred) { defer++; console.log(`  DEFER  ${c.id} ${c.title}`); continue; }
  const ok = Math.abs(c.got - c.expect) <= 1;
  ok ? pass++ : fail++;
  console.log(`${ok ? "  PASS " : "  FAIL "} ${c.id} ${c.title} → ${c.got} (expect ${c.expect})`);
}
console.log(`\nrules ${RULES.version} (verified ${RULES.verified}): ${pass} PASS / ${fail} FAIL / ${defer} DEFER`);
console.log(`data: US ${DATA.us.rows.length}y (${DATA.us.rows[0][0]}-${DATA.us.rows[DATA.us.rows.length - 1][0]}), KR ${DATA.kr.rows.length}y`);
process.exit(fail ? 1 : 0);
