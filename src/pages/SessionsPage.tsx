import { Upload } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImportWizard } from '../import/ImportWizard'
import { EmptyState } from '../components/ui/EmptyState'
import type { Session } from '../types/domain'
import { useRpeBySessionQuery, useSessionsQuery } from '../state/queries'

function SessionRow({ session }: { session: Session }) {
  const { data: rpe = [] } = useRpeBySessionQuery(session.id)
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-2 tabular-nums text-ink">{session.date}</td>
      <td className="px-4 py-2 font-medium text-ink">{session.label}</td>
      <td className="px-4 py-2 text-ink-secondary">{session.type === 'match' ? 'Partita' : 'Allenamento'}</td>
      <td className="px-4 py-2 tabular-nums text-ink-secondary">{session.rawRowCount}</td>
      <td className="px-4 py-2">
        {session.warningCount > 0 ? (
          <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-xs font-medium text-status-warning">
            {session.warningCount} avvisi
          </span>
        ) : (
          <span className="rounded-full bg-status-good/15 px-2 py-0.5 text-xs font-medium text-status-good">OK</span>
        )}
      </td>
      <td className="px-4 py-2 text-xs text-ink-muted">{rpe.length > 0 ? `RPE: ${rpe.length}` : 'RPE mancante'}</td>
    </tr>
  )
}

export function SessionsPage() {
  const { data: sessions = [], isLoading } = useSessionsQuery()
  const [importing, setImporting] = useState(false)
  const navigate = useNavigate()

  if (importing) {
    return (
      <ImportWizard
        onClose={() => {
          setImporting(false)
          navigate('/drills')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-secondary">Storico delle sessioni importate in questo browser.</p>
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:opacity-90"
        >
          <Upload className="size-4" /> Nuovo import
        </button>
      </div>

      {isLoading ? null : sessions.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="Nessuna sessione importata"
          description="Importa il primo export CSV per iniziare."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Etichetta</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Righe</th>
                <th className="px-4 py-2">Import</th>
                <th className="px-4 py-2">RPE</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
