import { Search } from 'lucide-react'
import { type ComponentProps } from 'react'
import { Input } from '../Input'

type SearchInputProps = Omit<ComponentProps<typeof Input>, 'icon' | 'type'>

export function SearchInput(props: SearchInputProps) {
  return <Input icon={<Search size={20} />} type="search" {...props} />
}
