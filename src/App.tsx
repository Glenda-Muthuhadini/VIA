import { Grade9StepPage } from './features/onboarding/pages/Grade9StepPage'
import { AdaptiveChoicePage } from './features/onboarding/pages/AdaptiveChoicePage'
import { JourneyStepPage, JourneyQuestion } from './features/onboarding/pages/JourneyStepPage'
import { PublicLayout } from './features/discovery/components/PublicLayout'
import { DiscoveryPage } from './features/discovery/pages/DiscoveryPage'
import { Route, Routes } from 'react-router'
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage'
import { LoginPage } from './features/auth/pages/LoginPage'
import { SignUpPage } from './features/auth/pages/SignUpPage'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import { LandingPage } from './features/landing/pages/LandingPage'
import { AboutPage, ContactPage, NsfasPage } from './features/landing/pages/StudentPages'
import { GuideOverlay } from './features/landing/components/GuideOverlay'
import { BuildingViaPage } from './features/onboarding/pages/BuildingViaPage'
import { CurrentStepPage } from './features/onboarding/pages/CurrentStepPage'
import { InterestsStepPage } from './features/onboarding/pages/InterestsStepPage'
import { PersonalityStepPage } from './features/onboarding/pages/PersonalityStepPage'
import { PreferencesStepPage } from './features/onboarding/pages/PreferencesStepPage'
import { ResultsStepPage } from './features/onboarding/pages/ResultsStepPage'
import { StudyPlanStepPage } from './features/onboarding/pages/StudyPlanStepPage'
import { ViaReadyPage } from './features/onboarding/pages/ViaReadyPage'
import { WelcomePage } from './features/onboarding/pages/WelcomePage'
import { AuthCallbackPage } from './features/auth/pages/AuthCallbackPage'
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage'
import { GuestOnly, RecoveryRedirect, RequireAuth } from './features/auth/components/AuthRoutes'
import { OnboardingLayout } from './features/onboarding/context/OnboardingProvider'

function App() {
  return (
    <>
      <RecoveryRedirect />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/guides" element={<LandingPage />} />
        <Route path="/guides/:slug" element={<LandingPage />} />
        <Route element={<PublicLayout />}>
          <Route path="/nsfas" element={<NsfasPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/institutions" element={<DiscoveryPage key="institutions" kind="institutions"/>}/>
          <Route path="/programmes" element={<DiscoveryPage key="programmes" kind="programmes"/>}/>
          <Route path="/bursaries" element={<DiscoveryPage key="bursaries" kind="bursaries"/>}/>
          <Route path="/accommodation" element={<DiscoveryPage key="accommodation" kind="accommodation"/>}/>
        </Route>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<OnboardingLayout />}>
            <Route path="/onboarding/welcome" element={<WelcomePage />} />
            <Route path="/onboarding/current" element={<CurrentStepPage />} />
            <Route path="/onboarding/interests" element={<JourneyQuestion kind="interests" legacy={<InterestsStepPage />}/>} />
            <Route path="/onboarding/results" element={<ResultsStepPage />} />
            <Route path="/onboarding/personality" element={<PersonalityStepPage />} />
            <Route path="/onboarding/study-plan" element={<StudyPlanStepPage />} />
            <Route path="/onboarding/preferences" element={<PreferencesStepPage />} />
            <Route path="/onboarding/school-subjects" element={<JourneyQuestion kind="school-subjects" legacy={<AdaptiveChoicePage kind="school-subjects" />}/>} />
            <Route path="/onboarding/future-curiosity" element={<AdaptiveChoicePage kind="future-curiosity" />} />
            <Route path="/onboarding/stage-pending" element={<AdaptiveChoicePage kind="stage-pending" />} />
            {(['career-interests','study-interests','programmes','study-location','applications','funding','matric-year','current-activity','institution','enrolled-programme','campus','starting-year','year-of-study','accommodation-status','registration','support'] as const).map(kind=><Route key={kind} path={`/onboarding/${kind}`} element={<JourneyStepPage kind={kind}/>}/>)}
            {(['school-details','confirm-results','subject-experience','subject-choice','subjects-considering','future-interests'] as const).map(kind=><Route key={kind} path={`/onboarding/${kind}`} element={<Grade9StepPage kind={kind}/>}/>)}
            <Route path="/onboarding/building" element={<BuildingViaPage />} />
            <Route path="/onboarding/ready" element={<ViaReadyPage />} />
          </Route>
          <Route path="/dashboard/*" element={<DashboardPage />} />
        </Route>
      </Routes>
      <GuideOverlay />
    </>
  )
}

export default App
