#!/usr/bin/env node
/**
 * golden_runner.mjs — index.html의 계산 로직을 그대로 로드해 골든 케이스를 CI에서 돌린다.
 * 하나라도 FAIL이면 exit 1 (배포 차단). 이 스크립트가 "죽음 테스트"의 기계 절반이다.
 *
 * 원칙: 계산 로직의 단일 출처는 index.html 이다. 러너는 복제본을 쓰지 않는다.
 */
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/g);
if (!m) { console.error("no script block"); process.exit(1); }
const src = m[m.length - 1].replace(/<\/?script>/g, "");

// 최소 DOM 스텁: 최상위가 DOM에 손대지 않고 정의만 하도록 init 호출을 막는다
const stub = `
const document = { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] };
const window = { addEventListener: () => {} };
const location = { hash: "" };
const localStorage = { getItem: () => null, setItem: () => {} };
const navigator = {};
`;

const sandbox = new Function(`${stub}\n${src}\nreturn { runGolden, RULES };`);
const { runGolden, RULES } = sandbox();

const cases = runGolden();
let fail = 0, pass = 0, deferred = 0;
for (const c of cases) {
  if (c.deferred) { deferred++; console.log(`  DEFER  ${c.id} ${c.title}`); continue; }
  const ok = Math.abs(c.got - c.expect) <= 1;
  ok ? pass++ : fail++;
  console.log(`${ok ? "  PASS " : "  FAIL "} ${c.id} ${c.title} → ${c.got} (expect ${c.expect})`);
}
console.log(`\nrules ${RULES.version} (verified ${RULES.verified}): ${pass} PASS / ${fail} FAIL / ${deferred} DEFER`);
process.exit(fail ? 1 : 0);
