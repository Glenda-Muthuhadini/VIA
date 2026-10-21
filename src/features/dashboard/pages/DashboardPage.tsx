import { journeyStages } from '../../journey/journey'
import { educationStages } from '../../onboarding/config/education-stages'
import { CatalogIcon } from '../../onboarding/components/CatalogIcon'
import { ArrowRight, Bell, Compass, GraduationCap, ChevronDown, ChevronRight, Circle, FileText, Folder, Menu, Search, Star, Target, UsersRound, WalletCards, X, CalendarDays } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import viaLogo from '../../../assets/images/VIA Logo.png'
import dashboardScenery from '../../../assets/images/dashboard-journey.png'
import { SidebarContent } from '../components/DashboardSidebar'
import { AcademicSnapshot } from '../components/AcademicSnapshot'
import { WhatIfExperience } from '../components/WhatIfExperience'
import { SavedOpportunities } from '../components/SavedOpportunities'
import { useDashboard } from '../services/useDashboard'
import type { DashboardData } from '../services/dashboard-model'
import { AuthStatus } from '../../auth/components/AuthStatus'
import { dashboardOnboardingRedirect } from '../../auth/services/dashboard-access'
import { deriveDashboard, type Feature } from '../services/dashboard-model'
import { dashboardFeatureDetails } from '../services/feature-details'
import { Grade9Dashboard } from '../components/Grade9Dashboard'
import { Grade10Dashboard } from '../components/Grade10Dashboard'
import './DashboardPage.css'

export function DashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const { data, loading, error, retry } = useDashboard(user?.id)
  if (!user) return null
  if (error) return <AuthStatus error message="We could not load your VIA account. Please try again." retry={retry} />
  if (loading || !data?.profile || !data.activeAnswers) return <AuthStatus message="Loading your VIA…" />
  const destination = dashboardOnboardingRedirect(data.profile, data.record, data.activeAnswers)
  if (destination) return <Navigate to={destination} replace />
  if (data.profile.education_stage !== 'grade_9' && location.pathname !== '/dashboard') return <Navigate to="/dashboard" replace />
  return <DashboardContent key={user.id} data={data} retry={retry} />
}

function DashboardContent({ data, retry }: { data: DashboardData; retry: () => void }) {
  const { user, profile, profileError, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const metadataName = typeof user?.user_metadata.first_name === 'string' ? user.user_metadata.first_name.trim() : ''
  const displayName = profile?.first_name.trim() || metadataName || 'there'
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const [searchParams] = useSearchParams()
  const [feature, setFeature] = useState<Feature | null>(data.profile?.education_stage !== 'grade_9' && searchParams.get('panel') === 'subject-guide' ? 'subject-guide' : null)
  const [query, setQuery] = useState('')
  const [whatIfSubject, setWhatIfSubject] = useState<string | undefined>()
  const loading = false
  const dataError = false
  const view = data ? deriveDashboard(data) : null
  const isGrade9 = (data?.profile?.education_stage ?? profile?.education_stage) === 'grade_9'
  const isGrade10 = (data?.profile?.education_stage ?? profile?.education_stage) === 'grade_10'
  const isEarlySchool = isGrade9 || isGrade10
  const featureDetails = dashboardFeatureDetails(data, { name: [profile?.first_name || metadataName, profile?.last_name || user?.user_metadata.last_name].filter(Boolean).join(' ') || displayName, email: user?.email || 'Not available' })
  const unavailableNote = loading ? 'Loading your VIA…' : dataError ? 'Unable to load your VIA.' : ''
  const statistics = [
    { title: 'VIA Matches', count: view?.matches === null || !view ? '—' : view.matches.length, unit: view?.matches === null ? 'Not calculated' : 'matches', note: unavailableNote || (view?.matches === null ? 'Your matches are not calculated yet.' : 'Based on your saved VIA.'), action: 'View VIA Matches', icon: UsersRound, tone: 'mint', feature: 'match' as const },
    { title: 'Application Readiness', count: '—', unit: 'Check pending', note: unavailableNote || (view?.incomplete ? 'Finish your VIA profile basics.' : !view?.results.length ? 'Add your latest academic results.' : 'Review your saved profile basics.'), action: 'View readiness', icon: FileText, tone: 'blue', feature: 'applications' as const },
    { title: 'Funding', count: data?.funding == null ? '—' : data.funding.length, unit: data?.funding == null ? 'Not matched yet' : 'opportunities', note: unavailableNote || 'Review funding that may support your studies.', action: 'View funding', icon: WalletCards, tone: 'gold', feature: 'fund' as const },
    { title: 'Saved', count: data?.saved == null ? '—' : data.saved.length, unit: data?.savedLoading ? 'Loading…' : data?.saved == null ? 'Not available yet' : 'opportunities saved', note: unavailableNote || 'Your saved opportunities, together.', action: 'View saved', icon: Folder, tone: 'rose', feature: 'saved' as const },
  ]
  const featureDialog = useRef<HTMLDialogElement>(null)
  const navigationDialog = useRef<HTMLDialogElement>(null)
  async function handleSignOut() {
    if (isSigningOut) return
    setIsSigningOut(true)
    setSignOutError('')
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { setSignOutError('We could not log you out. Check your connection and try again.') }
    finally { setIsSigningOut(false) }
  }
  const searchResults = (isGrade10 ? [{label:'My results',detail:'Your subjects and marks',feature:'scan' as const},{label:'My subjects and pathways',detail:'Where your subjects can take you',feature:'subject-guide' as const},{label:'Programmes to explore',detail:'Connected to your subjects and interests',feature:'programmes' as const},{label:'Programme requirements',detail:'Check future subject marks',feature:'match' as const},{label:'Improvements',detail:'Marks to work towards',feature:'whatif' as const},{label:'My next steps',detail:'Your journey',feature:'progress' as const}] : isGrade9 ? [{label:'My results',detail:'Your subjects and marks',feature:'scan' as const},{label:'Grade 10 subject choices',detail:'Your future pathways',feature:'subject-guide' as const},{label:'Careers and study pathways',detail:'Explore your interests',feature:'programmes' as const},{label:'My next steps',detail:'Your journey',feature:'progress' as const}] : [
    ...(view?.goals.map(label => ({ label, detail: 'Your study interests', feature: 'programmes' as const })) ?? []),
    ...(view?.results.map(result => ({ label: result.subject, detail: 'Your academic results', feature: 'scan' as const })) ?? []),
    ...(view?.matches?.map(match => ({ label: match.programme, detail: match.institution, feature: 'match' as const })) ?? []),
    ...[{ label: 'Institutions', feature: 'institutions' as const }, { label: 'Programmes', feature: 'programmes' as const }, { label: 'Funding and bursaries', feature: 'fund' as const }, { label: 'Accommodation', feature: 'stay' as const }, { label: 'VIA Match', feature: 'match' as const }, { label: 'VIA Scan', feature: 'scan' as const }, { label: 'VIA Progress', feature: 'progress' as const }, { label: 'VIA Vault', feature: 'vault' as const }].map(item => ({ ...item, detail: 'Explore VIA' })),
  ]).filter(item => (item.label + ' ' + item.detail).toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    const dialog = featureDialog.current
    if (feature && dialog && !dialog.open) dialog.showModal()
    if (!feature && dialog?.open) dialog.close()
  }, [feature])

  function openFeature(nextFeature: Feature | null) {
    navigationDialog.current?.close()
    setQuery('')
    if (isGrade9 && (nextFeature === null || ['scan','subject-guide','programmes','progress','assist'].includes(nextFeature))) {
      setFeature(null)
      const paths: Partial<Record<Feature,string>> = {scan:'results','subject-guide':'subject-choices',programmes:'study-pathways',progress:'next-steps',assist:'assist'}
      navigate(nextFeature ? `/dashboard/${paths[nextFeature]}` : '/dashboard')
      return
    }
    const section = isGrade10 && nextFeature ? ({'subject-guide':'grade10-pathways',programmes:'grade10-programmes',match:'grade10-check',whatif:'grade10-improve',progress:'grade10-next'} as Partial<Record<Feature,string>>)[nextFeature] : isGrade9 && nextFeature ? ({'subject-guide':'grade9-choices',programmes:'grade9-pathways',progress:'grade9-next'} as Partial<Record<Feature,string>>)[nextFeature] : undefined
    if (section) { setFeature(null); document.getElementById(section)?.scrollIntoView({behavior:'smooth',block:'start'}); return }
    setFeature(nextFeature)
    if (nextFeature && featureDialog.current && !featureDialog.current.open) featureDialog.current.showModal()
    if (!nextFeature) window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function openWhatIf(subjectId?: string) {
    setWhatIfSubject(subjectId ?? view?.weakest?.subjectId)
    openFeature('whatif')
  }
  function taskList() {
    if (!view) return <p className="via-workspace-empty">{loading ? 'Loading your next steps…' : 'Your next steps could not be loaded. Please retry.'}</p>
    if (!view.tasks.length) return <p className="via-workspace-empty">Your next actions and deadlines will appear in VIA Progress.</p>
    return <>
      {view.suggestedTasks && <p className="via-workspace-tasks-caption">Suggested next actions</p>}
      <ul className="via-workspace-tasks">{view.tasks.map(task => {
        const due = task.dueAt ? new Date(task.dueAt) : null
        const validDue = due && Number.isFinite(due.getTime())
        return <li key={task.id}>
          <span className="via-workspace-task-date">{validDue ? <><strong>{due.getDate()}</strong><span>{due.toLocaleString('en-ZA', { month: 'short' })}</span></> : task.kind === 'academic' ? <Target size={22} /> : task.kind === 'application' ? <FileText size={22} /> : task.kind === 'funding' ? <WalletCards size={22} /> : <Compass size={22} />}</span>
          <span className="via-workspace-task-title">{task.title}</span>
          <button className="via-workspace-round-button" type="button" aria-label={`Review ${task.title}`} onClick={() => task.feature === 'whatif' ? openWhatIf() : openFeature(task.feature)}><ChevronRight size={17} /></button>
        </li>
      })}</ul>
    </>
  }

  return (
    <main className="via-workspace" data-user-id={user?.id} data-education-stage={data.profile?.education_stage}>
      <aside className="via-workspace-sidebar via-workspace-glass" aria-label="VIA sidebar">
        <SidebarContent onSelect={openFeature} grade9={isGrade9} grade10={isGrade10} onNavigate={() => {navigationDialog.current?.close();setQuery('')}} />
      </aside>
      <div className="via-workspace-main">
        <header className="via-workspace-topbar">
          <button className="via-workspace-mobile-menu via-workspace-icon-button" type="button" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => navigationDialog.current?.showModal()}><Menu size={23} aria-hidden="true" /></button>
          <Link className="via-workspace-mobile-brand" to="/" aria-label="VIA home"><img src={viaLogo} alt="VIA" width="64" height="44" /></Link>
          <form className="via-workspace-search" role="search" onSubmit={event => { event.preventDefault(); if (query.trim() && searchResults[0]) openFeature(searchResults[0].feature) }}>
            <Search size={19} aria-hidden="true" />
            <input aria-label={isEarlySchool ? 'Search results, subjects and careers' : 'Search careers, courses and institutions'} placeholder={isEarlySchool ? 'Search results, subjects, careers...' : 'Search for careers, courses, institutions...'} value={query}
              onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery('') }} />
            {query && <button className="via-workspace-clear-search" type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
            {query.trim() && (
              <div className="via-workspace-search-results via-workspace-glass">
                <span className="via-workspace-search-caption">Search your VIA</span>
                {searchResults.length ? searchResults.map(result => (
                  <button type="button" key={result.label} onClick={() => openFeature(result.feature)}><span>{result.label}<small>{result.detail}</small></span><ChevronRight size={16} /></button>
                )) : <p role="status">{isEarlySchool ? 'No matching items. Try results, subjects or careers.' : 'No matching items. Try VIA Scan or funding.'}</p>}
              </div>
            )}
          </form>
          <div className="via-workspace-account-actions">
            <details className="via-workspace-notifications">
              <summary className="via-workspace-icon-button" aria-label="Notifications"><Bell size={22} strokeWidth={1.6} />{view && view.tasks.length > 0 && <span className="via-workspace-notification-dot" />}</summary>
              <div className="via-workspace-popover via-workspace-glass"><strong>Your next steps</strong><p>{loading ? 'Loading your next steps…' : dataError ? 'Your next steps could not be loaded.' : view?.tasks.length ? (isGrade10 ? 'Explore programmes connected to your subjects and see which marks to work towards.' : isGrade9 ? 'Explore your interests and compare Grade 10 subject choices.' : 'Review your next actions in VIA Progress.') : 'No new updates right now.'}</p><button type="button" onClick={() => openFeature('progress')}>{isEarlySchool ? "View my next steps" : "View upcoming tasks"} <ArrowRight size={16} /></button></div>
            </details>
            <details className="via-workspace-profile">
              <summary aria-label={`Open ${displayName}’s profile menu`}><span className="via-workspace-avatar" aria-hidden="true">{displayName[0]?.toUpperCase()}</span><strong>{displayName}</strong><ChevronDown size={16} /></summary>
              <div className="via-workspace-popover via-workspace-glass"><span className="via-workspace-search-caption">YOUR VIA ACCOUNT</span><button type="button" onClick={() => openFeature('profile')}>My VIA profile <ChevronRight size={16} /></button><Link to={isEarlySchool ? "/onboarding/interests" : "/onboarding/preferences"}>Review preferences <ChevronRight size={16} /></Link><Link to="/">Back to VIA <ChevronRight size={16} /></Link><button type="button" disabled={isSigningOut} onClick={handleSignOut}>{isSigningOut ? 'Logging out…' : 'Log out'}<ArrowRight size={16} /></button></div>
            </details>
          </div>
        </header>
        {(profileError || signOutError) && <p className="via-workspace-auth-notice" role="alert">{signOutError || profileError}{profileError && !signOutError && <button type="button" onClick={refreshProfile}>Retry profile</button>}</p>}
        {dataError && <p className="via-workspace-auth-notice" role="alert">We could not load your learner data.<button type="button" onClick={retry}>Retry dashboard</button></p>}
        {!isEarlySchool && view?.banner && <p className="via-workspace-auth-notice">{view.banner.text}<Link to={view.banner.to}>{view.banner.action}<ArrowRight size={14} /></Link></p>}
        <div className="via-workspace-content">
          {isGrade10 ? (data ? <Grade10Dashboard data={data} name={displayName} onResults={() => openFeature('scan')} onRetry={retry} /> : <p role="status">{loading ? 'Loading your Grade 10 journey…' : 'Your journey could not be loaded. Use Retry dashboard above.'}</p>) : isGrade9 ? <Grade9Dashboard data={data} name={displayName} page={location.pathname.slice('/dashboard'.length).replace(/^\//,'') || 'home'} /> : <>
          <section className="via-workspace-overview" aria-labelledby="via-workspace-greeting">
            <div className="via-workspace-art" aria-hidden="true">
              <img src={dashboardScenery} alt="" />
              <svg className="via-workspace-trajectory" viewBox="0 0 600 340" fill="none" preserveAspectRatio="none"><path d="M20 330C30 170 155 5 580 25" stroke="white" strokeOpacity=".75" /><path d="M80 300C80 190 200 55 540 45" stroke="#5eae91" strokeDasharray="6 6" strokeWidth="1.5" /></svg>
              <ol className="via-workspace-journey-markers">{journeyStages.map(({ id, label, icon }) => <li key={id} className={educationStages.find(stage => stage.value === data?.profile?.education_stage)?.journey.some(value => value === id) ? 'is-current' : 'is-future'}><CatalogIcon name={icon} size={19} /><span>{label}</span></li>)}</ol>
            </div>
            <div className="via-workspace-greeting"><h1 id="via-workspace-greeting">Good morning, {displayName}</h1><p>Let’s keep moving towards your future.</p></div>
            <article className="via-workspace-journey-card via-workspace-glass">
              <p className="via-workspace-eyebrow">Your VIA</p>
              <h2>{loading ? 'Loading your journey…' : view?.stage || 'Your personal journey'}{(view?.goals[0] || view?.interests[0]) && <span> – Exploring {view.goals[0] || view.interests[0]}</span>}</h2>
              <div className="via-workspace-next-step">
                <span className="via-workspace-target"><Target size={34} strokeWidth={1.8} aria-hidden="true" /></span>
                <div><strong>Your Next Move</strong><p>{view?.nextMove.title || (loading ? 'Loading your personalised next step…' : 'Retry loading your VIA to see your next move.')}</p></div>
                <button className="via-workspace-round-button" type="button" aria-label="Review your next step" disabled={!view} onClick={() => view?.nextMove.feature === 'whatif' ? openWhatIf(view.nextMove.subjectId) : openFeature(view?.nextMove.feature ?? 'profile')}><ChevronRight size={20} /></button>
              </div>
              <button className="via-workspace-primary" type="button" disabled={!view} onClick={() => view?.nextMove.feature === 'whatif' ? openWhatIf(view.nextMove.subjectId) : openFeature(view?.nextMove.feature ?? 'profile')}>{view?.nextMove.action || 'Your next move'}<ArrowRight size={16} aria-hidden="true" /></button>
            </article>
          </section>
          <section className="via-workspace-statistics" aria-label="Your journey at a glance">
            {statistics.map(({ title, count, unit, note, action, icon: Icon, tone, feature: target }) => (
              <article className={`via-workspace-stat-card via-workspace-glass is-${tone}`} key={title}>
                <div className="via-workspace-stat-main"><span className="via-workspace-stat-icon"><Icon size={27} strokeWidth={1.9} aria-hidden="true" /></span><div className="via-workspace-stat-copy"><h2>{title}</h2><p><strong>{count}</strong><span>{unit}</span></p></div><button className="via-workspace-round-button" type="button" aria-label={`Open ${title.toLowerCase()}`} onClick={() => openFeature(target)}><ChevronRight size={18} /></button></div>
                <p className="via-workspace-stat-note">{note}</p>
                <button className="via-workspace-soft-button" type="button" onClick={() => openFeature(target)}>{action}<ArrowRight size={16} aria-hidden="true" /></button>
              </article>
            ))}
          </section>
          <div className="via-workspace-detail-grid">
            {!['accepted','tertiary','graduate'].includes(data?.profile?.education_stage??'')&&<AcademicSnapshot results={view?.results ?? []} loading={loading} unavailable={dataError} onScan={() => openFeature('scan')} onWhatIf={openWhatIf} />}
            <section className="via-workspace-detail-card via-workspace-glass" aria-labelledby="via-matches-title">
              <header className="via-workspace-section-heading"><span><Star size={23} fill="currentColor" strokeWidth={1} aria-hidden="true" /><h2 id="via-matches-title">Top VIA Matches</h2></span><button className="via-workspace-round-button" type="button" aria-label="View all VIA Matches" onClick={() => openFeature('match')}><ChevronRight size={18} /></button></header>
              {view?.matches?.length ? <div className="via-workspace-matches">{view.matches.slice(0,3).map(match => <button className="via-workspace-match" type="button" key={match.id} onClick={() => openFeature('match')}><span className="via-workspace-match-thumbnail"><GraduationCap size={31} strokeWidth={1.4} aria-hidden="true" /></span><span className="via-workspace-match-copy"><strong>{match.programme}</strong><span>{match.institution}</span>{match.percentage !== null && <small>{match.percentage}% Match</small>}{match.reason && <span>{match.reason}</span>}</span><ChevronRight size={19} aria-hidden="true" /></button>)}</div> : <p className="via-workspace-empty">{loading ? 'Loading your VIA…' : dataError ? 'Your matches could not be loaded. Please retry.' : view?.matches === null ? 'Your programme matches have not been calculated yet. Add your results and interests to get ready.' : 'No programme matches are available for your profile yet.'}</p>}

              <button className="via-workspace-soft-button" type="button" onClick={() => openFeature('match')}>View all VIA Matches <ArrowRight size={16} aria-hidden="true" /></button>
            </section>
            <section className="via-workspace-detail-card via-workspace-glass" aria-labelledby="via-tasks-title">
              <header className="via-workspace-section-heading"><span><CalendarDays size={22} aria-hidden="true" /><h2 id="via-tasks-title">Upcoming Tasks</h2></span><button className="via-workspace-round-button" type="button" aria-label="View VIA Progress" onClick={() => openFeature('progress')}><ChevronRight size={18} /></button></header>
              {taskList()}
              <button className="via-workspace-soft-button" type="button" onClick={() => openFeature('progress')}>View VIA Progress <ArrowRight size={16} aria-hidden="true" /></button>
            </section>
          </div>
          </>}
        </div>
      </div>
      <dialog className="via-workspace-dialog via-workspace-navigation-dialog" ref={navigationDialog} aria-label="Dashboard navigation" onClick={event => { if (event.target === event.currentTarget) navigationDialog.current?.close() }}>
        <button className="via-workspace-dialog-close via-workspace-icon-button" type="button" aria-label="Close navigation" onClick={() => navigationDialog.current?.close()}><X size={22} /></button>
        <SidebarContent onSelect={openFeature} grade9={isGrade9} grade10={isGrade10} onNavigate={() => {navigationDialog.current?.close();setQuery('')}} />
      </dialog>
      <dialog className="via-workspace-dialog via-workspace-feature-dialog" ref={featureDialog} aria-labelledby="via-feature-title" onClose={event => { if (!event.currentTarget.open) setFeature(null) }} onClick={event => { if (event.target === event.currentTarget) setFeature(null) }}>
        <button className="via-workspace-dialog-close via-workspace-icon-button" type="button" aria-label="Close details" onClick={() => setFeature(null)}><X size={22} /></button>
        {feature && <><span className="via-workspace-dialog-eyebrow">{feature === 'profile' || feature === 'settings' ? 'YOUR VIA ACCOUNT' : 'YOUR VIA'}</span><h2 id="via-feature-title">{featureDetails[feature].title}</h2>
          {feature === 'whatif' ? <WhatIfExperience key={whatIfSubject || 'scenario'} results={view?.results ?? []} initialSubjectId={whatIfSubject} /> : <>
            <p className="via-workspace-dialog-description">{featureDetails[feature].description}</p>
            {['saved','institutions','programmes','fund','stay'].includes(feature) ? <SavedOpportunities items={data?.saved??null} loading={data.savedLoading} feature={isGrade10 && feature === 'saved' ? 'programmes' : feature}/> : feature === 'progress' ? taskList() : featureDetails[feature].items.length > 0 && <ul className="via-workspace-feature-list">{featureDetails[feature].items.map(item => <li key={item}><Circle size={8} fill="currentColor" aria-hidden="true" /><span>{item}</span></li>)}</ul>}
            {featureDetails[feature].link && <Link className="via-workspace-primary" to={featureDetails[feature].link!}>{featureDetails[feature].action}<ArrowRight size={16} /></Link>}
          </>}
        </>}
      </dialog>
    </main>
  )
}
