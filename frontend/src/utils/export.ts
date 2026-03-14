import type { TelemetryPoint, StageEvent } from '../types';

interface ExportOptions {
  rocketName: string;
  telemetry: TelemetryPoint[];
  events?: StageEvent[];
}

const CSV_COLUMNS = [
  'time', 'altitude', 'velocity', 'x', 'y', 'z', 'vx', 'vy', 'vz',
  'apoapsis', 'periapsis', 'eccentricity', 'semiMajorAxis', 'inclination',
  'raan', 'argumentOfPeriapsis', 'trueAnomaly', 'stageIndex',
  'dynamicPressure', 'machNumber',
  'attitudeW', 'attitudeX', 'attitudeY', 'attitudeZ',
  'angularVelocityX', 'angularVelocityY', 'angularVelocityZ',
] as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

export function exportCSV({ rocketName, telemetry }: ExportOptions) {
  const header = CSV_COLUMNS.join(',');
  const rows = telemetry.map(t =>
    CSV_COLUMNS.map(col => {
      const val = t[col as keyof TelemetryPoint];
      return val ?? '';
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `titan_${sanitizeFilename(rocketName)}_${Date.now()}.csv`;
  downloadBlob(blob, filename);
}

export function exportJSON({ rocketName, telemetry, events }: ExportOptions) {
  const data = {
    rocketName,
    exportedAt: new Date().toISOString(),
    telemetryCount: telemetry.length,
    eventsCount: events?.length ?? 0,
    telemetry,
    events: events ?? [],
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const filename = `titan_${sanitizeFilename(rocketName)}_${Date.now()}.json`;
  downloadBlob(blob, filename);
}
