import './globals.css';
import AutoDmShortcut from './AutoDmShortcut';
import CustomerAddShortcut from './CustomerAddShortcut';
export const metadata = {title:'모아 · SNS 워크스페이스',description:'마케팅 대행사를 위한 콘텐츠와 고객 대화 관리'};
export default function Layout({children}) {return <html lang="ko"><body>{children}<CustomerAddShortcut/><AutoDmShortcut/></body></html>}
