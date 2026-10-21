export const educationStages = [
  { value: 'grade_9', label: 'Grade 9', description: "I'm preparing to choose my Grade 10 subjects.", journey: ['discover','choose'], dashboard: 'subjects' },
  { value: 'grade_10', label: 'Grade 10', description: "I'm building my academic direction.", journey: ['discover','prepare'], dashboard: 'trajectory' },
  { value: 'grade_11', label: 'Grade 11', description: "I'm preparing for higher education.", journey: ['prepare','match'], dashboard: 'matches' },
  { value: 'grade_12', label: 'Grade 12', description: "I'm completing matric and preparing for what's next.", journey: ['apply'], dashboard: 'applications' },
  { value: 'post_matric', label: 'Finished school / Taking a gap year', description: "I've finished school and I'm planning my next move.", journey: ['choose','apply'], dashboard: 'planning' },
  { value: 'accepted', label: 'Accepted / Starting higher education', description: "I'm getting ready to start higher education.", journey: ['apply','fund','stay'], dashboard: 'starting' },
  { value: 'tertiary', label: 'Currently studying at a university or college', description: "I'm currently studying at a university or college.", journey: ['study'], dashboard: 'study' },
  { value: 'graduate', label: 'Graduate', description: "I've completed a qualification and I'm planning my next step.", journey: ['graduate'], dashboard: 'next-step' },
] as const
export type EducationStage = typeof educationStages[number]['value']
export const isEducationStage = (value: unknown): value is EducationStage => educationStages.some(stage => stage.value === value)
export const legacyStages: Record<string, EducationStage> = { 'current-2': 'grade_11', 'current-3': 'grade_12', 'current-4': 'post_matric', 'current-5': 'tertiary' }
