import { Fragment } from 'react'
import { HEAT_BAND_VAR, heatBand, median } from '../../lib/metrics/heatmap'

export interface HeatmapColumn<T> {
  key: string
  label: string
  /** Null means "no data for this cell" — rendered as a dash, uncolored, and excluded from the column median. */
  getValue: (row: T) => number | null
  format?: (value: number) => string
  unit?: string
}

export interface HeatmapGroup<T> {
  label: string
  rows: T[]
}

interface HeatmapTableProps<T> {
  columns: HeatmapColumn<T>[]
  groups: HeatmapGroup<T>[]
  getRowLabel: (row: T) => string
  getRowKey: (row: T) => string
  /** Denser type/padding, and never clipped when printed — for tables with many columns. */
  compact?: boolean
}

/**
 * Team-median header row + one row per player, grouped (e.g. by position),
 * with a diverging heatmap tint per cell relative to the column's team
 * median. The number is always printed — color is a secondary cue, never
 * the only signal (dataviz skill: never color alone).
 */
export function HeatmapTable<T>({ columns, groups, getRowLabel, getRowKey, compact }: HeatmapTableProps<T>) {
  const allRows = groups.flatMap((g) => g.rows)
  const medians = columns.map((col) => {
    const values = allRows.map((r) => col.getValue(r)).filter((v): v is number => v !== null)
    return values.length > 0 ? median(values) : null
  })

  const fmt = (col: HeatmapColumn<T>, value: number) => (col.format ? col.format(value) : value.toFixed(1))

  const firstColPad = compact ? 'px-3 py-1 print:px-1.5 print:py-0.5' : 'px-4 py-2'
  const cellPad = compact ? 'px-2 py-1 print:px-1.5 print:py-0.5' : 'px-3 py-2'

  return (
    <div className={`overflow-x-auto panel ${compact ? 'print:overflow-visible' : ''}`}>
      <table className={`w-full whitespace-nowrap ${compact ? 'text-xs print:text-[8px]' : 'text-sm'}`}>
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            <th className={`sticky left-0 z-10 bg-surface ${firstColPad}`}>Giocatore</th>
            {columns.map((col) => (
              <th key={col.key} className={`${cellPad} text-right`}>
                {col.label}
                {col.unit && <span className="ml-1 normal-case text-ink-muted">({col.unit})</span>}
              </th>
            ))}
          </tr>
          <tr className="border-b border-border bg-page/60 text-xs font-semibold text-ink">
            <td className={`sticky left-0 z-10 bg-page/60 ${firstColPad}`}>Mediana squadra</td>
            {medians.map((m, i) => (
              <td key={columns[i].key} className={`${cellPad} text-right tabular-nums`}>
                {m === null ? '—' : fmt(columns[i], m)}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.label}>
              {groups.length > 1 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="bg-page/40 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted"
                  >
                    {group.label}
                  </td>
                </tr>
              )}
              {group.rows.map((row) => (
                <tr key={getRowKey(row)} className="border-b border-border last:border-0">
                  <td className={`sticky left-0 z-10 bg-surface font-medium text-ink ${firstColPad}`}>
                    {getRowLabel(row)}
                  </td>
                  {columns.map((col, i) => {
                    const value = col.getValue(row)
                    const columnMedian = medians[i]
                    const band = value !== null && columnMedian !== null ? heatBand(value, columnMedian) : 'neutral'
                    const bg = HEAT_BAND_VAR[band]
                    return (
                      <td
                        key={col.key}
                        className={`text-right tabular-nums text-ink ${cellPad}`}
                        style={bg ? { backgroundColor: bg } : undefined}
                      >
                        {value === null ? '—' : fmt(col, value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
