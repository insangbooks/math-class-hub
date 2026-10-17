import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { defaults, safeUrl, validateApp, validateApps, validateSettings } from './core.ts';
import type { RegisteredApp, Settings } from './core.ts';
import { APPS_KEY, SETTINGS_KEY, browserStorage, loadApps, loadSettings, writeSlot } from './storage.ts';
import { Draw, Field, Graph, Groups, Probability, Timer, tools } from './Tools.tsx';
import type { ToolId } from './Tools.tsx';
import { setupOffline } from './offline.ts';
import type { OfflineState } from './offline.ts';

type Page='hub'|'tools'|'manage'|'settings'|ToolId;
const errorText=(e:unknown)=>e instanceof Error?e.message:'요청을 처리하지 못했습니다.';
function Confirmation({message,onFinish}:{message:string;onFinish:(yes:boolean)=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ref.current?.showModal();return ()=>ref.current?.close();},[]);
  return <dialog className="confirm-dialog" ref={ref} aria-labelledby="confirm-title" aria-describedby="confirm-message" onCancel={e=>{e.preventDefault();onFinish(false);}}><span className="eyebrow">PLEASE CONFIRM</span><h2 id="confirm-title">계속할까요?</h2><p id="confirm-message">{message}</p><div className="actions"><button autoFocus onClick={()=>onFinish(false)}>취소</button><button className="primary" onClick={()=>onFinish(true)}>확인</button></div></dialog>;
}
export function App(){
  const [storage]=useState(browserStorage);const [settingsSlot]=useState(()=>loadSettings(storage));const [appsSlot]=useState(()=>loadApps(storage));
  const [settings,setSettings]=useState<Settings>(settingsSlot.value);const [apps,setApps]=useState<RegisteredApp[]>(appsSlot.value);
  const [settingsBlocked,setSettingsBlocked]=useState(settingsSlot.blocked);const [appsBlocked,setAppsBlocked]=useState(appsSlot.blocked);
  const [page,setPage]=useState<Page>('hub');const [notice,setNotice]=useState('');const [noticeError,setNoticeError]=useState(false);
  const [editing,setEditing]=useState<RegisteredApp|null>(null);const [name,setName]=useState('');const [description,setDescription]=useState('');const [url,setUrl]=useState('');
  const [offline,setOffline]=useState<OfflineState>({status:'오프라인 준비 확인 중…',ready:false,waiting:null});const [online,setOnline]=useState(navigator.onLine);
  const [presenting,setPresenting]=useState(false);const active=useRef(false);const heading=useRef<HTMLHeadingElement>(null);const initialFocus=useRef(true);
  const onActive=useCallback((v:boolean)=>{active.current=v;},[]);
  const [confirmation,setConfirmation]=useState<{message:string;resolve:(yes:boolean)=>void}|null>(null);
  function ask(message:string):Promise<boolean>{return new Promise(resolve=>setConfirmation({message,resolve}));}
  function announce(text:string,error=false){setNotice(text);setNoticeError(error);}
  useEffect(()=>setupOffline(setOffline),[]);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{if(initialFocus.current){initialFocus.current=false;return;}heading.current?.focus();},[page]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setPresenting(false);if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{});}};
    const full=()=>{if(!document.fullscreenElement)setPresenting(false);};
    window.addEventListener('keydown',key);document.addEventListener('fullscreenchange',full);return ()=>{window.removeEventListener('keydown',key);document.removeEventListener('fullscreenchange',full);};
  },[]);
  const persistSettings=(next:Settings):boolean=>{
    try{const checked=validateSettings(next);if(!settingsBlocked)writeSlot(storage,SETTINGS_KEY,checked,false,validateSettings);else {setSettings(checked);announce('임시로 적용했습니다. 원본 보호 잠금으로 저장되지 않습니다.',true);return true;}setSettings(checked);announce('설정을 이 브라우저에 저장했습니다.');return true;}
    catch(e){try{setSettings(validateSettings(next));announce(errorText(e)+' 이번 수업에는 임시로 적용합니다.',true);return true;}catch{announce(errorText(e),true);return false;}}
  };
  async function navigate(next:Page){if(active.current&&!await ask('진행 중인 활동을 종료하고 이동할까요? 실행 결과는 저장되지 않습니다.'))return;active.current=false;setPage(next);setPresenting(false);setNotice('');}
  function manage(app:RegisteredApp|null){setEditing(app);setName(app?.name||'');setDescription(app?.description||'');setUrl(app?.url||'');navigate('manage');}
  function saveApp(e:FormEvent){e.preventDefault();try{
    if(!editing&&apps.length>=100)throw new Error('프로그램은 최대 100개까지 등록할 수 있습니다.');
    const app=validateApp({id:editing?.id||crypto.randomUUID(),name,description,url});
    const next=editing?apps.map(v=>v.id===app.id?app:v):[...apps,app];writeSlot(storage,APPS_KEY,next,appsBlocked,validateApps);setApps(next);setPage('hub');announce(editing?'프로그램을 수정했습니다.':'새 프로그램을 등록했습니다.');
  }catch(e){announce(errorText(e),true);}}
  async function removeApp(app:RegisteredApp){if(!await ask(`‘${app.name}’ 카드를 삭제할까요? 연결된 웹앱은 삭제되지 않습니다.`))return;try{const next=apps.filter(v=>v.id!==app.id);writeSlot(storage,APPS_KEY,next,appsBlocked,validateApps);setApps(next);announce('프로그램 카드를 삭제했습니다.');}catch(e){announce(errorText(e),true);}}
  async function reset(which:'settings'|'apps'|'all'){
    if(!await ask(`${which==='all'?'전체 설정과 등록 목록':which==='settings'?'수업 도구 설정':'프로그램 등록 목록'}을 초기화할까요? 취소하면 그대로 유지됩니다.`))return;
    // Each key is removed independently. Successful removal is reflected immediately;
    // failure never clears the corresponding in-memory state or unrelated cache.
    let failed=false;
    if(which!=='apps'){try{storage.removeItem(SETTINGS_KEY);setSettings({...defaults,excludedNumbers:[]});setSettingsBlocked(false);}catch{failed=true;}}
    if(which!=='settings'){try{storage.removeItem(APPS_KEY);setApps([]);setAppsBlocked(false);}catch{failed=true;}}
    announce(failed?'일부 자료를 초기화하지 못했습니다. 삭제하지 못한 자료는 유지됩니다.':'초기화했습니다. 오프라인 파일은 유지됩니다.',failed);
  }
  async function presentation(){if(presenting){setPresenting(false);if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});return;}setPresenting(true);try{await document.documentElement.requestFullscreen();}catch{announce('전체화면을 허용하지 않아 창 안에서 확대했습니다. Esc로 돌아갈 수 있습니다.');}}
  async function update(){if(active.current){announce('진행 중인 활동을 종료한 뒤 업데이트해주세요.',true);return;}if(!offline.waiting)return;if(!await ask('준비된 새 버전을 적용하고 화면을 새로 열까요? 현재 실행 결과는 사라집니다.'))return;
    let finished=false;const changed=()=>{if(finished)return;finished=true;navigator.serviceWorker.removeEventListener('controllerchange',changed);location.reload();};navigator.serviceWorker.addEventListener('controllerchange',changed);offline.waiting.postMessage({type:'APPLY_UPDATE'});
    setTimeout(()=>{if(!finished){navigator.serviceWorker.removeEventListener('controllerchange',changed);announce('업데이트를 적용하지 못했습니다. 기존 화면을 유지합니다. 다시 시도해주세요.',true);}},10000);
  }
  const currentTool=tools.find(t=>t.id===page);const isTool=!!currentTool;
  return <div className={presenting?'app presenting':'app'}>{confirmation&&<Confirmation message={confirmation.message} onFinish={yes=>{confirmation.resolve(yes);setConfirmation(null);}}/>}<a className="skip-link" href="#main">본문으로 건너뛰기</a>
    <header className="site-header"><button className="brand" onClick={()=>navigate('hub')} aria-label="수학 수업 허브 홈"><span className="brand-mark">∑</span><span>Math Atelier<small>수학 수업 허브</small></span></button><nav aria-label="주 메뉴"><button className={page==='hub'?'nav-active':''} onClick={()=>navigate('hub')}>내 프로그램</button><button className={page==='tools'||isTool?'nav-active':''} onClick={()=>navigate('tools')}>수업 도구</button><button className={page==='settings'?'nav-active':''} onClick={()=>navigate('settings')}>설정</button></nav><span className="connection"><i className={offline.ready?'ready-dot':''}/>{online?(offline.ready?'오프라인 준비 완료':'로컬 수업 공간'):'오프라인'}</span></header>
    <main id="main" tabIndex={-1}>
      {(settingsBlocked||appsBlocked)&&<div className="storage-warning" role="alert">저장 자료 보호 중 · 일부 자료를 읽지 못해 저장을 잠갔습니다. 임시로 도구를 사용할 수 있습니다. <button onClick={()=>navigate('settings')}>설정에서 확인</button></div>}
      {notice&&<div className={noticeError?'notice error':'notice'} role={noticeError?'alert':'status'}>{notice}<button aria-label="안내 닫기" onClick={()=>setNotice('')}>×</button></div>}
      {page==='hub'&&<><section className="hero"><div><span className="eyebrow">YOUR CLASSROOM, CONNECTED</span><h1 ref={heading} tabIndex={-1}>좋은 수업을 위한<br/><em>작은 도구들.</em></h1><p>수업에 필요한 순간, 필요한 도구를.<br/>직접 만든 프로그램과 수학 도구를 한곳에 모으세요.</p><button className="primary hero-button" onClick={()=>navigate('tools')}>수업 도구 열기 <span>↗</span></button></div><div className="hero-art" aria-hidden="true"><div className="art-grid"/><svg viewBox="0 0 500 330"><path d="M30 260 C130 260 160 80 250 80 S350 260 470 100"/><line x1="250" y1="25" x2="250" y2="305"/><line x1="25" y1="190" x2="475" y2="190"/><circle cx="250" cy="80" r="6"/><text x="266" y="65">f(x)</text><text x="450" y="215">x</text><text x="265" y="40">y</text></svg><div className="formula-note">Ideas take shape.</div><span className="art-caption">수학의 가능성, 수업의 일상으로.</span></div></section>
      <section className="program-section"><div className="section-heading"><div><span className="eyebrow">MY WORKSPACE</span><h2>내 프로그램 <span className="count">{apps.length+3}</span></h2></div><button onClick={()=>manage(null)}>＋ 프로그램 등록</button></div><div className="program-grid"><article className="program-card builtin"><div className="card-top"><span className="tool-symbol">∑</span><span className="pill">기본 도구 · 오프라인</span></div><h3>수업에 필요한 도구</h3><p>타이머부터 함수 그래프까지.<br/>오늘의 수업을 함께 만드는 다섯 가지 도구.</p><div className="card-bottom"><span>5 TOOLS</span><button aria-label="기본 수업 도구 열기" onClick={()=>navigate('tools')}>열기 ↗</button></div></article>
      <article className="program-card builtin"><div className="card-top"><span className="tool-symbol">Aa</span><span className="pill">기기 내 처리</span></div><h3>PDF 글자 수</h3><p>컴퓨터의 PDF를 선택하고 공백 포함·제외 글자 수를 확인하세요. 파일과 결과는 업로드되지 않습니다.</p><div className="card-bottom"><span>LOCAL PDF</span><a className="button-link" href="./pdf-counter/" target="_blank" rel="noopener noreferrer">열기 ↗</a></div></article>
      <article className="program-card builtin"><div className="card-top"><span className="tool-symbol">✎</span><span className="pill">로컬 암호화 저장</span></div><h3>하루의 기록 · 일기장</h3><p>날짜별로 생각을 기록하고 검색하세요. 비밀번호로 잠금을 해제하고 이 PC에 암호화하여 저장합니다.</p><div className="card-bottom"><span>PRIVATE JOURNAL</span><a className="button-link" href="./diary/" target="_blank" rel="noopener noreferrer">열기 ↗</a></div></article>
      {apps.map(app=><article className="program-card" key={app.id}><div className="card-top"><span className="tool-symbol external-symbol">↗</span><span className="pill">외부 웹앱</span></div><h3>{app.name}</h3><p>{app.description||'내가 만든 프로그램을 수업에서 만나보세요.'}</p><div className="card-domain">{new URL(app.url).hostname}</div><div className="card-bottom"><div className="card-admin"><button onClick={()=>manage(app)} aria-label={`${app.name} 수정`}>수정</button><button onClick={()=>removeApp(app)} aria-label={`${app.name} 삭제`}>삭제</button></div><a className="button-link" href={safeUrl(app.url)} target="_blank" rel="noopener noreferrer" onClick={e=>{try{safeUrl(app.url);}catch(err){e.preventDefault();announce(errorText(err),true);}}}>열기 ↗</a></div></article>)}
      <button className="add-card" onClick={()=>manage(null)}><span>＋</span><strong>다음 아이디어를 위한 자리</strong><small>프로그램 이름과 웹주소를 등록하세요.</small></button></div>{!apps.length&&<p className="section-note">처음 만든 프로그램이 있나요? 웹주소를 등록하면 나만의 실행 카드가 생깁니다.</p>}</section>
      <section className="workspace-note"><span>01 / SIMPLE BY DESIGN</span><p>설정은 이 브라우저에.<br/><b>수업의 집중은 교실에.</b></p><div>계정 없이, 설치 부담 없이.<br/>기본 도구는 준비 후 오프라인에서도 사용할 수 있습니다.</div></section></>}
      {page==='tools'&&<><div className="page-heading"><span className="eyebrow">THE CLASSROOM COLLECTION</span><h1 ref={heading} tabIndex={-1}>수업에 필요한 도구</h1><p>작은 준비가 만드는, 더 풍성한 수학 시간.</p></div><div className="tools-grid">{tools.map((t,i)=><button className="tool-card" key={t.id} onClick={()=>navigate(t.id)}><div className="card-top"><span className="tool-symbol">{t.symbol}</span><span className="tool-index">0{i+1}</span></div><span className="eyebrow">{t.category}</span><h2>{t.name}</h2><p>{t.description}</p><span className="tool-open">도구 열기 ↗</span></button>)}</div><p className="section-note">학생 이름 없이 번호만 사용합니다. 제외 번호는 수업 전에 확인해주세요.</p></>}
      {isTool&&<><div className="tool-heading"><div><button className="back-link" onClick={()=>navigate('tools')}>← 수업 도구</button><h1 ref={heading} tabIndex={-1}>{currentTool.name}</h1></div><button className="presentation-button" onClick={()=>void presentation()}>{presenting?'↙ 제시 모드 나가기':'⛶ 전체화면·제시 모드'}</button></div>{page==='timer'&&<Timer settings={settings} onSettings={persistSettings} onActive={onActive}/>} {page==='draw'&&<Draw settings={settings} onSettings={persistSettings}/>} {page==='groups'&&<Groups settings={settings} onSettings={persistSettings}/>} {page==='probability'&&<Probability onActive={onActive}/>} {page==='graph'&&<Graph/>}</>}
      {page==='manage'&&<><div className="page-heading"><span className="eyebrow">GROW YOUR COLLECTION</span><h1 ref={heading} tabIndex={-1}>{editing?'프로그램 수정':'프로그램 등록'}</h1><p>앞으로 만들 프로그램을, 나만의 수업 공간에.</p></div><form className="editor-panel" onSubmit={saveApp} noValidate><Field label="프로그램 이름"><input autoComplete="off" value={name} maxLength={60} placeholder="예: 도형 탐구실" onChange={e=>setName(e.target.value)}/></Field><Field label="설명 (선택)"><textarea value={description} maxLength={200} rows={3} placeholder="어떤 수업에 활용할 수 있나요?" onChange={e=>setDescription(e.target.value)}/></Field><Field label="웹주소" hint="https://로 시작하는 기본 주소 · ?와 #가 없는 주소"><input type="url" autoComplete="off" spellCheck={false} value={url} maxLength={2048} placeholder="https://example.com" onChange={e=>setUrl(e.target.value)}/></Field><p className="muted">학생 정보·비밀키·접속 토큰을 입력하지 마세요. 외부 프로그램은 새 탭에서 열리며, 오프라인 실행은 해당 프로그램에 따라 달라집니다.</p><div className="actions"><button className="primary">{editing?'수정 저장':'프로그램 등록'} ↗</button><button type="button" onClick={()=>navigate('hub')}>취소</button></div></form></>}
      {page==='settings'&&<><div className="page-heading"><span className="eyebrow">MADE TO STAY SIMPLE</span><h1 ref={heading} tabIndex={-1}>설정과 저장 공간</h1><p>수업 설정은 이 PC의 같은 브라우저에서 기억합니다.</p></div><div className="settings-grid"><section className="settings-card"><span className="eyebrow">LOCAL STORAGE</span><h2>내 브라우저에 저장</h2><dl><dt>학생 수</dt><dd>{settings.studentCount}명</dd><dt>제외 번호</dt><dd>{settings.excludedNumbers.join(', ')||'없음'}</dd><dt>타이머 기본값</dt><dd>{settings.timerSeconds}초</dd><dt>외부 프로그램</dt><dd>{apps.length}개</dd></dl><p className="muted">{settingsBlocked?'수업 설정 저장 잠김. ':''}{appsBlocked?'등록 목록 저장 잠김. ':''}브라우저 데이터를 삭제하면 설정이 사라집니다. 다른 PC와 동기화되지 않습니다. 같은 브라우저 사용자는 설정을 볼 수 있습니다.</p><div className="actions"><button onClick={()=>reset('settings')}>수업 설정 초기화</button><button onClick={()=>reset('apps')}>등록 목록 초기화</button><button className="danger" onClick={()=>reset('all')}>전체 초기화</button></div></section><section className="settings-card"><span className="eyebrow">OFFLINE, ON PURPOSE</span><h2>인터넷이 잠시 없어도</h2><p className="offline-status" role="status">{offline.status}</p><p className="muted">한 번 온라인에서 필수 파일을 받은 뒤 허브와 기본 수업 도구를 사용할 수 있습니다. 외부 프로그램은 별도입니다. 설정 초기화는 오프라인 파일을 지우지 않습니다.</p>{offline.waiting&&<button className="primary" onClick={update}>준비된 업데이트 적용</button>}<button onClick={()=>{void navigator.serviceWorker?.getRegistration().then(reg=>reg?.update()).then(()=>announce('업데이트 확인을 요청했습니다. 준비 상태를 확인해주세요.')).catch(()=>announce('온라인 연결 후 다시 확인해주세요.',true));}}>업데이트 다시 확인</button></section></div></>}
    </main><footer><span>Math Atelier <i>·</i> 수학 수업 허브</span><span>작은 도구로, 더 깊은 수업을.</span><span>LOCAL FIRST / NO ACCOUNT</span></footer>
  </div>;
}
