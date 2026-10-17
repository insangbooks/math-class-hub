export type RegisteredApp = { id: string; name: string; description: string; url: string };
export type Settings = { studentCount: number; excludedNumbers: number[]; timerSeconds: number };
export const defaults: Settings = { studentCount: 30, excludedNumbers: [], timerSeconds: 300 };

export function numberValue(raw: string | number, label: string, min: number, max: number, integer = false): number {
  if (typeof raw === 'string' && !raw.trim()) throw new Error(`${label}을(를) 입력해주세요.`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
    throw new Error(`${label}: ${min}~${max} 사이의 ${integer ? '정수' : '숫자'}를 입력해주세요.`);
  return n;
}
export function parseExcluded(raw: string, count: number): number[] {
  if (raw.length > 1000) throw new Error('제외 번호 입력이 너무 깁니다.');
  if (!raw.trim()) return [];
  return [...new Set(raw.trim().split(/[\s,]+/).map(s => numberValue(s, '제외 번호', 1, count, true)))].sort((a,b) => a-b);
}
export function candidates(count: number, excluded: number[]): number[] {
  numberValue(count, '학생 수', 1, 200, true);
  excluded.forEach(n => numberValue(n, '제외 번호', 1, count, true));
  return Array.from({length: count}, (_,i) => i+1).filter(n => !excluded.includes(n));
}
// Rejection sampling avoids modulo bias. No user input or result is logged.
export function randomInt(max: number): number {
  numberValue(max, '난수 범위', 1, 10000, true);
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return buffer[0] % max;
}
export function shuffled<T>(values: T[], pick: (max: number) => number = randomInt): T[] {
  const result = [...values];
  for (let i=result.length-1; i>0; i--) { const j=pick(i+1); [result[i],result[j]]=[result[j],result[i]]; }
  return result;
}
export function makeGroups(values: number[], groupCount: number, pick = randomInt): number[][] {
  numberValue(groupCount, '모둠 수', 1, values.length, true);
  const groups: number[][] = Array.from({length: groupCount}, () => []);
  shuffled(values, pick).forEach((n,i) => groups[i % groupCount].push(n));
  return groups;
}
export function experiment(sides: number, repetitions: number, pick = randomInt): number[] {
  if (sides !== 2 && sides !== 6) throw new Error('동전 또는 6면 주사위를 선택해주세요.');
  numberValue(repetitions, '실험 횟수', 1, 10000, true);
  const counts = Array<number>(sides).fill(0);
  for (let i=0; i<repetitions; i++) counts[pick(sides)]++;
  return counts;
}
export function safeUrl(raw: string): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048) throw new Error('웹주소는 1~2,048자로 입력해주세요.');
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error('https://로 시작하는 올바른 웹주소를 입력해주세요.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
    throw new Error('인증정보가 없는 HTTPS 웹주소만 등록할 수 있습니다.');
  if (url.search || url.hash) throw new Error('개인정보·토큰 노출을 막기 위해 검색 매개변수(?)와 해시(#)가 없는 기본 주소를 사용해주세요.');
  return url.href;
}
export function validateApp(app: RegisteredApp): RegisteredApp {
  if (typeof app.id !== 'string' || !app.id || app.id.length>100) throw new Error('프로그램 ID가 올바르지 않습니다.');
  if (typeof app.name !== 'string' || !app.name.trim() || app.name.trim().length>60) throw new Error('프로그램 이름은 1~60자로 입력해주세요.');
  if (typeof app.description !== 'string' || app.description.length>200) throw new Error('설명은 200자 이내로 입력해주세요.');
  return {id: app.id, name: app.name.trim(), description: app.description.trim(), url: safeUrl(app.url)};
}
export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('설정 형식 오류');
  const s = value as Settings;
  if (typeof s.studentCount !== 'number' || typeof s.timerSeconds !== 'number' || !Array.isArray(s.excludedNumbers) || s.excludedNumbers.some(n=>typeof n !== 'number')) throw new Error('설정 자료형 오류');
  numberValue(s.studentCount, '학생 수', 1, 200, true);
  numberValue(s.timerSeconds, '타이머', 1, 10800, true);
  candidates(s.studentCount, s.excludedNumbers);
  if (new Set(s.excludedNumbers).size !== s.excludedNumbers.length || s.excludedNumbers.length>200) throw new Error('제외 번호 형식 오류');
  return {studentCount:s.studentCount, excludedNumbers:[...s.excludedNumbers], timerSeconds:s.timerSeconds};
}
export function validateApps(value: unknown): RegisteredApp[] {
  if (!Array.isArray(value) || value.length>100) throw new Error('등록 목록 형식 오류');
  const apps = value.map(v => { if (!v || typeof v!=='object') throw new Error('프로그램 형식 오류'); return validateApp(v); });
  if (new Set(apps.map(a=>a.id)).size!==apps.length) throw new Error('중복된 프로그램 ID');
  return apps;
}
export function remainingSeconds(deadline: number, now: number): number { return Math.max(0, Math.ceil((deadline-now)/1000)); }
export function functionValue(kind: 'linear'|'quadratic', a: number, b: number, c: number, x: number): number {
  return kind==='linear' ? a*x+b : a*x*x+b*x+c;
}
export function graphCoordinate(value: number, range: number, invert = false): number {
  return 300 + (invert ? -1 : 1) * value/range*260;
}
export function curvePath(kind:'linear'|'quadratic',a:number,b:number,c:number,range:number):string {
  let lo=-range, hi=range;
  if(kind==='linear'){
    const crossings=[(-range*1.1-b)/a,(range*1.1-b)/a].sort((x,y)=>x-y);
    lo=Math.max(lo,crossings[0]);hi=Math.min(hi,crossings[1]);
  }else{
    // Restrict sampling to the visible parabola so steep/narrow curves are not missed.
    const vertex=-b/(2*a);const vertexY=functionValue(kind,a,b,c,vertex);
    const reach=(Math.sign(a)*range*1.1-vertexY)/a;
    if(reach<0)return '';
    const radius=Math.sqrt(reach);lo=Math.max(lo,vertex-radius);hi=Math.min(hi,vertex+radius);
  }
  if(lo>hi)return '';
  let path='';let open=false;
  for(let i=0;i<=600;i++){
    const x=lo+(hi-lo)*i/600;const y=functionValue(kind,a,b,c,x);
    if(!Number.isFinite(y)||Math.abs(y)>range*1.2){open=false;continue;}
    path+=`${open?'L':'M'}${graphCoordinate(x,range).toFixed(2)},${graphCoordinate(y,range,true).toFixed(2)} `;open=true;
  }
  return path;
}
