export type GuideBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list' | 'steps' | 'checklist'; items: string[] }
  | { type: 'example'; title: string; requirements: { label: string; value: string }[] }

type StudentGuide = { slug: string; title: string; description: string; blocks: GuideBlock[]; to: string; cta: string }

export const studentGuides: StudentGuide[] = [
  {
    slug: 'choosing-grade-10-subjects', title: 'Choosing Your Grade 10 Subjects',
    description: 'Your Grade 10 subjects can affect what you can study after matric.',
    blocks: [
      { type: 'paragraph', text: 'Before choosing, think about:' },
      { type: 'list', items: ['What you enjoy', "Which subjects you're good at", 'Careers that interest you', 'Subjects required for those careers and programmes'] },
      { type: 'paragraph', text: "Not sure what you want to do yet? That's okay. Explore different pathways before making your choice." },
    ], to: '/programmes', cta: 'Explore Programmes',
  },
  {
    slug: 'understanding-aps', title: 'Understanding Your APS',
    description: 'Your APS (Admission Point Score) is calculated using your school marks.',
    blocks: [
      { type: 'paragraph', text: 'Universities use it to help determine which programmes you may qualify for.' },
      { type: 'paragraph', text: 'But APS is not enough on its own.' },
      { type: 'paragraph', text: 'A programme may also require specific subjects and minimum marks.' },
      { type: 'example', title: 'BSc Computer Science', requirements: [{ label: 'APS', value: '30+' }, { label: 'Mathematics', value: '60%+' }, { label: 'English', value: '50%+' }] },
    ], to: '/programmes?check=1', cta: 'Calculate My APS',
  },
  {
    slug: 'university-applications', title: 'How Applications Work', description: '',
    blocks: [
      { type: 'steps', items: ["Find a programme you're interested in.", 'Check if you meet the requirements.', 'Check the application deadline.', 'Prepare your documents.', "Apply on the institution's official website.", 'Track your application.'] },
      { type: 'paragraph', text: 'VIA helps you find and prepare for applications. Your actual application is completed through the institution.' },
    ], to: '/programmes', cta: 'Explore Programmes',
  },
  {
    slug: 'funding-and-bursaries', title: 'Paying for Your Studies',
    description: 'There are different ways to fund your studies:',
    blocks: [
      { type: 'list', items: ['NSFAS', 'Bursaries', 'Scholarships', 'Student loans', 'Institution funding'] },
      { type: 'paragraph', text: 'Before applying, check:' },
      { type: 'list', items: ['Who qualifies', 'What is covered', 'Required documents', 'Closing date'] },
    ], to: '/bursaries', cta: 'Explore Funding',
  },
  {
    slug: 'nsfas', title: 'Understanding NSFAS',
    description: 'NSFAS provides financial aid to eligible students studying at qualifying public universities and TVET colleges.',
    blocks: [
      { type: 'paragraph', text: 'Before applying, check:' },
      { type: 'list', items: ['Whether you qualify', 'What funding covers', 'What documents you need', 'Application dates'] },
      { type: 'paragraph', text: 'Applications are completed through the official NSFAS platform.' },
    ], to: '/nsfas', cta: 'Learn More About NSFAS',
  },
  {
    slug: 'accommodation', title: 'Finding Student Accommodation',
    description: 'Before choosing accommodation, compare:',
    blocks: [
      { type: 'list', items: ['Cost', 'Distance from campus', 'Transport', 'Security', 'Internet', 'Meals', 'What your funding covers'] },
      { type: 'paragraph', text: 'Accommodation may include:' },
      { type: 'list', items: ['Institution residences', 'Accredited student accommodation', 'Private accommodation'] },
    ], to: '/accommodation', cta: 'Explore Accommodation',
  },
  {
    slug: 'preparing-for-higher-education', title: 'Getting Ready for Student Life',
    description: "You've been accepted. What happens next?",
    blocks: [
      { type: 'checklist', items: ['Accept your offer', 'Confirm your funding', 'Find accommodation', 'Complete registration', 'Plan your budget', 'Attend orientation', 'Know where to get academic and wellness support'] },
      { type: 'paragraph', text: 'VIA will help you keep track of what comes next.' },
    ], to: '/dashboard', cta: 'Go to My Journey',
  },
]
