#!/usr/bin/env python3
"""
ecos_update.py v2 — ECOS 월간 스냅샷 (2026-08-17 키 실측 기준 재작성)

이 키(MZA2…)의 실측 제약:
  - 페이지네이션 차단: 요청시작건수 > 1 거부 (ERROR-301) → 조회는 항상 start=1, 100건 이내
    시간창으로 해결 (월 단위 창은 최대 ~23행)
  - 접근 표: 802Y001(주식시장 일별), 731Y001(환율 일별) 확인. 901Y001(CPI), 국고채 표는
    이 키 범위 밖(INFO-200) → CPI·국고채는 연 1~2회 수동 갱신 (rules 관리 규칙)

수집: KOSPI/원달러 — 최근 14일 + 직전 연도 12월 + 금연도 12월(도달 시).
용도: 데이터 신선도 모니터링 + 한국 시계열 연말 종점 자동 검증 (임베드값 대조).
"""
import argparse, json, sys, urllib.request
from datetime import date, timedelta

BASE = "https://ecos.bok.or.kr/api"

def call(key, stat, item, freq, start, end):
    url = (f"{BASE}/StatisticSearch/{key}/json/kr/1/100/{stat}/{freq}/{start}/{end}/{item}")
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.load(r)
    rows = data.get("StatisticSearch", {}).get("row")
    if rows is None:
        raise SystemExit(f"ECOS empty/error: {stat}/{item} {start}-{end}: "
                         f"{json.dumps(data.get('RESULT', {}), ensure_ascii=False)}")
    return [(r["TIME"], float(r["DATA_VALUE"])) for r in rows]

def month_window(y, m):
    import calendar
    last = calendar.monthrange(y, m)[1]
    return f"{y}{m:02d}01", f"{y}{m:02d}{last}"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    today = date.today()
    prev_dec = month_window(today.year - 1, 12)
    this_dec = month_window(today.year, 12) if today.month == 12 else None
    recent = ((today - timedelta(days=14)).strftime("%Y%m%d"), today.strftime("%Y%m%d"))

    kospi, usd = {}, {}
    kospi["recent_14d"] = call(a.key, "802Y001", "0001000", "D", *recent)
    kospi[f"dec_{today.year-1}"] = call(a.key, "802Y001", "0001000", "D", *prev_dec)
    usd["recent_14d"] = call(a.key, "731Y001", "0000001", "D", *recent)
    usd[f"dec_{today.year-1}"] = call(a.key, "731Y001", "0000001", "D", *prev_dec)
    if this_dec:
        kospi[f"dec_{today.year}"] = call(a.key, "802Y001", "0001000", "D", *this_dec)
        usd[f"dec_{today.year}"] = call(a.key, "731Y001", "0000001", "D", *this_dec)

    snapshot = {
        "fetched_at": today.isoformat(),
        "series": {
            "kospi_daily": {k: {"last_time": v[-1][0], "last_value": v[-1][1], "rows": len(v)} for k, v in kospi.items()},
            "usdkrw_daily": {k: {"last_time": v[-1][0], "last_value": v[-1][1], "rows": len(v)} for k, v in usd.items()},
            "raw": {"kospi": kospi, "usd": usd},
        },
        "limitations": [
            "이 키는 페이지네이션 차단(시작건수>1 불가) 및 접근 표 제한 있음 (2026-08-17 실측)",
            "CPI(901Y001)·국고채 계열은 이 키 범위 밖 — 연 1~2회 수동 갱신",
            "원본 통계: 한국은행 ECOS (출처 표기 조건으로 자유 이용)",
        ],
    }
    out = f"{a.out.rstrip('/')}/ecos_snapshot.json"
    import os
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=1)
    ky = kospi.get(f"dec_{today.year-1}", [])
    print(f"OK → {out}")
    print(f"  KOSPI 최근: {kospi['recent_14d'][-1][0]} {kospi['recent_14d'][-1][1]}")
    print(f"  KOSPI {today.year-1} 연말종가: {ky[-1][1] if ky else 'N/A'} (임베드값과 대조)")

if __name__ == "__main__":
    main()
