import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { MobileNavDrawer } from './MobileNavDrawer'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-full bg-page">
      <aside className="no-print hidden w-60 shrink-0 flex-col gap-4 border-r border-border bg-surface p-4 md:flex">
        <div className="px-1 text-sm font-semibold tracking-tight text-ink">LoadBoard</div>
        <Sidebar className="flex-1" />
      </aside>

      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
