import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface DateRangePickerProps {
  /** ISO "YYYY-MM-DD", inclusive range — start and end may be the same day. */
  startDate: string
  endDate: string
  onChange: (startDate: string, endDate: string) => void
  /** ISO "YYYY-MM-DD" -> opponent's 3-letter code, shown under the day number on match days. */
  matchDayLabels?: Record<string, string>
}

const MONTH_LABEL = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const WEEKDAY_LABEL = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

function formatShort(date: Date): string {
  return `${date.getDate()} ${MONTH_LABEL[date.getMonth()]}`
}

function formatRangeLabel(startIso: string, endIso: string): string {
  const start = parseISO(startIso)
  const end = parseISO(endIso)
  if (isSameDay(start, end)) return `${formatShort(start)} ${start.getFullYear()}`
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = sameYear ? formatShort(start) : `${formatShort(start)} ${start.getFullYear()}`
  return `${startLabel} – ${formatShort(end)} ${end.getFullYear()}`
}

/**
 * Compact date-range trigger + popover calendar. Two clicks pick a range —
 * click a first day, hover to preview, click a second day to confirm and
 * close (order-independent: whichever day is earlier becomes the start).
 * Clicking the same day twice yields a one-day range.
 */
export function DateRangePicker({ startDate, endDate, onChange, matchDayLabels = {} }: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseISO(startDate)))
  const [pendingStart, setPendingStart] = useState<Date | null>(null)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)

  const start = parseISO(startDate)
  const end = parseISO(endDate)

  const openPicker = () => {
    // Always opens on today's month, regardless of which month the current selection falls in —
    // the selection is highlighted wherever the user navigates to, but the starting point is "now".
    setVisibleMonth(startOfMonth(new Date()))
    setPendingStart(null)
    setHoverDate(null)
    setOpen(true)
  }

  const closePicker = () => {
    setOpen(false)
    setPendingStart(null)
    setHoverDate(null)
  }

  const pickDay = (day: Date) => {
    if (!pendingStart) {
      setPendingStart(day)
      return
    }
    const [lo, hi] = pendingStart <= day ? [pendingStart, day] : [day, pendingStart]
    onChange(format(lo, 'yyyy-MM-dd'), format(hi, 'yyyy-MM-dd'))
    closePicker()
  }

  const gridStart = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // While a first click is pending, preview against the hovered day (falling back to the
  // clicked day alone on touch, where hover never fires) instead of the committed range.
  let previewStart = start
  let previewEnd = end
  if (pendingStart) {
    const other = hoverDate ?? pendingStart
    previewStart = pendingStart <= other ? pendingStart : other
    previewEnd = pendingStart <= other ? other : pendingStart
  }

  return (
    <div className="relative inline-block text-sm">
      <button
        type="button"
        onClick={() => (open ? closePicker() : openPicker())}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-ink hover:bg-ink/5"
      >
        <CalendarRange className="size-4 text-ink-secondary" />
        <span className="tabular-nums">{formatRangeLabel(startDate, endDate)}</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Chiudi selettore date"
            className="fixed inset-0 z-40 cursor-default"
            onClick={closePicker}
          />
          <div className="panel absolute left-0 top-full z-50 mt-2 w-80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
                className="rounded-md p-1 text-ink-secondary hover:bg-ink/5"
                aria-label="Mese precedente"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="font-display text-base font-medium text-ink">
                {MONTH_LABEL[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                className="rounded-md p-1 text-ink-secondary hover:bg-ink/5"
                aria-label="Mese successivo"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium uppercase text-ink-muted">
              {WEEKDAY_LABEL.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center text-sm">
              {days.map((day) => {
                const inMonth = isSameMonth(day, visibleMonth)
                const inRange = inMonth && isWithinInterval(day, { start: previewStart, end: previewEnd })
                const isEndpoint = inMonth && (isSameDay(day, previewStart) || isSameDay(day, previewEnd))
                const matchLabel = inMonth ? matchDayLabels[format(day, 'yyyy-MM-dd')] : undefined
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => pickDay(day)}
                    onMouseEnter={() => setHoverDate(day)}
                    disabled={!inMonth}
                    title={format(day, 'yyyy-MM-dd')}
                    className={`flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded tabular-nums ${
                      !inMonth
                        ? 'text-ink-muted/30'
                        : isEndpoint
                          ? 'bg-accent font-semibold text-accent-ink'
                          : inRange
                            ? 'bg-accent/15 text-ink'
                            : isToday(day)
                              ? 'font-semibold text-accent ring-1 ring-inset ring-accent/50'
                              : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <span>{day.getDate()}</span>
                    {matchLabel && (
                      <span className="text-[9px] font-semibold uppercase leading-none opacity-70">{matchLabel}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="mt-2 text-center text-xs text-ink-muted">
              {pendingStart ? 'Seleziona la data di fine' : 'Seleziona la data di inizio'}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
