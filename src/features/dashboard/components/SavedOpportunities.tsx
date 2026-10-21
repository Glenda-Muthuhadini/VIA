import { Link } from 'react-router'
import type { Feature, SavedOpportunity } from '../services/dashboard-model'
import './SavedOpportunities.css'

const groups=[{kind:'institution',title:'Saved Institutions',path:'/institutions',feature:'institutions'},{kind:'programme',title:'Saved Programmes',path:'/programmes',feature:'programmes'},{kind:'funding',title:'Saved Funding',path:'/bursaries',feature:'fund'},{kind:'accommodation',title:'Saved Accommodation',path:'/accommodation',feature:'stay'}] as const
export function SavedOpportunities({items,feature,loading=false}:{items:SavedOpportunity[]|null;feature:Feature;loading?:boolean}) {
  if(loading)return <p role="status">Loading your saved opportunities…</p>
  if(items===null)return <p role="status">Saved opportunities could not be loaded. Retry loading your dashboard.</p>
  return <div className="via-saved-groups">{groups.filter(group=>feature==='saved'||group.feature===feature).map(group=>{
    const saved=items.filter(item=>item.kind===group.kind)
    return <section key={group.kind}><h3>{group.title}</h3>{saved.length?<ul>{saved.map(item=><li key={item.id}><Link to={`${group.path}?${new URLSearchParams({opportunity:item.id})}`}>{item.title}<span aria-hidden="true">→</span></Link></li>)}</ul>:<p>No saved {group.title.slice(6).toLowerCase()} yet.</p>}</section>
  })}</div>
}
