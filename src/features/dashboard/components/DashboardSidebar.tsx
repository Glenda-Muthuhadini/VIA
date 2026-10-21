import { Bot, ChartNoAxesColumnIncreasing, ChevronRight, Folder, GraduationCap, House, Landmark, LayoutGrid, ScanLine, Settings, WalletCards, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import viaLogo from '../../../assets/images/VIA Logo.png'
import type { Feature } from '../services/dashboard-model'

const groups: { title: string; items: { label: string; icon: LucideIcon; feature: Feature }[] }[] = [
  { title: 'MY JOURNEY', items: [
    { label: 'VIA Match', icon: LayoutGrid, feature: 'match' },
    { label: 'VIA Scan', icon: ScanLine, feature: 'scan' },
    { label: 'VIA Progress', icon: ChartNoAxesColumnIncreasing, feature: 'progress' },
  ] },
  { title: 'EXPLORE', items: [
    { label: 'Institutions', icon: Landmark, feature: 'institutions' },
    { label: 'Programmes', icon: GraduationCap, feature: 'programmes' },
    { label: 'Funding', icon: WalletCards, feature: 'fund' },
    { label: 'Accommodation', icon: House, feature: 'stay' },
  ] },
  { title: 'TOOLS', items: [{ label: 'VIA Vault', icon: Folder, feature: 'vault' }] },
]
export function SidebarContent({ onSelect, grade9 = false, grade10 = false, onNavigate }: { onSelect: (feature: Feature | null) => void; grade9?: boolean; grade10?: boolean; onNavigate?:()=>void }) {
  const location = useLocation()
  const grade9Groups = [{title:'HOME',items:[{label:'Home',icon:House,path:'/dashboard'}]},{title:'MY JOURNEY',items:[{label:'My Results',icon:ScanLine,path:'/dashboard/results'},{label:'Subject Choices',icon:LayoutGrid,path:'/dashboard/subject-choices'},{label:'Study Pathways',icon:GraduationCap,path:'/dashboard/study-pathways'},{label:'Next Steps',icon:ChartNoAxesColumnIncreasing,path:'/dashboard/next-steps'}]},{title:'TOOLS',items:[{label:'VIA Assist',icon:Bot,path:'/dashboard/assist'}]}]
  const visibleGroups = grade10 ? [{title:'MY JOURNEY',items:[{label:'My Results',icon:ScanLine,feature:'scan' as const},{label:'Subjects & Pathways',icon:LayoutGrid,feature:'subject-guide' as const},{label:'Programmes to Explore',icon:GraduationCap,feature:'programmes' as const},{label:'Requirement Check',icon:Landmark,feature:'match' as const},{label:'Improvements',icon:ChartNoAxesColumnIncreasing,feature:'whatif' as const},{label:'Next Steps',icon:ChartNoAxesColumnIncreasing,feature:'progress' as const}]},{title:'MY PROGRAMMES',items:[{label:'Saved Programmes',icon:Folder,feature:'saved' as const}]}] : grade9 ? [{title:'MY JOURNEY',items:[{label:'My Results',icon:ScanLine,feature:'scan' as const},{label:'Subject Choices',icon:LayoutGrid,feature:'subject-guide' as const},{label:'Study Pathways',icon:GraduationCap,feature:'programmes' as const},{label:'Next Steps',icon:ChartNoAxesColumnIncreasing,feature:'progress' as const}]}] : groups
  return <>
    <Link className="via-workspace-logo" to="/" aria-label="VIA home"><img src={viaLogo} alt="VIA" width="130" height="90" /></Link>
    <nav className="via-workspace-navigation" aria-label="Dashboard navigation">
      {grade9 ? grade9Groups.map(group=><div className="via-workspace-nav-group" key={group.title} role="group" aria-label={group.title}><p className="via-workspace-nav-heading" aria-hidden="true">{group.title}</p>{group.items.map(({label,icon:Icon,path})=><Link key={path} to={path} aria-label={label} title={label} onClick={onNavigate} className={location.pathname===path?'is-current':undefined} aria-current={location.pathname===path?'page':undefined}><Icon size={21} strokeWidth={1.7} aria-hidden="true"/><span>{label}</span></Link>)}</div>) : <><button className="is-current" type="button" aria-label="Home" aria-current="page" onClick={() => onSelect(null)}><House size={21} strokeWidth={1.7} aria-hidden="true" /><span>Home</span></button>
      {visibleGroups.map(group => <div className="via-workspace-nav-group" key={group.title} role="group" aria-label={group.title}>
        <p className="via-workspace-nav-heading" aria-hidden="true">{group.title}</p>
        {group.items.map(({label,icon:Icon,feature}) => <button type="button" key={label} aria-label={label} title={label} aria-haspopup={((grade9 && ['subject-guide','programmes','progress'].includes(feature)) || (grade10 && ['subject-guide','programmes','progress','match','whatif'].includes(feature))) ? undefined : 'dialog'} onClick={() => onSelect(feature)}><Icon size={21} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span></button>)}
      </div>)}</>}
    </nav>
    {!grade9&&<button className="via-workspace-assist via-workspace-glass" type="button" aria-label="Open VIA Assist" onClick={() => onSelect('assist')} aria-haspopup="dialog">
      <span className="via-workspace-assist-icon"><Bot size={22} aria-hidden="true" /></span><span><strong>VIA Assist</strong><small>Your intelligent guide</small></span><ChevronRight size={17} aria-hidden="true" />
    </button>}
    <div className="via-workspace-navigation via-workspace-settings"><button type="button" aria-label="Settings" title="Settings" aria-haspopup="dialog" onClick={() => onSelect('settings')}><Settings size={21} strokeWidth={1.7} aria-hidden="true" /><span>Settings</span></button></div>
    <div className="via-workspace-sidebar-art" aria-hidden="true" />
  </>
}
