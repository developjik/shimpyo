// ==========================================================
// 쉼표 계산 엔진 — DOM 없는 순수 모듈 (React 앱과 CI 골든 러너가 공유)
// 상수는 RULES만이 소유. 원본: index.html v0.3 (2026-08-17 검증본)
// ==========================================================
export const RULES = {
  version: "v0.1", verified: "2026-08-17",
  np: {
    claimAge: {"1953-1956":61,"1957-1960":62,"1961-1964":63,"1965-1968":64,"1969+":65},
    earlySchedule:[0.70,0.76,0.82,0.88,0.94],
    deferralPerMonth:0.006, deferralMaxMonths:60,
    a_value:3193511,
    src:"국민연금공단 · 법률 제20615호 · 2026 고시",
    srcUrl:"https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0056M0.do"
  },
  hi: {
    rate:0.0719, reflLaborPension:0.50, reflFinOther:1.00,
    propertyDeduction:100000000, propertyPointWon:211.5, propertyPointPerKrw:186000, /* legacy 근사 — 미사용 */
    ltcRatio:0.1314, floor:20160, cap:4591740, depositEval:0.30,
    src:"건강보험법 시행령 제44조·별표4(60등급, 시행 2026.2.19본) · 복지부 2단계 개편 12문12답",
    srcUrl:"https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=4&cciNo=1&cnpClsNo=1&csmSeq=1141"
  },
  tax: {
    finThreshold:20000000, withheld:0.154, personalDeduction:1500000,
    brackets:[[14000000,0.066],[50000000,0.165],[88000000,0.198],[150000000,0.264],[300000000,0.33],[500000000,0.385],[1000000000,0.418],[Infinity,0.495]],
    pensionLow:{"<70":0.055,"70-79":0.044,"80+":0.033}, pensionThreshold:15000000,
    isaExcess:0.099, isaFree:{general:2000000,farmer:4000000},
    fGainsDeduction:2500000, fGainsRate:0.22, tradeTax:0.0020,
    src:"소득세법 §16② · 국세청(7888/8800) · 2026 구간 개정",
    srcUrl:"https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7888"
  },
  npFund:{label:"정부 공식 2071 (수익률 5.5%)", toggles:[2064,2065,2073]}
};

const fmtW = n => Math.round(n).toLocaleString('ko-KR');            // 원
const fmtM = n => (n/10000).toLocaleString('ko-KR',{maximumFractionDigits:0});   // 만원
const fmtE = n => (n/100000000).toLocaleString('ko-KR',{maximumFractionDigits:2}); // 억
const pct = (n,d=1) => (n*100).toFixed(d)+"%";
/* ---------- 엔진: 소득세(금종과세) ---------- */
export function finTax(gross){
  const T = RULES.tax;
  if(gross <= T.finThreshold) return {withheld: gross*T.withheld, comp:0, total: gross*T.withheld};
  const base = Math.max(0, gross - T.finThreshold - T.personalDeduction);
  let tax=0, prev=0;
  for(const [lim,rate] of T.brackets){ tax += Math.max(0, Math.min(base,lim)-prev)*rate; if(base<=lim) break; prev=lim; }
  const withheld = T.finThreshold*T.withheld;
  return {withheld, comp:tax, total: withheld+tax};
}
/* 별표4 제3호 재산등급표 — 시행령 원본(2026.2.19 시행본, 대통령령 제36116호)에서 추출.
   [재산금액 상한(만원), 부과점수]. 재산금액 = (재산세과표 + 전월세 평가액) − 1억 − 주택부채공제. */
export const HI_GRADES =[[450,22],[900,44],[1350,66],[1800,97],[2250,122],[2700,146],[3150,171],[3600,195],[4050,219],[4500,244],[5020,268],[5590,294],[6220,320],[6930,344],[7710,365],[8590,386],[9570,412],[10700,439],[11900,465],[13300,490],[14800,516],[16400,535],[18300,559],[20400,586],[22700,611],[25300,637],[28100,659],[31300,681],[34900,706],[38800,731],[43200,757],[48100,785],[53600,812],[59700,841],[66500,881],[74000,921],[82400,961],[91800,1001],[103000,1041],[114000,1091],[127000,1141],[142000,1191],[158000,1241],[176000,1291],[196000,1341],[218000,1391],[242000,1451],[270000,1511],[300000,1571],[330000,1641],[363000,1711],[399300,1781],[439230,1851],[483153,1921],[531468,1991],[584615,2061],[643077,2131],[707385,2201],[778124,2271],[Infinity,2341]];
export function hiPropertyPoints(baseWon){
  if(baseWon<=0) return 0;
  const m = baseWon/10000;
  for(const [ceil,pts] of HI_GRADES){ if(m<=ceil) return pts; }
  return 2341;
}
/* ---------- 엔진: 건보료(지역가입) ---------- */
export function hiLocal(finIncome, publicPensionAnnual, laborAnnual, propertyTaxBase, deposit, reflOverride){
  const H = RULES.hi;
  const refl = (reflOverride!=null)?reflOverride:H.reflLaborPension;
  const incomeMonthly = ((finIncome*H.reflFinOther + (publicPensionAnnual+laborAnnual)*refl)/12)*H.rate;
  const propBase = Math.max(0, propertyTaxBase + deposit*H.depositEval - H.propertyDeduction);
  const propMonthly = hiPropertyPoints(propBase) * H.propertyPointWon;
  let hi = incomeMonthly + propMonthly;
  hi = Math.min(Math.max(hi, H.floor), H.cap);
  const ltc = hi*H.ltcRatio;
  return {incomeMonthly, propMonthly, hi, ltc, total: hi+ltc};
}
/* ---------- 국민연금 스케줄 ---------- */
export function npClaimAge(birth){
  const T=RULES.np;
  if(birth<=1956) return T.claimAge["1953-1956"];
  if(birth<=1960) return T.claimAge["1957-1960"];
  if(birth<=1964) return T.claimAge["1961-1964"];
  if(birth<=1968) return T.claimAge["1965-1968"];
  return T.claimAge["1969+"];
}
/* 국민연금 월액 — 공단 간단계산기와 10원 단위 일치 검증 (2026-08-17)
   산식: 월액 = floor10( K̄ × (A+B) × (P/240) / 12 ) + 부양가족
   계수 스택: ~2007: 1.8 · 2008~2025: 1.5-0.015×(y-2008) · 2026~: 1.29 (=3×43%) */
export const npCoef = y => y<=2007?1.8 : y<=2025?1.5-0.015*(y-2008) : 1.29;
export const floor10 = x => Math.floor(x/10)*10;
export function npPension(birth, joinAge, avgIncome, opts={}){
  const {earlyYears=0, deferMonths=0, spouse=0, childParent=0} = opts;
  const A = RULES.np.a_value, B = avgIncome;
  const claimAge = 65;
  const startYear = birth + joinAge, endYear = birth + claimAge - 1;
  if(endYear < startYear) return {monthly:0,kbar:0,rate:0,P:0};
  const P = (claimAge - joinAge) * 12;
  if(P < 120) return {monthly:0,kbar:0,rate:0,P};
  let ksum=0, n=0;
  for(let y=startYear;y<=endYear;y++){ ksum += npCoef(y); n++; }
  const kbar = ksum/n;
  const base = kbar * (A + B) * (P/240) / 12;
  const depAmt = spouse*25550 + childParent*17030;
  let monthly;
  if(earlyYears>0){
    const cut = {1:.94,2:.88,3:.82,4:.76,5:.70}[Math.min(5,earlyYears)];
    monthly = floor10(base*cut) + depAmt;
  } else {
    monthly = floor10(base) + depAmt;
    if(deferMonths>0) monthly *= 1 + 0.006*Math.min(60,deferMonths);
  }
  monthly = Math.min(monthly, B); // 상한 캡(부양가족 포함, 단일소득 모델 근사)
  return {monthly:Math.round(monthly), kbar, rate:P/240, P};
}


/* ---------- 골든 케이스 러너 (G4~G10) ---------- */
export function runGolden(){
  const cases=[];
  // G4: 이자배당 1,500만 + 재산과표 9,000만
  let g4 = hiLocal(15000000,0,0,90000000,0);
  cases.push({id:"G4",title:"건보료: 이자배당 1,500만 + 재산과표 9,000만",expect:101685,got:Math.round(g4.total),
    note:"재산 < 1억 → 재산분 0. 세법(2,000만) 미터짐에도 건보료 발생"});
  // G5: 금종과세 3,000만 단독
  let g5 = finTax(30000000);
  cases.push({id:"G5",title:"금종과세: 이자배당 3,000만 단독",expect:3641000,got:Math.round(g5.total),note:"2,000만 원천 + 초과분 6.6% 구간"});
  // G6: 연금계좌 1,500만 (55세)
  cases.push({id:"G6",title:"연금계좌 수령 1,500만 (55세)",expect:825000,got:Math.round(15000000*RULES.tax.pensionLow["<70"]),note:"종합과세 임계 경계"});
  // G7: ISA 초과 300만
  cases.push({id:"G7",title:"ISA 일반형 초과 300만",expect:297000,got:Math.round(3000000*RULES.tax.isaExcess),note:"9.9% 분리과세"});
  // G8: 해외주식 양도 1,200만
  cases.push({id:"G8",title:"해외주식 양도차익 1,200만",expect:2090000,got:Math.round((12000000-RULES.tax.fGainsDeduction)*RULES.tax.fGainsRate),note:"250만 공제 후 22%"});
  // G9: 목표액 3열 (월 200만)
  cases.push({id:"G9",title:"목표액: 월 200만 지출 @4%",expect:600000000,got:Math.round(24000000/0.04),note:"3.5%: 6.86억 / 5%: 4.8억"});
  // G10: 10억 x 4% 유효 인출률
  let tax10 = finTax(40000000);
  let hi10 = hiLocal(40000000,0,0,0,0);
  const net10 = 40000000 - tax10.total - hi10.total*12;
  cases.push({id:"G10",title:"4%의 실체: 10억 x 4% 실가용",expect:31999594,got:Math.round(net10),note:"유효 인출률 "+(net10/1000000000*100).toFixed(2)+"%"});
  // G11/G12: 별표4 60등급표 원문 검증 (근사식은 과표 9억에서 +347% 오차 — 2026-08-17 교체)
  const g11 = hiLocal(0,0,0,300000000,0);
  cases.push({id:"G11",title:"재산보험료: 과표 3억 (2억→24등급 586점)",expect:123939,got:Math.round(g11.hi),note:"586점×211.5원 · 별표4 원문"});
  const g12 = hiLocal(0,0,0,900000000,0);
  cases.push({id:"G12",title:"재산보험료: 과표 9억 (8억→37등급 961점)",expect:203252,got:Math.round(g12.hi),note:"961점×211.5원 · 구 근사식은 909,677원(+347%)으로 과대평가"});
  // G10 변형: 인출 방식별 유효 인출률 (10억×4%)
  const wb = withdrawAfterTax(40000000,"dom_sell",0,0,0,0,0.5);
  cases.push({id:"G10b",title:"인출: 국내주식 매도 10억×4%",expect:39646292,got:Math.round(wb.net),note:"거래세 8만 + 하한 건보료 → 유효 3.96%"});
  const wc = withdrawAfterTax(40000000,"mix",0,0,0,0,0.5);
  cases.push({id:"G10c",title:"인출: 연금 1,500만+매도 혼합",expect:38851292,got:Math.round(wc.net),note:"연금세 82.5만 + 거래세 5만 → 유효 3.89%"});
  const wd = withdrawAfterTax(40000000,"fgn_sell",0,0,0,0,0.5);
  cases.push({id:"G10d",title:"인출: 해외주식 매도(이익 50%)",expect:35876292,got:Math.round(wd.net),note:"양도세 385만 → 유효 3.59%"});
  // G1~G3: 국민연금 산식 (공단 계산기 10원 단위 일치, 2026-08-17 검증)
  const g1 = npPension(2001,25,4000000);                      // 2026 가입 40년 프록시
  cases.push({id:"G1",title:"국민연금 40년 가입 (2026+ 계수 1.29)",expect:1546600,got:g1.monthly,note:"공단 계산기 1,546,600원과 10원 단위 일치"});
  const g2 = npPension(2001,30,4000000,{earlyYears:5});       // 35년 가입 + 5년 조기
  cases.push({id:"G2",title:"조기노령 5년 감액 (35년 가입 × 0.70)",expect:947290,got:g2.monthly,note:"공단 35년 1,353,270 × 70% = 947,290"});
  const g3 = npPension(2001,25,4000000,{deferMonths:60});     // 40년 + 5년 연기
  cases.push({id:"G3",title:"연기 60개월 가산 (× 1.36)",expect:2103376,got:g3.monthly,note:"1,546,600 × 1.36 · 법 제52조 월 0.6%"});
  return cases;
}
/* 인출 방식별 세후·건보료 변환. gross=연 인출액, npAnnual=공적연금 연액, propTaxBase/dep=재산 */
export function withdrawAfterTax(gross, mode, npAnnual, laborAnnual, propTaxBase, deposit, refl){
  const T=RULES.tax;
  let tax=0, finIncome=0, detail="";
  const hiZero = hiLocal(0, npAnnual, laborAnnual, propTaxBase, deposit, refl); // 인출 소득 0 기준 (재산분+하한)
  if(mode==="interest"){
    finIncome = gross; tax = finTax(gross).total; detail = "소득세(원천+종합) · 건보료 이자배당 100% 반영";
    const h = hiLocal(gross+npAnnual*0, npAnnual, laborAnnual, propTaxBase, deposit, refl); // finIncome 포함
    return {tax, ins:(h.total)*12, net: gross - tax - h.total*12, detail, hiM:h.hi, ltcM:h.ltc};
  }
  if(mode==="dom_sell"){
    tax = gross*T.tradeTax; detail = "장내 소액주주 양도세 0 · 거래세 0.20% · 매도차익은 건보료 소득 아님(하한만)";
    return {tax, ins: hiZero.total*12, net: gross - tax - hiZero.total*12, detail, hiM:hiZero.hi, ltcM:hiZero.ltc};
  }
  if(mode==="mix"){
    const pensionPart = Math.min(gross, 15000000); // 연금소득 종합과세 임계 이하만
    const sellPart = gross - pensionPart;
    const t1 = pensionPart*T.pensionLow["<70"];   // 5.5% 원천 (55~69세)
    const t2 = sellPart*T.tradeTax;
    tax = t1+t2; detail = `연금 ${fmtW(pensionPart)}×5.5% + 매도 ${fmtW(sellPart)}×0.20% · 사적연금·매도차익 모두 건보료 소듀 아님(하한만)`;
    return {tax, ins: hiZero.total*12, net: gross - tax - hiZero.total*12, detail, hiM:hiZero.hi, ltcM:hiZero.ltc};
  }
  if(mode==="fgn_sell"){
    const gain = gross*0.5;
    tax = Math.max(0, gain - T.fGainsDeduction)*T.fGainsRate;
    detail = "(매도액×이익률 50% − 250만 공제) × 22% · 해외 양도소득은 건보료 미포함(하한만)";
    return {tax, ins: hiZero.total*12, net: gross - tax - hiZero.total*12, detail, hiM:hiZero.hi, ltcM:hiZero.ltc};
  }
}
/* =========================================================
   또래 밴드 — 가계금융복지조사 공공 데이터 (에이전트 결과 주입 슬롯)
========================================================= */
export const BAND = {
  survey_year: 2025, source: "https://www.bok.or.kr/portal/bbs/B0000501/view.do?nttId=10094917",
  source_label: "한국은행 보도자료 통계표 + KOSIS DT_1HDAAA06 (전 수치 교차 일치)",
  age_bands: {
    "20s":{label:"가구주 29세 이하", net_p50:0.50, net_avg:1.08, fin_avg:0.88, fin_med:0.52, sav_avg:0.39, sav_med:0.19, income_avg:45.09, income_med:38.73, hh_pct:4.0},
    "30s":{label:"가구주 30~39세", net_p50:1.5585, net_avg:2.51, fin_avg:1.41, fin_med:0.933, sav_avg:0.70, sav_med:0.43, income_avg:73.86, income_med:62.19, hh_pct:14.4},
    "40s":{label:"가구주 40~49세", net_p50:2.8384, net_avg:4.84, fin_avg:1.64, fin_med:0.846, sav_avg:1.08, sav_med:0.59, income_avg:93.33, income_med:78.01, hh_pct:18.6},
    "50s":{label:"가구주 50~59세", net_p50:3.1685, net_avg:5.52, fin_avg:1.65, fin_med:0.810, sav_avg:1.32, sav_med:0.63, income_avg:94.16, income_med:78.05, hh_pct:22.3},
    "60s":{label:"가구주 60세 이상", net_p50:2.50, net_avg:5.36, fin_avg:1.12, fin_med:0.415, sav_avg:0.95, sav_med:0.32, income_avg:57.67, income_med:39.78, hh_pct:40.7}
  },
  age_bands_2024: { "20s":{net_p50:0.509}, "30s":{net_p50:1.595}, "40s":{net_p50:2.9032}, "50s":{net_p50:3.0454}, "60s":{net_p50:2.52} },
  national_deciles: {P10:0.121,P20:0.5108,P30:1.0296,P40:1.6472,P50:2.386,P60:3.305,P70:4.618,P80:6.938,P90:11.002},
  all: { net_avg:4.714, net_med:2.386 }
};
export function bandPercentile(mine, band){
  const b = BAND.age_bands[band]; if(!b || b.net_p50==null) return null;
  return mine>=b.net_p50? ">중앙값" : "<중앙값";
}
export function nationalDecile(mine){
  const D=BAND.national_deciles; const ks=Object.keys(D);
  for(const k of ks){ if(mine<=D[k]) return k+" 이하"; }
  return ">P90";
}
export const DATA ={us:null,kr:null}; // 파싱 후 {rows:[[year,stock,bond|null,cpi],...], kind, src}
/* 임베드 시계열 — 출처·검증은 방법론 뷰 참조 */
export const US_CSV =`year,stock_tr,bond_tr,cpi
1928,0.438112,0.008355,-0.011561
1929,-0.082979,0.042038,0.005848
1930,-0.251236,0.045409,-0.063953
1931,-0.438375,-0.025589,-0.093168
1932,-0.086424,0.087903,-0.102740
1933,0.499822,0.018553,0.007634
1934,-0.011886,0.079634,0.015152
1935,0.467404,0.044720,0.029851
1936,0.319434,0.050179,0.014493
1937,-0.353367,0.013791,0.028571
1938,0.292827,0.042132,-0.027778
1939,-0.010976,0.044123,0.000000
1940,-0.106729,0.054025,0.007143
1941,-0.127715,-0.020222,0.099291
1942,0.191738,0.022949,0.090323
1943,0.250613,0.024900,0.029586
1944,0.190307,0.025776,0.022988
1945,0.358211,0.038044,0.022472
1946,-0.084291,0.031284,0.181319
1947,0.052000,0.009197,0.088372
1948,0.057046,0.019510,0.029915
1949,0.183032,0.046635,-0.020747
1950,0.308055,0.004296,0.059322
1951,0.236785,-0.002953,0.060000
1952,0.181510,0.022680,0.007547
1953,-0.012082,0.041438,0.007491
1954,0.525633,0.032898,-0.007435
1955,0.325973,-0.013364,0.003745
1956,0.074395,-0.022558,0.029851
1957,-0.104574,0.067970,0.028986
1958,0.437200,-0.020990,0.017606
1959,0.120565,-0.026466,0.017301
1960,0.003365,0.116395,0.013605
1961,0.266377,0.020609,0.006711
1962,-0.088115,0.056935,0.013333
1963,0.226119,0.016842,0.016447
1964,0.164155,0.037281,0.009709
1965,0.123992,0.007189,0.019231
1966,-0.099710,0.029079,0.034591
1967,0.238030,-0.015806,0.030395
1968,0.108149,0.032746,0.047198
1969,-0.082414,-0.050140,0.061972
1970,0.035611,0.167547,0.055703
1971,0.142212,0.097869,0.032663
1972,0.187554,0.028184,0.034063
1973,-0.143080,0.036587,0.087059
1974,-0.259018,0.019886,0.123377
1975,0.369951,0.036053,0.069364
1976,0.238310,0.159846,0.048649
1977,-0.069797,0.012900,0.067010
1978,0.065093,-0.007776,0.090177
1979,0.185195,0.006707,0.132939
1980,0.317352,-0.029897,0.125163
1981,-0.047024,0.081992,0.089224
1982,0.204191,0.328145,0.038298
1983,0.223372,0.032002,0.037910
1984,0.061461,0.137334,0.039487
1985,0.312351,0.257125,0.037987
1986,0.184946,0.242842,0.010979
1987,0.058127,-0.049605,0.044344
1988,0.165372,0.082236,0.044194
1989,0.314752,0.176936,0.046473
1990,-0.030645,0.062354,0.061063
1991,0.302348,0.150045,0.030643
1992,0.074937,0.093616,0.029007
1993,0.099671,0.142110,0.027484
1994,0.013259,-0.080367,0.026749
1995,0.371952,0.234808,0.025384
1996,0.226810,0.014286,0.033225
1997,0.331037,0.099391,0.017024
1998,0.283380,0.149214,0.016119
1999,0.208854,-0.082542,0.026846
2000,-0.090318,0.166553,0.033868
2001,-0.118498,0.055722,0.015517
2002,-0.219660,0.151164,0.023769
2003,0.283558,0.003753,0.018795
2004,0.107428,0.044907,0.032556
2005,0.048345,0.028675,0.034157
2006,0.156126,0.019610,0.025406
2007,0.054847,0.102099,0.040813
2008,-0.365523,0.201013,0.000914
2009,0.259352,-0.111167,0.027213
2010,0.148211,0.084629,0.014957
2011,0.020984,0.160353,0.029624
2012,0.158906,0.029716,0.017410
2013,0.321451,-0.091046,0.015017
2014,0.135244,0.107462,0.007565
2015,0.013789,0.012843,0.007295
2016,0.117731,0.006906,0.020746
2017,0.216055,0.028017,0.021091
2018,-0.042269,-0.000167,0.019102
2019,0.312117,0.096356,0.022851
2020,0.180232,0.113319,0.013620
2021,0.284689,-0.044160,0.070364
2022,-0.180375,-0.178282,0.064544
2023,0.260607,0.038800,0.033521
2024,0.248786,-0.016372,0.028881
2025,0.177237,0.077955,0.026771`;
export const KR_CSV =`year,kospi_ret,bond3y_yield,cpi
1980,,,0.2870
1981,,,0.2135
1982,-0.0176,,0.0719
1983,-0.0603,,0.0342
1984,0.1753,,0.0227
1985,0.1468,,0.0246
1986,0.6687,,0.0275
1987,0.9262,,0.0305
1988,0.7276,,0.0715
1989,0.0028,,0.0570
1990,-0.2348,,0.0857
1991,-0.1224,,0.0933
1992,0.1105,,0.0621
1993,0.2767,,0.0480
1994,0.1861,,0.0627
1995,-0.1406,,0.0448
1996,-0.2624,,0.0492
1997,-0.4221,,0.0444
1998,0.4947,0.06950,0.0751
1999,0.8278,0.09030,0.0081
2000,-0.5092,0.06700,0.0226
2001,0.3747,0.05910,0.0407
2002,-0.0954,0.05110,0.0276
2003,0.2919,0.04820,0.0352
2004,0.1051,0.03280,0.0359
2005,0.5396,0.05080,0.0275
2006,0.0399,0.04920,0.0224
2007,0.3225,0.05740,0.0254
2008,-0.4073,0.03410,0.0467
2009,0.4965,0.04410,0.0276
2010,0.2188,0.03380,0.0294
2011,-0.1098,0.03340,0.0403
2012,0.0938,0.02820,0.0219
2013,0.0072,0.02858,0.0130
2014,-0.0476,0.02098,0.0128
2015,0.0239,0.01662,0.0071
2016,0.0332,0.01638,0.0097
2017,0.2176,0.02135,0.0194
2018,-0.1728,0.01817,0.0148
2019,0.0767,0.01360,0.0038
2020,0.3075,0.00976,0.0054
2021,0.0363,0.01798,0.0250
2022,-0.2489,0.03722,0.0509
2023,0.1873,0.03154,0.0359
2024,-0.0963,0.02596,0.0232
2025,0.7563,0.02953,0.0213`;
/* KOSPI 배당수익률 (ECOS 1.5.1.2, 전기 현금배당 기준, 2001~2025) — TR 근사 토글용 */
export const KR_DIV ={2001:0.0173,2002:0.0177,2003:0.0209,2004:0.0206,2005:0.0174,2006:0.0166,2007:0.0139,2008:0.0258,2009:0.0117,2010:0.0112,2011:0.0154,2012:0.0133,2013:0.0114,2014:0.0113,2015:0.0133,2016:0.0152,2017:0.0136,2018:0.0193,2019:0.0202,2020:0.0148,2021:0.0182,2022:0.0222,2023:0.0183,2024:0.0206,2025:0.0130};
export function parseCSV(csv){
  return csv.trim().split("\n").slice(1).map(l=>l.split(",").map(c=>c===""?null:parseFloat(c)));
}
DATA.us={rows:parseCSV(US_CSV),kind:"S&P500 TR + 10Y 국채 TR",src:"Damodaran/NYU 1928-2025 · FRED 교차검증"};
DATA.kr={rows:parseCSV(KR_CSV),kind:"KOSPI PR(배당미포함) + 국고채3Y YTM(1998-2025)",src:"ECOS · 위키/Yahoo 교차검증"};
export function krRowsWithDiv(){
  if(!$("#b_div") || !$("#b_div").checked) return DATA.kr.rows;
  return DATA.kr.rows.map(r=>{ const d=KR_DIV[r[0]]; return d==null? r : [r[0],(1+r[1])*(1+d)-1,r[2],r[3]]; });
}

export function cycleUsable(rows,i,years,mix){
  for(let t=0;t<years;t++){ const r=rows[i+t]; if(r[1]==null||(mix<1&&r[2]==null)) return false; }
  return true;
}
export function runBacktest(rows, mixPct, years, rate, strat){
  const mix=mixPct/100, n=rows.length-years;
  const cycles=[];
  for(let i=0;i<n;i++){
    if(!cycleUsable(rows,i,years,mix)) continue;
    let port=1, w=rate, inflCum=1, ok=true, bottom=1, bottomYear=rows[i][0];
    for(let t=0;t<years;t++){
      const r=rows[i+t];
      if(strat==="fixed") w=rate*inflCum;
      else if(strat==="pct") w=port*rate;
      if(port-w<0){ ok=false; break; }
      port-=w;
      const rmix=mix*r[1]+(1-mix)*r[2];
      port*=1+rmix;
      inflCum*=1+r[3];
      if(port<bottom){bottom=port;bottomYear=r[0]+1;}
    }
    cycles.push({start:rows[i][0], end:rows[i+years-1][0], ok, terminal:port, bottom, bottomYear});
  }
  return cycles;
}
export function runGuard(rows, mixPct, years, rate){
  const mix=mixPct/100, n=rows.length-years, cycles=[];
  for(let i=0;i<n;i++){
    if(!cycleUsable(rows,i,years,mix)) continue;
    let port=1, w=rate, inflCum=1, ok=true, bottom=1, bottomYear=rows[i][0];
    for(let t=0;t<years;t++){
      const r=rows[i+t];
      const path=inflCum;
      if(port > 1.2*path) w*=1.05; else if(port < 0.8*path) w*=0.95; else w*=(1+r[3]);
      if(port-w<0){ ok=false; break; }
      port-=w;
      port*=1+(mix*r[1]+(1-mix)*r[2]);
      inflCum*=1+r[3];
      if(port<bottom){bottom=port;bottomYear=r[0]+1;}
    }
    cycles.push({start:rows[i][0], end:rows[i+years-1][0], ok, terminal:port, bottom, bottomYear});
  }
  return cycles;
}
