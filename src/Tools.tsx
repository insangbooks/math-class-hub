import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { candidates, curvePath, experiment, functionValue, graphCoordinate as coord, makeGroups, numberValue, parseExcluded, randomInt, remainingSeconds } from './core.ts';
import type { Settings } from './core.ts';

export type ToolId='timer'|'draw'|'groups'|'probability'|'graph';
export const tools:{id:ToolId;symbol:string;name:string;description:string;category:string}[]=[
  {id:'timer',symbol:'◷',name:'수업 타이머',description:'몰입하는 시간, 함께 보는 카운트다운.',category:'CLASSROOM'},
  {id:'draw',symbol:'№',name:'무작위 번호 뽑기',description:'공정한 기회. 다음 발표자를 골라보세요.',category:'CLASSROOM'},
  {id:'groups',symbol:'⋮⋮',name:'모둠 편성',description:'복잡한 고민 없이, 골고루 나누는 모둠.',category:'CLASSROOM'},
  {id:'probability',symbol:'⚄',name:'확률 실험실',description:'동전과 주사위로 발견하는 큰 수의 법칙.',category:'MATHEMATICS'},
  {id:'graph',symbol:'ƒ',name:'좌표와 함수',description:'점 하나에서 시작하는 함수의 이야기.',category:'MATHEMATICS'}
];
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) {
  return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;
}
function Failure({message}:{message:string}) { return message?<p role="alert" className="error">{message}</p>:null; }
function messageOf(e:unknown):string {return e instanceof Error?e.message:'처리하지 못했습니다. 입력을 확인해주세요.';}

function Audience({settings,onApply}:{settings:Settings;onApply:(s:Settings)=>boolean}) {
  const [count,setCount]=useState(String(settings.studentCount));
  const [excluded,setExcluded]=useState(settings.excludedNumbers.join(', '));
  const [error,setError]=useState('');
  useEffect(()=>{setCount(String(settings.studentCount));setExcluded(settings.excludedNumbers.join(', '));},[settings.studentCount,settings.excludedNumbers]);
  function apply(e:FormEvent) {
    e.preventDefault();try {
      const n=numberValue(count,'학생 수',1,200,true);
      const ex=parseExcluded(excluded,n);
      if(!candidates(n,ex).length) throw new Error('모든 번호를 제외할 수 없습니다. 최소 한 명을 포함해주세요.');
      if(onApply({...settings,studentCount:n,excludedNumbers:ex})) setError('');
    }catch(e){setError(messageOf(e));}
  }
  return <section className="audience"><form onSubmit={apply} className="inline-form">
    <Field label="학생 수"><input aria-label="학생 수" type="number" min="1" max="200" value={count} onChange={e=>setCount(e.target.value)}/></Field>
    <Field label="제외 번호" hint="쉼표 또는 공백으로 구분"><input aria-label="제외 번호" value={excluded} maxLength={1000} placeholder="예: 3, 12" onChange={e=>setExcluded(e.target.value)}/></Field>
    <button type="submit">대상 적용·저장</button>
  </form><Failure message={error}/><p className="muted">현재 대상 <b>{settings.studentCount-settings.excludedNumbers.length}명</b> · 제외 {settings.excludedNumbers.length?settings.excludedNumbers.join(', ')+'번':'없음'} · 다음 수업 전에 확인해주세요.</p></section>;
}

export function Timer({settings,onSettings,onActive}:{settings:Settings;onSettings:(s:Settings)=>boolean;onActive:(v:boolean)=>void}) {
  const [input,setInput]=useState(String(settings.timerSeconds));
  const [left,setLeft]=useState(settings.timerSeconds);
  const [status,setStatus]=useState<'ready'|'running'|'paused'|'done'>('ready');
  const deadline=useRef(0);
  const [error,setError]=useState('');
  useEffect(()=>{onActive(status==='running'||status==='paused');return ()=>onActive(false);},[status,onActive]);
  useEffect(()=>{
    if(status!=='running')return;
    function tick(){const r=remainingSeconds(deadline.current,Date.now());setLeft(r);if(r===0)setStatus('done');}
    const interval=setInterval(tick,100);document.addEventListener('visibilitychange',tick);
    tick();return ()=>{clearInterval(interval);document.removeEventListener('visibilitychange',tick);};
  },[status]);
  function start(){try{const sec=numberValue(input,'타이머(초)',1,10800,true);if(!onSettings({...settings,timerSeconds:sec}))return;deadline.current=Date.now()+sec*1000;setLeft(sec);setStatus('running');setError('');}catch(e){setError(messageOf(e));}}
  function pause(){const r=remainingSeconds(deadline.current,Date.now());setLeft(r);setStatus(r?'paused':'done');}
  return <div className="tool-layout"><section className="control-panel">
    <span className="eyebrow">TIME TO FOCUS</span><h2>수업의 흐름을<br/>만드는 시간.</h2>
    <Field label="활동 시간 (초)" hint="1초~10,800초 · 180분"><input type="number" min="1" max="10800" value={input} disabled={status==='running'||status==='paused'} onChange={e=>setInput(e.target.value)}/></Field>
    <div className="preset-row">{[60,180,300,600].map(sec=><button key={sec} disabled={status==='running'||status==='paused'} onClick={()=>setInput(String(sec))}>{sec/60}분</button>)}</div>
    <div className="actions">{status==='running'?<button className="primary" onClick={pause}>일시정지</button>:status==='paused'?<button className="primary" onClick={()=>{deadline.current=Date.now()+left*1000;setStatus('running');}}>이어서 시작</button>:<button className="primary" onClick={start}>타이머 시작 ↗</button>}
    <button onClick={()=>{setStatus('ready');setLeft(settings.timerSeconds);setInput(String(settings.timerSeconds));setError('');}}>초기화</button></div><Failure message={error}/>
  </section><section className={'result-panel timer-panel '+(status==='done'?'completed':'')} aria-label="타이머 결과">
    <span className="eyebrow">{status==='running'?'FOCUS SESSION':'CLASSROOM TIMER'}</span><div className="timer-number" aria-label={`남은 시간 ${Math.floor(left/60)}분 ${left%60}초`}>{String(Math.floor(left/60)).padStart(2,'0')}<span>:</span>{String(left%60).padStart(2,'0')}</div>
    <p role="status">{status==='done'?'활동 시간이 끝났습니다.':status==='paused'?'잠시 멈췄습니다.':status==='running'?'지금은 생각이 자라는 시간':'준비가 되면 시작해주세요.'}</p>
    <div className="timer-track"><progress max={settings.timerSeconds} value={left} aria-label="남은 시간 비율"/></div>
  </section></div>;
}

export function Draw({settings,onSettings}:{settings:Settings;onSettings:(s:Settings)=>boolean}) {
  const [drawn,setDrawn]=useState<number[]>([]);const [result,setResult]=useState<number|null>(null);const [unique,setUnique]=useState(true);const [error,setError]=useState('');
  const fingerprint=JSON.stringify([settings.studentCount,settings.excludedNumbers]);
  useEffect(()=>{setDrawn([]);setResult(null);setError('');},[fingerprint]);
  function draw(){try{const pool=candidates(settings.studentCount,settings.excludedNumbers).filter(n=>!unique||!drawn.includes(n));if(!pool.length)throw new Error('이번 회차의 후보를 모두 뽑았습니다. 회차를 초기화해주세요.');const next=pool[randomInt(pool.length)];setResult(next);setDrawn(v=>[...v,next]);setError('');}catch(e){setError(messageOf(e));}}
  return <><Audience settings={settings} onApply={onSettings}/><div className="tool-layout"><section className="control-panel"><span className="eyebrow">EVERYONE HAS A CHANCE</span><h2>다음 이야기의<br/>주인공은?</h2><label className="check"><input type="checkbox" checked={unique} onChange={e=>{setUnique(e.target.checked);setDrawn([]);setResult(null);setError('');}}/> 중복 없이 뽑기</label><div className="actions"><button className="primary" onClick={draw}>번호 뽑기 ↗</button><button onClick={()=>{setDrawn([]);setResult(null);setError('');}}>회차 초기화</button></div><Failure message={error}/><p className="muted">{unique?`남은 후보 ${candidates(settings.studentCount,settings.excludedNumbers).length-drawn.length}명`:`이번 회차 ${drawn.length}번 추첨`}</p><div className="number-chips" aria-label="이번 회차 추첨 번호">{drawn.map((n,i)=><span key={i}>{n}</span>)}</div></section><section className="result-panel draw-panel" aria-live="polite"><span className="eyebrow">YOUR TURN</span><div className="draw-number">{result??'?'}</div><p>{result?`${result}번, 생각을 들려주세요.`:'모든 번호에 똑같은 기회.'}</p></section></div></>;
}

export function Groups({settings,onSettings}:{settings:Settings;onSettings:(s:Settings)=>boolean}) {
  const [count,setCount]=useState('6');const [groups,setGroups]=useState<number[][]>([]);const [error,setError]=useState('');
  const fingerprint=JSON.stringify([settings.studentCount,settings.excludedNumbers]);useEffect(()=>{setGroups([]);setError('');},[fingerprint]);
  function generate(e:FormEvent){e.preventDefault();try{const pool=candidates(settings.studentCount,settings.excludedNumbers);const n=numberValue(count,'모둠 수',1,pool.length,true);setGroups(makeGroups(pool,n));setError('');}catch(e){setError(messageOf(e));}}
  return <><Audience settings={settings} onApply={onSettings}/><form className="inline-form group-form" onSubmit={generate}><Field label="만들 모둠 수"><input type="number" min="1" max={settings.studentCount-settings.excludedNumbers.length} value={count} onChange={e=>setCount(e.target.value)}/></Field><button className="primary">모둠 편성 ↗</button><button type="button" onClick={()=>{setGroups([]);setError('');}}>결과 지우기</button></form><Failure message={error}/>{groups.length?<div className="group-grid" aria-live="polite">{groups.map((group,i)=><section className="group-card" key={i}><span className="eyebrow">GROUP {String(i+1).padStart(2,'0')}</span><h2>{i+1}모둠 <small>{group.length}명</small></h2><div className="number-chips">{group.map(n=><span key={n}>{n}번</span>)}</div></section>)}</div>:<div className="empty-state"><span>⋮⋮</span><h2>함께 생각하면, 더 넓어집니다.</h2><p>모둠 수를 정하고 편성해주세요. 인원 차이는 최대 1명입니다.</p></div>}</>;
}

export function Probability({onActive}:{onActive:(v:boolean)=>void}) {
  const [sides,setSides]=useState(2);const [input,setInput]=useState('100');const [counts,setCounts]=useState<number[]>([]);const [usedSides,setUsedSides]=useState(2);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const timeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>{clearTimeout(timeout.current);onActive(false);},[onActive]);
  function run(e:FormEvent){e.preventDefault();if(busy)return;try{const n=numberValue(input,'실험 횟수',1,10000,true);setError('');setBusy(true);onActive(true);timeout.current=setTimeout(()=>{try{setCounts(experiment(sides,n));setUsedSides(sides);}catch(e){setError(messageOf(e));}finally{setBusy(false);onActive(false);}},30);}catch(e){setError(messageOf(e));}}
  const total=counts.reduce((a,b)=>a+b,0);const labels=usedSides===2?['앞면','뒷면']:['1','2','3','4','5','6'];
  return <div className="tool-layout"><section className="control-panel"><span className="eyebrow">FROM CHANCE TO PATTERN</span><h2>우연을 모으면,<br/>규칙이 보입니다.</h2><form onSubmit={run}><Field label="실험 종류"><select value={sides} disabled={busy} onChange={e=>setSides(Number(e.target.value))}><option value={2}>동전 · 앞면과 뒷면</option><option value={6}>주사위 · 1부터 6까지</option></select></Field><Field label="반복 횟수" hint="1~10,000회 · 실행마다 새 실험"><input type="number" min="1" max="10000" value={input} disabled={busy} onChange={e=>setInput(e.target.value)}/></Field><div className="actions"><button className="primary" disabled={busy}>{busy?'실험 중…':'실험 시작 ↗'}</button><button type="button" disabled={busy} onClick={()=>{setCounts([]);setError('');}}>결과 지우기</button></div></form><Failure message={error}/><p className="muted">이론적 확률은 {sides===2?'1/2':'1/6'}입니다. 적은 횟수에서는 결과가 크게 다를 수 있어요.</p></section><section className="result-panel probability-result"><div className="panel-heading"><span className="eyebrow">RELATIVE FREQUENCY</span><span role="status">{busy?'실험 중':total?`${total.toLocaleString()}회 완료`:'실험 대기'}</span></div>{counts.length?<><svg className="bar-chart" viewBox="0 0 600 300" role="img" aria-label={`${usedSides===2?'동전':'주사위'} 결과 상대도수 그래프. 아래 표에서 수치를 확인할 수 있습니다.`}><line x1="25" y1="250" x2="575" y2="250" className="axis"/>{counts.map((v,i)=>{const w=500/counts.length;const h=v/total*200;return <g key={i}><rect x={50+i*w+15} y={250-h} width={w-30} height={h} rx="5" className="bar"/><text x={50+i*w+w/2} y={238-h} textAnchor="middle">{(v/total*100).toFixed(1)}%</text><text x={50+i*w+w/2} y="280" textAnchor="middle">{labels[i]}</text></g>;})}</svg><table><caption className="sr-only">확률 실험 결과</caption><thead><tr><th>결과</th><th>횟수</th><th>상대도수</th></tr></thead><tbody>{counts.map((n,i)=><tr key={i}><th>{labels[i]}</th><td>{n.toLocaleString()}</td><td>{(n/total).toFixed(4)}</td></tr>)}</tbody></table></>:<div className="empty-state"><span>½</span><p>실험을 시작하면 결과가 여기에 나타납니다.</p></div>}</section></div>;
}

type Point={id:number;x:number;y:number};type Curve={kind:'linear'|'quadratic';a:number;b:number;c:number};
export function Graph() {
  const [points,setPoints]=useState<Point[]>([]);const nextId=useRef(1);const [x,setX]=useState('2');const [y,setY]=useState('3');
  const [kind,setKind]=useState<'linear'|'quadratic'>('linear');const [a,setA]=useState('1');const [b,setB]=useState('0');const [c,setC]=useState('0');const [curve,setCurve]=useState<Curve|null>(null);
  const [range,setRange]=useState(10);const [rangeInput,setRangeInput]=useState('10');const [error,setError]=useState('');
  function addPoint(e:FormEvent){e.preventDefault();try{const px=numberValue(x,'x 좌표',-1000,1000);const py=numberValue(y,'y 좌표',-1000,1000);if(Math.abs(px)>range||Math.abs(py)>range)throw new Error('점이 표시 범위를 벗어납니다. 표시 범위를 먼저 늘려주세요.');if(points.length>=100)throw new Error('점은 최대 100개입니다. 기존 점을 지워주세요.');setPoints(v=>[...v,{id:nextId.current++,x:px,y:py}]);setError('');}catch(e){setError(messageOf(e));}}
  function plot(e:FormEvent){e.preventDefault();try{const av=numberValue(a,'a',-1000,1000);if(av===0)throw new Error(`${kind==='linear'?'일차':'이차'}함수의 a는 0이 될 수 없습니다.`);setCurve({kind,a:av,b:numberValue(b,'b',-1000,1000),c:kind==='quadratic'?numberValue(c,'c',-1000,1000):0});setError('');}catch(e){setError(messageOf(e));}}
  function changeRange(e:FormEvent){e.preventDefault();try{setRange(numberValue(rangeInput,'표시 범위',1,1000));setError('');}catch(e){setError(messageOf(e));}}
  const ticks=Array.from({length:11},(_,i)=>(i-5)*range/5);
  const path=curve?curvePath(curve.kind,curve.a,curve.b,curve.c,range):'';
  const equation=curve?`y = ${curve.a}x${curve.kind==='quadratic'?'²':''} ${curve.kind==='quadratic'?`${curve.b<0?'−':'+'} ${Math.abs(curve.b)}x `:''}${(curve.kind==='linear'?curve.b:curve.c)<0?'−':'+'} ${Math.abs(curve.kind==='linear'?curve.b:curve.c)}`:'';
  const fmt=(n:number)=>Number(n.toFixed(3)).toString();
  return <div className="tool-layout graph-layout"><section className="control-panel"><span className="eyebrow">CONNECT THE DOTS</span><h2>생각을 좌표 위에.</h2>
    <form onSubmit={addPoint}><h3>점 찍기</h3><div className="coefficient-row"><Field label="x 좌표"><input type="number" step="any" min="-1000" max="1000" value={x} onChange={e=>setX(e.target.value)}/></Field><Field label="y 좌표"><input type="number" step="any" min="-1000" max="1000" value={y} onChange={e=>setY(e.target.value)}/></Field></div><button>점 추가</button></form>
    <form onSubmit={plot}><h3>함수 그리기</h3><Field label="함수 종류"><select value={kind} onChange={e=>setKind(e.target.value as Curve['kind'])}><option value="linear">일차함수 y = ax + b</option><option value="quadratic">이차함수 y = ax² + bx + c</option></select></Field><div className="coefficient-row">{([{label:'a',v:a,set:setA},{label:'b',v:b,set:setB},...(kind==='quadratic'?[{label:'c',v:c,set:setC}]:[])]).map(item=><Field label={item.label} key={item.label}><input type="number" step="any" min="-1000" max="1000" value={item.v} onChange={e=>item.set(e.target.value)}/></Field>)}</div><div className="actions"><button className="primary">그래프 그리기 ↗</button><button type="button" onClick={()=>setCurve(null)}>함수 지우기</button></div></form>
    <form className="inline-form" onSubmit={changeRange}><Field label="표시 범위 ±" hint="1~1,000"><input type="number" step="any" min="1" max="1000" value={rangeInput} onChange={e=>setRangeInput(e.target.value)}/></Field><button>범위 적용</button></form><Failure message={error}/>
  </section><section className="result-panel graph-result"><div className="panel-heading"><span className="eyebrow">COORDINATE PLANE</span><span>{equation||'좌표평면'}</span></div><svg viewBox="0 0 600 600" className="coordinate-chart" role="img" aria-label={`좌표평면: x와 y 범위 ${-range}부터 ${range}. ${equation||'함수 없음'}. 점과 함수값은 아래 표에서 확인할 수 있습니다.`}><defs><clipPath id="plot-area"><rect x="40" y="40" width="520" height="520"/></clipPath></defs>{ticks.map((t,i)=><g key={i}><line className={i===5?'axis':'grid-line'} x1={coord(t,range)} x2={coord(t,range)} y1="40" y2="560"/><line className={i===5?'axis':'grid-line'} x1="40" x2="560" y1={coord(t,range,true)} y2={coord(t,range,true)}/>{i!==5&&<><text x={coord(t,range)} y="320" textAnchor="middle">{fmt(t)}</text><text x="288" y={coord(t,range,true)+5} textAnchor="end">{fmt(t)}</text></>}</g>)}<text x="570" y="290">x</text><text x="310" y="30">y</text><text x="288" y="320">0</text><g clipPath="url(#plot-area)">{curve&&<path d={path} className="function-path"/>}{points.map(p=><g key={p.id}><circle cx={coord(p.x,range)} cy={coord(p.y,range,true)} r="5" className="plot-point"/><text x={coord(p.x,range)+9} y={coord(p.y,range,true)-10}>({fmt(p.x)}, {fmt(p.y)})</text></g>)}</g></svg>
  <details><summary>점 목록·함수값 표 {points.length?`(${points.length}개 점)`:''}</summary>{points.length?<><table><caption className="sr-only">입력한 점 목록</caption><thead><tr><th>x</th><th>y</th><th>관리</th></tr></thead><tbody>{points.map(p=><tr key={p.id}><td>{p.x}</td><td>{p.y}</td><td><button className="small-button" aria-label={`점 (${p.x}, ${p.y}) 삭제`} onClick={()=>setPoints(v=>v.filter(q=>q.id!==p.id))}>삭제</button></td></tr>)}</tbody></table><button onClick={()=>setPoints([])}>모든 점 지우기</button></>:<p className="muted">입력한 점이 없습니다.</p>}{curve&&<table><caption>{equation}의 주요 값</caption><thead><tr><th>x</th><th>y</th></tr></thead><tbody>{[-2,-1,0,1,2].map(v=><tr key={v}><td>{v}</td><td>{functionValue(curve.kind,curve.a,curve.b,curve.c,v)}</td></tr>)}</tbody></table>}</details></section></div>;
}
