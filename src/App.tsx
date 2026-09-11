import { BarChart3, CalendarRange, ClipboardList, Settings, Trophy, UserCircle } from 'lucide-react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AlertsPage } from './pages/AlertsPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { DrillsPage } from './pages/DrillsPage'
import { OverviewPage } from './pages/OverviewPage'
import { RosterPage } from './pages/RosterPage'
import { SessionsPage } from './pages/SessionsPage'
import { SessionVGamePage } from './pages/SessionVGamePage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route
          path="/dynamic-load"
          element={
            <ComingSoonPage
              icon={BarChart3}
              title="Dynamic Load"
              description="Trend multi-sessione (7d rolling average) su distanza, HSR, sprint, mechanical work e sRPE. Richiede più sessioni in archivio — in arrivo."
            />
          }
        />
        <Route path="/session-v-game" element={<SessionVGamePage />} />
        <Route
          path="/session-v-session"
          element={
            <ComingSoonPage
              icon={CalendarRange}
              title="Session v Session"
              description="Questa sessione confrontata con lo storico per gruppo di posizione — richiede più sessioni comparabili, in arrivo."
            />
          }
        />
        <Route
          path="/weekly-running"
          element={
            <ComingSoonPage
              icon={ClipboardList}
              title="Weekly Running"
              description="Percentuale per giocatore su un riferimento settimanale, con media squadra — in arrivo."
            />
          }
        />
        <Route path="/drills" element={<DrillsPage />} />
        <Route
          path="/players"
          element={
            <ComingSoonPage
              icon={UserCircle}
              title="Player Profile"
              description="Storico individuale nel tempo per ogni giocatore — in arrivo."
            />
          }
        />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route
          path="/leaderboard"
          element={
            <ComingSoonPage
              icon={Trophy}
              title="Leaderboard"
              description="Classifica giocatori per metrica scelta — in arrivo."
            />
          }
        />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route
          path="/settings"
          element={
            <ComingSoonPage
              icon={Settings}
              title="Settings"
              description="Soglie di zona, scala RPE e definizione dei drill 'game-like' — in arrivo."
            />
          }
        />
      </Route>
    </Routes>
  )
}
