export type OfflineState={status:string;ready:boolean;waiting:ServiceWorker|null};
export function setupOffline(onChange:(state:OfflineState)=>void):()=>void {
  let stopped=false;let registration:ServiceWorkerRegistration|undefined;
  const publish=(status:string,ready=false,waiting:ServiceWorker|null=null)=>{if(!stopped)onChange({status,ready,waiting});};
  if(!('serviceWorker' in navigator)||!window.isSecureContext){publish('이 브라우저에서는 오프라인 준비를 지원하지 않습니다.');return ()=>{stopped=true;};}
  // Dev files are not a reliable offline bundle. Register only the production worker.
  if(import.meta.env.DEV){publish('개발 모드 · 오프라인은 빌드 미리보기에서 준비됩니다.');return ()=>{stopped=true;};}
  const query=()=>{
    const worker=navigator.serviceWorker.controller||registration?.active;
    if(!worker){publish('필수 파일을 저장하는 중입니다…');return;}
    const channel=new MessageChannel();
    const timeout=setTimeout(()=>{channel.port1.close();publish('오프라인 준비를 확인하지 못했습니다. 온라인에서 다시 시도해주세요.',false,registration?.waiting||null);},5000);
    channel.port1.onmessage=(event)=>{clearTimeout(timeout);channel.port1.close();publish(event.data?.ready?'오프라인 준비 완료':'오프라인 파일이 불완전합니다. 온라인에서 다시 준비해주세요.',event.data?.ready===true,registration?.waiting||null);};
    worker.postMessage({type:'CHECK_READY'},[channel.port2]);
  };
  const onController=()=>{query();};
  const onOnline=()=>{void registration?.update().catch(()=>publish('업데이트를 확인하지 못했습니다. 기존 버전을 유지합니다.'));query();};
  navigator.serviceWorker.addEventListener('controllerchange',onController);
  window.addEventListener('online',onOnline);
  publish('필수 파일을 저장하는 중입니다…');
  void navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
    if(stopped)return;registration=reg;query();
    reg.addEventListener('updatefound',()=>{const installing=reg.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'){if(reg.waiting)publish('업데이트 준비 완료 · 설정에서 적용할 수 있습니다.',!!reg.active,reg.waiting);else query();}if(installing.state==='redundant')publish('새 버전 준비에 실패했습니다. 기존 버전을 유지합니다.',!!reg.active);});});
    if(reg.waiting)publish('업데이트 준비 완료 · 설정에서 적용할 수 있습니다.',!!reg.active,reg.waiting);
  }).catch(()=>publish('오프라인 준비에 실패했습니다. 온라인 연결과 브라우저 설정을 확인해주세요.'));
  return ()=>{stopped=true;navigator.serviceWorker.removeEventListener('controllerchange',onController);window.removeEventListener('online',onOnline);};
}
