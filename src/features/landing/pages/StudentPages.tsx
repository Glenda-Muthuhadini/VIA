import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, Mail } from 'lucide-react'
import { Link } from 'react-router'
import { GuideLink } from '../components/GuideLink'
import './StudentPages.css'

function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  useEffect(() => { window.scrollTo(0, 0) }, [title])
  return <header className="via-student-intro"><p className="via-public-overline">{eyebrow}</p><h1>{title}</h1><p>{children}</p></header>
}

export function AboutPage() {
  return <main className="via-student-page" id="discovery-main">
    <PageIntro eyebrow="About VIA" title="Your future. A clearer way forward.">VIA helps young South Africans understand their options and take their next step from high school into higher education.</PageIntro>
    <div className="via-student-card-grid is-three">
      <section className="via-student-card"><h2>What is VIA?</h2><p>A place to explore institutions, programmes, funding and accommodation, and connect your subjects and results to possible study pathways.</p></section>
      <section className="via-student-card"><h2>Why it exists</h2><p>Study requirements, applications and funding information can be scattered and difficult to compare. VIA brings these decisions into a clearer journey.</p></section>
      <section className="via-student-card"><h2>Growing with you</h2><p>From Grade 9 subject choices to applications and student life, VIA helps you understand where you are and what comes next.</p></section>
    </div><div className="via-student-actions"><Link className="via-public-button is-primary" to="/signup">Create My VIA Profile<ArrowRight size={18} aria-hidden="true"/></Link><GuideLink className="via-public-button">Explore student guides</GuideLink></div>
  </main>
}

const emptyContact = { name: '', email: '', subject: '', message: '' }
export function ContactPage() {
  const [values, setValues] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('via-contact-draft') || 'null')
      if (stored && Object.keys(emptyContact).every(key => typeof stored[key] === 'string')) return {
        name: stored.name.slice(0, 160), email: stored.email.slice(0, 254), subject: stored.subject.slice(0, 160), message: stored.message.slice(0, 5000),
      } as typeof emptyContact
    } catch { /* A blocked or invalid draft should not prevent use of the form. */ }
    return emptyContact
  })
  const [notice, setNotice] = useState('')
  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { localStorage.setItem('via-contact-draft', JSON.stringify(values)); setNotice('Draft saved on this device. Your message has not been sent. Message delivery is not available yet.') }
    catch { setNotice('Your browser could not save the draft. Your message has not been sent. Keep a copy of your message before leaving this page.') }
  }
  return <main className="via-student-page" id="discovery-main">
    <PageIntro eyebrow="Contact VIA" title="Let’s hear from you.">Have a question or feedback? Prepare your message below.</PageIntro>
    <div className="via-contact-layout"><aside className="via-student-card"><Mail size={28} aria-hidden="true"/><h2>Get in touch</h2><p>Message delivery is being set up. For now, you can save a draft on this device and come back to it.</p><p>For questions about a specific application, contact the institution or funding provider directly.</p><GuideLink>Find help in our student guides<ArrowRight size={18} aria-hidden="true"/></GuideLink></aside>
    <form className="via-student-card via-contact-form" onSubmit={saveDraft}>
      {(['name', 'email', 'subject', 'message'] as const).map(key => <label key={key} htmlFor={`contact-${key}`}><span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>{key === 'message' ? <textarea id={`contact-${key}`} required rows={6} maxLength={5000} value={values[key]} onChange={event => {setNotice('');setValues({...values, [key]: event.target.value})}}/> : <input id={`contact-${key}`} name={key} type={key === 'email' ? 'email' : 'text'} autoComplete={key === 'name' ? 'name' : key === 'email' ? 'email' : 'off'} required maxLength={key === 'email' ? 254 : 160} value={values[key]} onChange={event => {setNotice('');setValues({...values, [key]: event.target.value})}}/>}</label>)}
      <button className="via-public-button is-primary" type="submit">Save message draft<Check size={18} aria-hidden="true"/></button><p className="via-contact-notice" role="status">{notice}</p>
    </form></div>
  </main>
}

export function NsfasPage() {
  return <main className="via-student-page" id="discovery-main">
    <PageIntro eyebrow="Understand your funding" title="NSFAS, explained simply.">Learn what to prepare, how to apply and where to find official information.</PageIntro>
    <div className="via-student-actions"><a className="via-public-button is-primary" href="https://my.nsfas.org.za/">Go to myNSFAS<ArrowRight size={18} aria-hidden="true"/></a><a className="via-public-button" href="https://www.nsfas.org.za/">Official NSFAS website</a></div>
    <div className="via-student-card-grid">
      <section className="via-student-card"><h2>What is NSFAS?</h2><p>The National Student Financial Aid Scheme provides financial support for eligible students at South African public universities and TVET colleges.</p></section>
      <section className="via-student-card"><h2>Who can qualify?</h2><p>Applicants must meet the citizenship or residency, approved study and academic rules for their funding category at a public university or TVET college.</p><ul><li>The usual bursary income limit is R350 000 a year before deductions for the household combined.</li><li>For applicants with disabilities, the limit is R600 000 a year.</li><li>Qualifying SASSA grant recipients can meet the financial requirement through grant verification.</li></ul><p>Meeting the income requirement does not confirm funding. Loans have separate criteria and repayment terms.</p><a href="https://www.nsfas.org.za/content/faqs.html">Check eligibility with NSFAS<ArrowRight size={18} aria-hidden="true"/></a></section>
      <section className="via-student-card"><h2>What does it cover?</h2><p>Approved funding can cover registration, tuition and qualifying allowances such as accommodation, transport and learning materials. Limits and conditions depend on the funding type and study arrangements.</p><a href="https://www.nsfas.org.za/content/faqs.html">Read the funding conditions<ArrowRight size={18} aria-hidden="true"/></a></section>
      <section className="via-student-card"><h2>How to apply</h2><ol><li>Create or sign in to your myNSFAS account.</li><li>Complete your details and upload requested documents.</li><li>Submit, save your reference and track your status.</li></ol><a href="https://www.nsfas.org.za/content/how-to-apply.html">Official application steps<ArrowRight size={18} aria-hidden="true"/></a></section>
      <section className="via-student-card"><h2>Required documents</h2><ul><li>Your identification and requested parent or guardian details.</li><li>The current signed consent form.</li><li>Requested proof of household income.</li><li>Disability, guardianship or orphan/vulnerable child documents where applicable.</li></ul><p>Use the checklist in your account. Upload readable copies of every required page.</p></section>
      <section className="via-student-card"><h2>Important application information</h2><p>Check current opening and closing dates on the official website. Respond to document requests and monitor your status. Funding and admission are separate decisions.</p><p>Apply through official NSFAS channels. Applying is free.</p></section>
    </div>
    <p className="via-student-source">Sources: <a href="https://www.nsfas.org.za/content/faqs.html">NSFAS FAQs</a>, <a href="https://www.nsfas.org.za/content/how-to-apply.html">application guide</a> and <a href="https://www.nsfas.org.za/">supporting document guidance</a>. Reviewed 20 October 2026. Confirm current rules with NSFAS.</p>
  </main>
}
