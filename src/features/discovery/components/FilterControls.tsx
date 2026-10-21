import { discoveryConfig,type OpportunityKind,type SearchResult } from '../services/model'
import { displayText } from '../services/presentation'
export function FilterControls({kind,result,filters,onChange,onClear}: {kind:OpportunityKind;result:SearchResult|null;filters:Record<string,string>;onChange:(key:string,value:string)=>void;onClear:()=>void}) {
 return <div className="via-discovery-filter-controls"><div className="via-discovery-filter-heading"><h2>Refine your search</h2><button type="button" onClick={onClear}>Clear all</button></div>
  {discoveryConfig[kind].filters.map(filter=>{
   const options=filter.options??(filter.key==='institution'?result?.institutions??[]:filter.key==='programme'?result?.programmeOptions??[]:(result?.facets[filter.key]??[]).map(value=>({value,label:value})))
   return <label key={filter.key}>{filter.label}{filter.type?<input type={filter.type} min={filter.type==='number'?0:undefined} max={filter.type==='number'?99999999:undefined} inputMode={filter.type==='number'?'decimal':undefined} value={filters[filter.key]??''} onChange={event=>onChange(filter.key,event.target.value)}/>:<select value={filters[filter.key]??''} onChange={event=>onChange(filter.key,event.target.value)}><option value="">All options</option>{filters[filter.key]&&!options.some(option=>option.value===filters[filter.key])&&<option value={filters[filter.key]}>{displayText(filters[filter.key])}</option>}{options.map(option=><option key={option.value} value={option.value}>{displayText(option.label)}</option>)}</select>}</label>
  })}<p className="via-filter-note">Filters use published information. Unknown values are excluded when you request a specific requirement.</p>
 </div>
}
