import { StrictMode, Component } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './style.css';
class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <main className="fatal"><h1>화면을 불러오지 못했습니다.</h1><p>저장 자료를 삭제하지 않고 다시 시도할 수 있습니다.</p><button onClick={()=>location.reload()}>다시 불러오기</button></main> : this.props.children;}
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App/></ErrorBoundary></StrictMode>);
