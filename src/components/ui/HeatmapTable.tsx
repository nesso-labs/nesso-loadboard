import { Fragment } from 'react'
import { HEAT_BAND_VAR, heatBand, median } from '../../lib/metrics/heatmap'

export interface HeatmapColumn<T> {
  key: string
  label: string
  getValue: (row: T) => number
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
}

/**
 * Team-median header row + one row per player, grouped (e.g. by position),
 * with a diverging heatmap tint per cell relative to the column's team
 * median. The number is always printed — color is a secondary cue, never
 * the only signal (dataviz skill: never color alone).
 */
export function HeatmapTable<T>({ columns, groups, getRowLabel, getRowKey }: HeatmapTableProps<T>) {
  const allRows = groups.flatMap((g) => g.rows)
  const medians = columns.map((col) => median(allRows.map((r) => col.getValue(r))))

  const fmt = (col: HeatmapColumn<T>, value: number) => (col.format ? col.format(value) : value.toFixed(1))

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            <th className="sticky left-0 z-10 bg-surface px-4 py-2">Giocatore</th>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 text-right">
                {col.label}
                {col.unit && <span className="ml-1 normal-case text-ink-muted">({col.unit})</span>}
              </th>
            ))}
          </tr>
          <tr className="border-b border-border bg-page/60 text-xs font-semibold text-ink">
            <td className="sticky left-0 z-10 bg-page/60 px-4 py-2">Mediana squadra</td>
            {medians.map((m, i) => (
              <td key={columns[i].key} className="px-3 py-2 text-right tabular-nums">
                {fmt(columns[i], m)}
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
                  <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium text-ink">{getRowLabel(row)}</td>
                  {columns.map((col, i) => {
                    const value = col.getValue(row)
                    const band = heatBand(value, medians[i])
                    const bg = HEAT_BAND_VAR[band]
                    return (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-right tabular-nums text-ink"
                        style={bg ? { backgroundColor: bg } : undefined}
                      >
                        {fmt(col, value)}
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
