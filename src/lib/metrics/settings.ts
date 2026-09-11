import type { AppSettings } from '../../types/domain'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app-settings',
  schemaVersion: 1,
  // ASSUMPTION: 14.4/19.8/25.2 km/h are the vendor's own zone 4/5/6 lower
  // bounds. Verified indirectly: CSV's own `HSR` field == zone5+zone6
  // distance exactly, across every sample row — so at minimum the zone5/6
  // boundary matches the vendor's HSR definition. Zone 4's boundary is a
  // best-guess industry-standard default, editable here.
  speedZonesKmh: {
    zone4MinKmh: 14.4,
    zone5MinKmh: 19.8,
    zone6MinKmh: 25.2,
  },
  useVendorZoneLabelsOnly: true,
  mechanicalWork: {
    includeZonesForMechWork: [4, 5, 6],
    accModerateZones: [4, 5, 6],
    accHighZones: [5, 6],
    decModerateZones: [4, 5, 6],
    decHighZones: [5, 6],
  },
  sprintDefinition: {
    entriesZonesForSprintCount: [6],
  },
  gameDrillKeywords: ['gs-', 'partita', 'match', 'game', 'gara'],
  rpeScale: {
    type: 'borg-cr10',
    min: 1,
    max: 10,
  },
  rollingWindowDays: 7,
  alertThresholds: {
    maxSpeedDeficitPct: 85,
    highMechWorkRelative: 0.25,
    highVolumeRelative: 0.25,
    highSRpeRelative: 0.25,
  },
}
