import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

interface ComingSoonPageProps {
  icon: LucideIcon
  title: string
  description: string
}

/** Placeholder for pages not yet built in this milestone — never fake data. */
export function ComingSoonPage({ icon, title, description }: ComingSoonPageProps) {
  return <EmptyState icon={icon} title={title} description={description} />
}
