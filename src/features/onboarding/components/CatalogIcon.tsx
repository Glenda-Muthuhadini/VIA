import { Archive, BarChart3, BookOpen, Brain, BriefcaseBusiness, Check, Cog, Compass, FileText, Globe2, GraduationCap, Heart, HeartPulse, Home, Landmark, Laptop, Map, MapPin, Palette, Search, Sprout, Target, Users, WalletCards } from 'lucide-react'
const icons = { Archive, BarChart3, BookOpen, Brain, BriefcaseBusiness, Check, Cog, Compass, FileText, Globe2, GraduationCap, Heart, HeartPulse, Home, Landmark, Laptop, Map, MapPin, Palette, Search, Sprout, Target, Users, WalletCards }
export function CatalogIcon({ name, size = 25 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? Compass
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />
}
