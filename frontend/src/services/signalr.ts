import * as signalR from '@microsoft/signalr';
import type { TelemetryPoint, SimulationRequest, StageEvent } from '../types';

let connection: signalR.HubConnection | null = null;

export function getConnection(): signalR.HubConnection {
  if (!connection) {
    connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/telemetry')
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();
  }
  return connection;
}

export async function runStreamingSimulation(
  request: SimulationRequest,
  callbacks: {
    onStart: (info: { rocketName: string; targetAltitude: number; duration: number }) => void;
    onTelemetry: (point: TelemetryPoint) => void;
    onStageEvent: (event: StageEvent) => void;
    onComplete: (result: { orbitAchieved: boolean; finalTime: number }) => void;
    onError: (error: string) => void;
  }
): Promise<void> {
  const conn = getConnection();

  // Clear previous handlers
  conn.off('OnSimulationStart');
  conn.off('OnTelemetryUpdate');
  conn.off('OnStageEvent');
  conn.off('OnSimulationComplete');

  conn.on('OnSimulationStart', callbacks.onStart);
  conn.on('OnTelemetryUpdate', callbacks.onTelemetry);
  conn.on('OnStageEvent', callbacks.onStageEvent);
  conn.on('OnSimulationComplete', callbacks.onComplete);

  try {
    if (conn.state === signalR.HubConnectionState.Disconnected) {
      await conn.start();
    }
    await conn.invoke('RunSimulation', request);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err.message : 'Connection failed');
  }
}

export async function stopConnection(): Promise<void> {
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    await connection.stop();
  }
}
