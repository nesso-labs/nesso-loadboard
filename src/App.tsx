import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AlertsPage } from './pages/AlertsPage'
import { ComparePage } from './pages/ComparePage'
import { DataQualityPage } from './pages/DataQualityPage'
import { DrillsPage } from './pages/DrillsPage'
import { DynamicLoadPage } from './pages/DynamicLoadPage'
import { GameVGamePage } from './pages/GameVGamePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { OverviewPage } from './pages/OverviewPage'
import { PlayerProfilePage } from './pages/PlayerProfilePage'
import { RosterPage } from './pages/RosterPage'
import { SessionsPage } from './pages/SessionsPage'
import { SessionVGamePage } from './pages/SessionVGamePage'
import { SessionVSessionPage } from './pages/SessionVSessionPage'
import { SettingsPage } from './pages/SettingsPage'
import { WeeklyRunningPage } from './pages/WeeklyRunningPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/dynamic-load" element={<DynamicLoadPage />} />
        <Route path="/session-v-game" element={<SessionVGamePage />} />
        <Route path="/session-v-session" element={<SessionVSessionPage />} />
        <Route path="/game-v-game" element={<GameVGamePage />} />
        <Route path="/weekly-running" element={<WeeklyRunningPage />} />
        <Route path="/drills" element={<DrillsPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/players" element={<PlayerProfilePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/quality" element={<DataQualityPage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
