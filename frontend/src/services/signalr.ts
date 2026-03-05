import * as signalR from '@microsoft/signalr';
import type { TelemetryPoint, SimulationRequest } from '../types';

export function createTelemetryConnection() {
  return new signalR.HubConnectionBuilder()
    .withUrl('/hubs/telemetry')
    .withAutomaticReconnect()
    .build();
}

export async function startSimulationStream(
  connection: signalR.HubConnection,
  request: SimulationRequest,
  callbacks: {
    onTelemetry: (point: TelemetryPoint) => void;
    onStageEvent: (event: { time: number; previousStage: number; newStage: number }) => void;
    onComplete: (result: { orbitAchieved: boolean; finalTime: number }) => void;
  }
) {
  connection.on('OnTelemetryUpdate', callbacks.onTelemetry);
  connection.on('OnStageEvent', callbacks.onStageEvent);
  connection.on('OnSimulationComplete', callbacks.onComplete);

  if (connection.state === signalR.HubConnectionState.Disconnected) {
    await connection.start();
  }

  await connection.invoke('RunSimulation', request);
}
