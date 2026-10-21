// Editorial exploration guidance, checked against the linked primary sources.
// These examples do not calculate admission eligibility or choose subjects for a learner.
export const educationSources = [
  { id: 'mathematics', label: 'DBE Mathematics CAPS (Grades 10–12)', url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20_%20MATHEMATICS%20_%20GR%2010-12%20_%20Web_1133.pdf' },
  { id: 'mathematical-literacy', label: 'DBE Mathematical Literacy CAPS (Grades 10–12)', url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20_%20MATHEMATICAL%20LITERACY%20_%20GR%2010-12%20_%20Web_DDA9.pdf' },
  { id: 'aps', label: 'Wits: subject requirements and its APS method', url: 'https://www.wits.ac.za/undergraduate/entry-requirements/' },
  { id: 'subject-choice', label: 'DBE: subject choice and career pathing', url: 'https://www.education.gov.za/Informationfor/Learners/SubjectChoiceandCareerPathing/tabid/980/Default.aspx' },
  { id: 'subject-changes', label: 'WCED: subject changes and approval (2026)', url: 'https://www.westerncape.gov.za/education/files/wcg-blob-files?file=2025-12%2Fedam0022-2025.pdf&type=file' },
  { id: 'technology-routes', label: 'CPUT: explore its undergraduate prospectus', url: 'https://cput.ac.za/study-at-cput/undergraduate/apply' },
  { id: 'vocational-routes', label: 'DHET Career Help: vocational and study routes', url: 'https://careerhelp.org.za/content/frequently-asked-questions-2' },
  { id: 'physical-sciences', label: 'DBE Physical Sciences CAPS (Grades 10–12)', url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20%20PHYSICAL%20SCIENCE%20WEB.pdf' },
  { id: 'life-sciences', label: 'DBE Life Sciences CAPS (Grades 10–12)', url: 'https://www.education.gov.za/Portals/0/CD/National%20Curriculum%20Statements%20and%20Vocational/CAPS%20FET%20_%20LIFE%20SCIENCES%20_%20GR%2010-12%20Web_2636.pdf' },
] as const

export const mathsComparison = [
  {
    id: 'mathematics', name: 'Mathematics',
    focus: ['Algebra, equations and abstract problem-solving', 'Functions, graphs and number patterns', 'Geometry and trigonometry', 'Statistics, probability and financial mathematics; calculus later'],
    workload: 'Expect regular practice, showing your working and connecting new ideas to earlier algebra. Ask your teacher which foundations to strengthen and what support is available.',
    aps: 'Some institutions weight Mathematics differently. A stronger mark can help, but a subject requirement matters separately from the total APS.',
    pathways: 'Often required for engineering, physical sciences, computer science and quantitative commerce. Requirements differ for each programme.',
    careers: ['Engineering', 'Software and data', 'Actuarial and quantitative work', 'Scientific research'],
  },
  {
    id: 'mathematical-literacy', name: 'Mathematical Literacy',
    focus: ['Practical numerical reasoning in everyday situations', 'Finance: budgets, interest and financial documents', 'Measurement, maps and plans', 'Data handling, probability and interpreting information'],
    workload: 'Expect multi-step practical problems and careful reading of information. It still needs steady practice; it is a different subject with its own demands.',
    aps: 'There is no national fixed APS penalty for Maths Lit. Some programmes set different subject levels or APS thresholds; others do not accept it.',
    pathways: 'Accepted by some humanities, education, law, business, hospitality and vocational programmes. It does not replace Mathematics when Mathematics is required.',
    careers: ['Some education and social-service routes', 'Hospitality and tourism', 'Some business and administrative routes', 'Creative and vocational routes, depending on the course'],
  },
] as const

export const algebraResponses = ["I enjoy it / I'm prepared to work at it", "It's okay", 'I struggle with it', "I'm not sure"] as const

export const mathsStrategicReality = 'Compare the subjects a pathway requires before comparing APS. A high Maths Lit mark cannot replace Mathematics for a programme that requires it. APS methods vary: for example, Wits gives extra points for English and Mathematics from 60%, while other institutions use their own methods. Your Grade 9 mark is a starting point for a support plan, not a predicted matric mark or an admission decision.'

export const mathsSwitchAdvice = 'Moving from Mathematics to Mathematical Literacy later is often more manageable than moving back, because Mathematics builds cumulative algebra and other topics that Maths Lit does not cover in the same way. Neither change is automatic: your school and assessment body must approve it, subject availability and deadlines apply, and linked subjects may also be affected. Ask your school before planning a switch.'

export function mathsGuidance(mark: number | null, response: string, signals: string[]): string[] {
  const validMark = mark !== null && Number.isFinite(mark) && mark >= 0 && mark <= 100
  const advice = [validMark
    ? `Your current Mathematics mark is ${mark}%. Use your latest report and teacher feedback to understand which skills need practice.`
    : 'Add your latest Mathematics result to make this reflection more useful. You can still explore both subjects now.']
  if (signals.some(signal => /engineer|comput|software|data|actuari|physical science|architect|pharmac|medic/i.test(signal))) advice.push('Your saved interests include routes where Mathematics is often important. Check a few specific programmes and discuss a Mathematics support plan before narrowing those routes.')
  else if (signals.length) advice.push('Your interests can connect to several study routes. Some may accept Maths Lit and some may require Mathematics; explore the actual programme subjects before choosing.')
  else advice.push('You do not need a dream career yet. Explore more than one area so you can see what each subject choice would keep open.')
  if (response === 'I struggle with it' || (validMark && mark < 50)) advice.push('Struggling now is a reason to ask for help, not a decision on its own. Ask your teacher about algebra gaps, a realistic practice routine and the support you could use in Grade 10.')
  else if (response === algebraResponses[0]) advice.push('Your willingness to practise is useful. Try some Grade 10 algebra with a teacher and ask what consistent effort would look like.')
  else if (response === "It's okay") advice.push('Compare the type of work in each subject and the pathways that interest you. Discuss both your confidence and the work you are prepared to do.')
  else advice.push('Try a short algebra exercise and a practical Maths Lit problem with your teacher. Notice what you enjoy and where you need help.')
  advice.push('VIA does not choose for you. Discuss your plan with your teacher and a parent or caregiver, including the subject combinations your school offers.')
  return advice
}

export type PathwayDetail = {
  id: string; title: string; pattern: RegExp; description: string; careers: { name: string; description: string }[]
  supportingSubjects: string[]; laterSubjects: string; routes: { name: string; description: string }[]; requirements: string; programmes: string[]; source: string
}

export const pathwayDetails: PathwayDetail[] = [
  {
    id: 'technology', title: 'Technology & Computing', pattern: /technolog|comput|software|data|coding|digital/i,
    description: 'Create and improve software, networks and digital tools, or use data to understand problems. Different jobs combine coding, analytical thinking, design and teamwork.',
    careers: [{ name: 'Software developer', description: 'Design, build and test applications.' }, { name: 'Data analyst or scientist', description: 'Investigate data and explain useful patterns.' }, { name: 'Network technician', description: 'Set up and support systems that connect people and devices.' }],
    supportingSubjects: ['Mathematics', 'Information Technology', 'Computer Applications Technology'],
    laterSubjects: 'Keep building Mathematics and language skills in Grades 11–12. IT and CAT can help you explore computing; they are not universal admission requirements.',
    routes: [{ name: 'University', description: 'Computer science, information systems and related degrees.' }, { name: 'University of technology', description: 'Applied computing qualifications such as software development or networking, depending on the institution.' }, { name: 'TVET / occupational', description: 'Vocational IT, computer support and related occupational learning. Check the specific qualification and progression route.' }],
    requirements: 'Many computer science degrees require Mathematics. Some applied computing courses offer a different Mathematics or Maths Lit route. Check each programme rather than assuming that all IT courses are the same.',
    programmes: ['Computer Science', 'Information Technology', 'Data Science', 'Software Development'], source: 'https://www.wits.ac.za/undergraduate/entry-requirements/',
  },
  {
    id: 'engineering', title: 'Engineering, Built Environment & Physical Science', pattern: /engineer|building|construction|robot|architect|physics|physical science|\bscience\b|research/i,
    description: 'Use science, mathematics and design to understand the physical world and solve practical problems, from energy and structures to materials and the environment.',
    careers: [{ name: 'Civil engineer', description: 'Work on water, transport, buildings and other infrastructure.' }, { name: 'Electrical engineer or technician', description: 'Work with electrical and electronic systems.' }, { name: 'Physical scientist', description: 'Investigate matter, energy or materials through experiments and analysis.' }],
    supportingSubjects: ['Mathematics', 'Physical Sciences', 'Engineering Graphics and Design'],
    laterSubjects: 'Mathematics and Physical Sciences remain especially important in Grades 11–12 for many engineering and physical science programmes. Drawing and design can support built-environment interests.',
    routes: [{ name: 'University', description: 'Engineering, architecture and science degrees, with different subject and selection requirements.' }, { name: 'University of technology', description: 'Engineering technology degrees, diplomas and related applied science qualifications.' }, { name: 'TVET / occupational', description: 'Technical and vocational routes in areas such as electrical, civil or mechanical work, alongside workplace training where required.' }],
    requirements: 'For example, Wits Civil Engineering requires Mathematics and Physical Sciences. Architecture and technical routes have their own requirements; this subject combination does not automatically qualify you for all of them.',
    programmes: ['Engineering', 'Physical Sciences', 'Architecture', 'Construction'], source: 'https://www.wits.ac.za/course-finder/undergraduate/ebe/civil-engineering/',
  },
  {
    id: 'health', title: 'Health, Life & Environmental Sciences', pattern: /medic|health|doctor|nurs|biology|life science|environment|pharmac|nature/i,
    description: 'Explore living systems, people’s health and the natural environment. Some roles involve caring for people; others focus on laboratories, conservation or research.',
    careers: [{ name: 'Health professional', description: 'Support health through a regulated profession such as medicine, nursing or pharmacy.' }, { name: 'Biological scientist', description: 'Study organisms and living processes.' }, { name: 'Environmental practitioner', description: 'Investigate and help manage impacts on the natural world.' }],
    supportingSubjects: ['Mathematics', 'Life Sciences', 'Physical Sciences', 'Geography'],
    laterSubjects: 'Continue developing science, Mathematics and language foundations. The importance of Life Sciences, Physical Sciences and Geography depends on the health or environmental route.',
    routes: [{ name: 'University', description: 'Health professional degrees and biological or environmental science degrees.' }, { name: 'University of technology', description: 'Applied health, laboratory and environmental qualifications where offered.' }, { name: 'TVET / occupational', description: 'Explore related community, care or environmental occupational qualifications. These are distinct from qualifying as a doctor, pharmacist or other regulated professional.' }],
    requirements: 'Health programmes vary. For example, Wits Medicine uses Mathematics, English and the better of Life Sciences or Physical Sciences in its selection approach. Both sciences are not universally required for every health course.',
    programmes: ['Health Sciences', 'Biological Sciences', 'Environmental Sciences', 'Pharmacy'], source: 'https://www.wits.ac.za/course-finder/undergraduate/health/medicine-and-surgery/',
  },
  {
    id: 'business', title: 'Business, Finance & Entrepreneurship', pattern: /business|account|finance|commerce|econom|entrepreneur|management/i,
    description: 'Understand how organisations work, how money is managed and how ideas become services or businesses. This includes people, planning, accounting and decision-making.',
    careers: [{ name: 'Accountant', description: 'Prepare and interpret financial information.' }, { name: 'Business manager', description: 'Coordinate people, operations and resources.' }, { name: 'Entrepreneur', description: 'Develop a product or service and build a business around it.' }],
    supportingSubjects: ['Mathematics', 'Accounting', 'Business Studies', 'Economics'],
    laterSubjects: 'Build numerical, language and analytical skills through Grades 11–12. Accounting and Business Studies can support exploration; they are not compulsory for every business programme.',
    routes: [{ name: 'University', description: 'Commerce, accounting, economics and management degrees.' }, { name: 'University of technology', description: 'Applied business, accountancy and management qualifications.' }, { name: 'TVET / occupational', description: 'Business, finance, office administration and entrepreneurial vocational or occupational programmes.' }],
    requirements: 'Many quantitative commerce and professional accounting routes require Mathematics. Some business and vocational programmes accept Maths Lit. Professional designations require further accredited study and training.',
    programmes: ['Accounting', 'Finance', 'Business', 'Economics', 'Entrepreneurship'], source: 'https://www.wits.ac.za/undergraduate/entry-requirements/',
  },
  {
    id: 'creative', title: 'Creative Arts, Design & Media', pattern: /creativ|art|design|music|media|film|perform|fashion/i,
    description: 'Communicate ideas through images, objects, stories, music or performance. Creative work combines making, feedback, technical skill and understanding an audience.',
    careers: [{ name: 'Designer', description: 'Develop visual communication, products or other designed experiences.' }, { name: 'Media practitioner', description: 'Create and edit content for different audiences.' }, { name: 'Performer or artist', description: 'Develop and share creative work.' }],
    supportingSubjects: ['Visual Arts', 'Dramatic Arts', 'Design', 'Music', 'Languages'],
    laterSubjects: 'Keep developing language and creative skills in Grades 11–12. Some specialised routes ask for a portfolio, audition or other selection task; find out what the particular course expects.',
    routes: [{ name: 'University', description: 'Degrees in areas such as fine art, music, film, design or media.' }, { name: 'University of technology', description: 'Applied design, visual communication and other creative qualifications where offered.' }, { name: 'TVET / occupational', description: 'Explore vocational and occupational learning in creative production, clothing or media-related work where offered.' }],
    requirements: 'Creative school subjects can support your interests, but are not required by every creative programme. Mathematical requirements and selection tasks differ by course.',
    programmes: ['Design', 'Visual Arts', 'Film & Media', 'Music'], source: 'https://cput.ac.za/study-at-cput/undergraduate/apply',
  },
  {
    id: 'humanities', title: 'Humanities, Languages & Social Sciences', pattern: /humanit|language|history|social|psycholog|communicat|writing|people/i,
    description: 'Explore people, society, culture, language and how we understand the world. Reading, writing, asking questions and comparing evidence are central skills.',
    careers: [{ name: 'Researcher', description: 'Investigate questions about people and society.' }, { name: 'Communications practitioner', description: 'Help people and organisations communicate clearly.' }, { name: 'Community practitioner', description: 'Work with communities through an appropriate qualification and role.' }],
    supportingSubjects: ['Languages', 'History', 'Geography', 'Life Sciences'],
    laterSubjects: 'Strengthen reading, writing and evidence-based arguments in Grades 11–12. Your specific interests may make history, languages, geography or science useful.',
    routes: [{ name: 'University', description: 'Degrees in languages, humanities and social sciences.' }, { name: 'University of technology', description: 'Explore applied communication and related social or public-service qualifications where offered.' }, { name: 'TVET / occupational', description: 'Community, administrative and public-service related programmes may provide a different practical route.' }],
    requirements: 'Some humanities programmes accept Maths Lit. Specific fields can have additional subjects or selection requirements. Regulated careers, including psychology and social work, require their own recognised training.',
    programmes: ['Humanities', 'Languages', 'Social Sciences', 'Communication'], source: 'https://www.wits.ac.za/undergraduate/entry-requirements/',
  },
  {
    id: 'agriculture', title: 'Agriculture & Food Systems', pattern: /agricultur|farm|food|animal|plant/i,
    description: 'Explore growing food, caring for plants and animals, managing resources and the businesses behind food production.',
    careers: [{ name: 'Agricultural scientist', description: 'Investigate crops, animals, soils or production systems.' }, { name: 'Farm manager', description: 'Coordinate production, resources and people.' }, { name: 'Agricultural technician', description: 'Support technical and practical work in agriculture.' }],
    supportingSubjects: ['Agricultural Sciences', 'Life Sciences', 'Mathematics', 'Physical Sciences', 'Geography'],
    laterSubjects: 'Build science and numerical foundations in Grades 11–12. The balance of biology, chemistry, geography and business depends on the agricultural area.',
    routes: [{ name: 'University', description: 'Agricultural science, food science and related degrees.' }, { name: 'University of technology', description: 'Applied agriculture and food-related qualifications where offered.' }, { name: 'TVET / occupational', description: 'Agricultural vocational or occupational learning can focus on practical production skills.' }],
    requirements: 'Agriculture includes both scientific and practical routes. Mathematics and science requirements vary; check the specific qualification and what your school offers.',
    programmes: ['Agriculture', 'Food Science', 'Animal Science', 'Agribusiness'], source: 'https://careerhelp.org.za/content/frequently-asked-questions-2',
  },
  {
    id: 'education', title: 'Education & Teaching', pattern: /educat|teach|learning|children|childhood/i,
    description: 'Help people learn by understanding learners, planning lessons and explaining ideas. Teaching different ages and subjects calls for different strengths.',
    careers: [{ name: 'Teacher', description: 'Teach learners in the phase and subjects for which you are qualified.' }, { name: 'Early childhood practitioner', description: 'Support young children’s development through appropriate training.' }, { name: 'Learning-material developer', description: 'Create resources that help people learn.' }],
    supportingSubjects: ['Languages', 'Mathematics or Mathematical Literacy', 'Subjects you may want to teach'],
    laterSubjects: 'Keep languages strong in Grades 11–12 and explore the subjects you might enjoy teaching. A future Mathematics or science teacher needs a different subject foundation from other specialisations.',
    routes: [{ name: 'University', description: 'Teaching degrees and other recognised routes into teaching.' }, { name: 'University of technology', description: 'Education and teaching qualifications where offered.' }, { name: 'TVET / occupational', description: 'Explore early childhood or education-related vocational and occupational programmes, checking what role each qualification prepares you for.' }],
    requirements: 'The teaching phase, specialisation and institution determine the subject requirements. Some routes accept Maths Lit; do not assume that every education qualification leads to the same teaching role.',
    programmes: ['Education', 'Teaching', 'Early Childhood Development'], source: 'https://www.wits.ac.za/undergraduate/entry-requirements/',
  },
  {
    id: 'law', title: 'Law, Justice & Public Service', pattern: /law|legal|justice|polic|public service|government/i,
    description: 'Explore rules, rights, public decisions and how society resolves disputes. Careful reading, clear communication and evaluating arguments matter.',
    careers: [{ name: 'Legal professional', description: 'Work in a legal role after the required recognised study and professional training.' }, { name: 'Public administrator', description: 'Help organise public services and processes.' }, { name: 'Policy researcher', description: 'Investigate the effects of rules and public decisions.' }],
    supportingSubjects: ['Languages', 'History', 'Business Studies', 'Mathematics or Mathematical Literacy'],
    laterSubjects: 'Develop reading, writing and reasoning in Grades 11–12. Compare the requirements of law with related business or public-service courses; they are different pathways.',
    routes: [{ name: 'University', description: 'Law degrees, public administration and related degrees.' }, { name: 'University of technology', description: 'Public management and related applied qualifications where offered.' }, { name: 'TVET / occupational', description: 'Explore administrative and public-service programmes with practical or occupational skills.' }],
    requirements: 'There is no single compulsory school-subject package for every law or public-service route. For example, Wits considers Maths Lit for LLB. Legal professional admission requires further steps beyond a school subject plan.',
    programmes: ['Law', 'Public Administration', 'Public Management'], source: 'https://www.wits.ac.za/undergraduate/entry-requirements/',
  },
  {
    id: 'services', title: 'Hospitality, Tourism & Services', pattern: /hospitality|touris|travel|cook|cater|service|sport/i,
    description: 'Create helpful experiences for people through hospitality, travel, events and other service work. Practical skill, communication and planning often work together.',
    careers: [{ name: 'Hospitality manager', description: 'Help organise accommodation, food service or guest experiences.' }, { name: 'Tourism practitioner', description: 'Help people explore places and plan travel experiences.' }, { name: 'Chef or culinary practitioner', description: 'Develop food preparation and kitchen skills.' }],
    supportingSubjects: ['Hospitality Studies', 'Tourism', 'Consumer Studies', 'Business Studies', 'Languages'],
    laterSubjects: 'Build communication, practical and numerical skills through Grades 11–12. Your school may offer tourism, hospitality or consumer subjects, depending on its subject package.',
    routes: [{ name: 'University', description: 'Explore relevant tourism, sport or management degrees where offered.' }, { name: 'University of technology', description: 'Applied tourism, hospitality and service-management qualifications.' }, { name: 'TVET / occupational', description: 'Hospitality, tourism and occupational programmes can develop practical job-related skills.' }],
    requirements: 'Some courses accept Maths Lit and some have other numerical or practical requirements. Work placements or professional requirements may apply later; check the specific course.',
    programmes: ['Hospitality', 'Tourism', 'Culinary Arts', 'Events Management'], source: 'https://cput.ac.za/study-at-cput/undergraduate/apply',
  },
  {
    id: 'environment', title: 'Environment, Geography & Conservation', pattern: /environment|geograph|conserv|sustainab|nature|climate/i,
    description: 'Understand places, ecosystems and how people use natural resources. This can involve science, fieldwork, maps, policy or community projects.',
    careers: [{ name: 'Conservation practitioner', description: 'Help protect habitats, species and natural resources.' }, { name: 'Environmental scientist', description: 'Investigate environmental processes and impacts.' }, { name: 'Geographic information practitioner', description: 'Use maps and spatial data to understand places.' }],
    supportingSubjects: ['Geography', 'Life Sciences', 'Mathematics', 'Physical Sciences'],
    laterSubjects: 'Keep Geography, science and numerical skills in view during Grades 11–12. Environmental science, geography and conservation routes can place different emphasis on these subjects.',
    routes: [{ name: 'University', description: 'Environmental science, geography and related degrees.' }, { name: 'University of technology', description: 'Applied conservation, environmental and spatial-information qualifications where offered.' }, { name: 'TVET / occupational', description: 'Explore practical environmental, conservation and related occupational programmes where offered.' }],
    requirements: 'Science-based courses often have Mathematics or science requirements. Other environmental routes may differ; investigate each qualification rather than assuming Geography alone is enough.',
    programmes: ['Environmental Sciences', 'Geography', 'Conservation', 'Geographic Information Systems'], source: 'https://cput.ac.za/study-at-cput/undergraduate/apply',
  },
]

export const assistQuestions = [
  { id: 'maths', question: "What's the difference between Maths and Maths Lit?", answer: 'Mathematics develops algebra, functions, geometry and other abstract tools. Mathematical Literacy applies numerical reasoning to finance, measurement, data and everyday contexts. Both need practice. Some future programmes require Mathematics, so compare the subjects and study routes before choosing.', to: '/dashboard/subject-choices#maths', action: 'Compare Maths & Maths Lit', sourceId: 'mathematics' },
  { id: 'caps', question: 'What does CAPS Level 6 mean?', answer: 'CAPS performance Level 6 means 70–79%, described as meritorious achievement. It describes the mark for that subject. It is not an APS total, and an institution may use a different points calculation.', to: '/dashboard/results', action: 'View My Results', sourceId: 'aps' },
  { id: 'science', question: 'Why would I need Physical Sciences?', answer: 'Physical Sciences introduces physics and chemistry. It can support engineering, physical science and several health routes. It is not required for every career: check the subjects of programmes that interest you and ask your school about its subject combinations.', to: '/dashboard/subject-choices#other-subjects', action: 'Explore Grade 10 subjects', sourceId: 'physical-sciences' },
  { id: 'engineering', question: 'What subjects do I need for engineering?', answer: 'Mathematics and Physical Sciences are important to explore for engineering. Many engineering degrees require both. Technical, artisan and engineering technology routes have their own requirements. Keep language skills strong too, and check each course rather than treating one example as a universal rule.', to: '/dashboard/study-pathways?pathway=engineering#pathway-detail', action: 'Explore engineering pathways', sourceId: 'technology-routes' },
  { id: 'business', question: 'What can Business Studies lead to?', answer: 'It can help you explore how organisations operate, including management, entrepreneurship and business decisions. Related study areas include business, marketing and finance. It is a useful foundation, not a guarantee of admission or a universal requirement. Some commerce programmes also require Mathematics.', to: '/dashboard/study-pathways?pathway=business#pathway-detail', action: 'Explore business pathways', sourceId: 'aps' },
  { id: 'recommendations', question: 'Why is VIA showing me this subject?', answer: 'VIA connects your saved interests and possible pathways with your current school subjects and marks. Open a subject to see its explanation and evidence. These are planning suggestions; a mark or an interest on its own does not decide which subjects you should take.', to: '/dashboard/subject-choices#other-subjects', action: 'Review my subject suggestions', sourceId: 'subject-choice' },
  { id: 'reports', question: 'How do I add another report?', answer: 'Open My Results and choose Add Results. You can scan or upload a report, or enter marks manually. Review the subjects, marks, school, year and report period before confirming. Keep previous reports so you can see changes over time.', to: '/dashboard/results', action: 'Go to My Results', sourceId: null },
  { id: 'aps', question: 'Does Maths Lit automatically give me a lower APS?', answer: 'No single APS rule applies to every institution. Some use different weighting or programme thresholds for Mathematics and Maths Lit. More importantly, Maths Lit cannot replace Mathematics for a programme that requires Mathematics. Grade 9 marks do not give you a final university APS.', to: '/dashboard/subject-choices#maths', action: 'Understand the strategic reality', sourceId: 'aps' },
  { id: 'switch', question: 'Can I change from Maths Lit back to Mathematics?', answer: 'It can be difficult because Mathematics builds topics you may have missed. A change in either direction needs school and assessment-body approval, must meet the applicable deadlines and may affect other subjects. Speak to your school before relying on a later switch.', to: '/dashboard/subject-choices#maths', action: 'Review the Maths decision', sourceId: 'subject-changes' },
] as const
