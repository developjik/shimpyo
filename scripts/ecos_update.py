#!/usr/bin/env python3
"""
ecos_update.py — 한국은행 ECOS에서 월간 시계열을 받아 data/*.json 으로 저장한다.
사용: python3 ecos_update.py --key $ECOS_KEY --out ../data/

ECOS 키 발급: https://ecos.bok.or.kr → 오픈API → 인증키 신청 (무료, 통상 1일 내)
통계코드 (ECOS 통계검색으로 확정 필요 — 아래는 초기 세팅값):
  - 국고채 3년 (일별 시장금리): 719Y001 / 항목 010200000  (백필·스플라이스는 별표4/채권 에이전트 결과 반영 시 갱신)
  - 소비자물가지수 (연간): 901Y001
  - 원/달러 환율: 731Y001

설계 규칙:
  - 이 스크립트는 data/ecos_snapshot.json 만 쓴다. index.html 의 임베드 시계일은
    사람이 검토 후 수동 반영한다 (골든 러너가 배포를 막는 구조라 자동 오염이 불가).
  - 호출 실패/결측은 예외로 죽는다 (조용한 오답 방지).
"""
import argparse, json, sys, urllib.request, urllib.parse
from datetime import date

BASE = "https://ecos.bok.or.kr/api"

def call(key, stat, item, freq, start, end):
    """ECOS StatisticSearch — 실패 시 즉시 예외"""
    url = (f"{BASE}/StatisticSearch/{key}/json/kr/1/1000/"
           f"{stat}/{freq}/{start}/{end}/{item}")
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.load(r)
    rows = (data.get("StatisticSearch", {}).get("row") or [])
    if not rows:
        raise SystemExit(f"ECOS empty: {stat}/{item} {start}-{end} — 결측을 무시하지 않고 중단")
    return [(row["TIME"], float(row["DATA_VALUE"])) for row in rows]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--start", default="198001")
    ap.add_argument("--end", default=date.today().strftime("%Y%m"))
    a = ap.parse_args()

    snapshot = {
        "fetched_at": date.today().isoformat(),
        "series": {
            # 통계코드는 첫 실행 시 ECOS 통계검색 화면과 대조해 확정할 것
            "bond3y": call(a.key, "719Y001", "010200000", "M", a.start, a.end),
            "cpi":    call(a.key, "901Y001", "0",        "A", a.start[:4], a.end[:4]),
            "usdkrw": call(a.key, "731Y001", "0000001",  "M", a.start, a.end),
        },
    }
    out = f"{a.out.rstrip('/')}/ecos_snapshot.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=1)
    print(f"OK → {out} (bond3y {len(snapshot['series']['bond3y'])} rows)")

if __name__ == "__main__":
    main()
