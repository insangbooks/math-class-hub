import { defaults, validateApps, validateSettings } from './core.ts';
import type { RegisteredApp, Settings } from './core.ts';
export interface StorageLike { getItem(key: string): string|null; setItem(key:string,value:string):void; removeItem(key:string):void }
export type Slot<T> = { value:T; blocked:boolean; warning:string };
export const SETTINGS_KEY='math-atelier.settings.v1';
export const APPS_KEY='math-atelier.apps.v1';
export function readSlot<T>(storage: StorageLike, key:string, fallback:T, validate:(v:unknown)=>T):Slot<T> {
  try {
    const raw=storage.getItem(key);
    if (raw===null) return {value:fallback,blocked:false,warning:''};
    if (raw.length>300000) throw new Error('자료 크기 초과');
    const parsed:unknown=JSON.parse(raw);
    if (!parsed || typeof parsed!=='object' || (parsed as {schemaVersion:unknown}).schemaVersion!==1) throw new Error('저장 버전 오류');
    return {value:validate((parsed as {data:unknown}).data), blocked:false, warning:''};
  } catch {
    return {value:fallback,blocked:true,warning:'저장 자료를 읽을 수 없어 임시 기본값으로 실행합니다. 원본 보호를 위해 저장을 잠갔습니다. 설정에서 확인 후 초기화해주세요.'};
  }
}
export function writeSlot<T>(storage:StorageLike,key:string,value:T,blocked:boolean,validate:(v:unknown)=>T):void {
  if (blocked) throw new Error('원본 보호로 저장이 잠겨 있습니다. 설정에서 해당 자료를 초기화한 뒤 저장해주세요.');
  const checked=validate(value);
  try { storage.setItem(key,JSON.stringify({schemaVersion:1,data:checked})); }
  catch { throw new Error('현재 브라우저에 저장하지 못했습니다. 기존 저장 자료와 입력은 유지됩니다. 저장 권한·여유 공간을 확인해주세요.'); }
}
export function browserStorage(): StorageLike {
  try { return window.localStorage; } catch {
    return {getItem(){throw new Error('unavailable');},setItem(){throw new Error('unavailable');},removeItem(){throw new Error('unavailable');}};
  }
}
export function loadSettings(s:StorageLike):Slot<Settings> { return readSlot(s,SETTINGS_KEY,{...defaults,excludedNumbers:[]},validateSettings); }
export function loadApps(s:StorageLike):Slot<RegisteredApp[]> { return readSlot(s,APPS_KEY,[],validateApps); }
