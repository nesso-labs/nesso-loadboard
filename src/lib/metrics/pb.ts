import type { DrillSegment, Player } from '../../types/domain'

export type PbStatus = 'ok' | 'unconfirmed' | 'implausible' | 'new_record' | 'vendor_mismatch'

export interface PbEvaluation {
  status: PbStatus
  message: string
}

/** Above this, a recorded top speed is almost certainly a GPS/sensor artifact, not a real sprint. */
export const PB_PLAUSIBILITY_CEILING_KMH = 36.5

/**
 * Our own recorded-max-speed reference is auto-updated whenever a session
 * beats it, but stays UNCONFIRMED (pbConfirmed=false) until a human checks
 * it in Roster & Positions — mirrors the "don't trust a number silently"
 * pattern: every %-of-personal-max reading that depends on this value should
 * be hidden/flagged while it's unconfirmed, not presented as if validated.
 */
export function evaluatePlayerPb(
  player: Player,
  sessionMaxSpeedKmh: number,
  maxVendorPctInSession?: number,
): PbEvaluation {
  const stored = player.personalMaxSpeedKmh
  if (stored === undefined || sessionMaxSpeedKmh > stored) {
    return {
      status: 'new_record',
      message:
        stored === undefined
          ? `Prima registrazione della velocità massima: ${sessionMaxSpeedKmh.toFixed(2)} km/h.`
          : `Nuovo record di velocità massima: ${sessionMaxSpeedKmh.toFixed(2)} km/h (precedente: ${stored.toFixed(2)} km/h).`,
    }
  }
  if (stored > PB_PLAUSIBILITY_CEILING_KMH) {
    return {
      status: 'implausible',
      message: `Riferimento di ${stored.toFixed(2)} km/h, sopra la soglia di plausibilità di ${PB_PLAUSIBILITY_CEILING_KMH} km/h: da verificare.`,
    }
  }
  if (!player.pbConfirmed) {
    if (maxVendorPctInSession !== undefined && maxVendorPctInSession > 100) {
      return {
        status: 'vendor_mismatch',
        message: `Il vendor segna ${maxVendorPctInSession.toFixed(0)}% della propria velocità massima di riferimento in questa sessione, pur restando sotto il riferimento confermato dell'app (${stored.toFixed(2)} km/h). I due riferimenti divergono: verificare quale sia corretto.`,
      }
    }
    return { status: 'unconfirmed', message: 'Riferimento di velocità massima non ancora confermato.' }
  }
  return { status: 'ok', message: 'Riferimento confermato.' }
}

/**
 * Informational cross-check only (not our source of truth): inverts the
 * CSV's own %MaxSpeed field to see what reference the VENDOR's system used.
 * Useful on the Data Quality page to spot vendor-side reference drift.
 */
export function impliedVendorPersonalBestKmh(segment: DrillSegment): number | null {
  if (segment.pctMaxSpeed <= 0) return null
  return segment.maxSpeedKmh / (segment.pctMaxSpeed / 100)
}
