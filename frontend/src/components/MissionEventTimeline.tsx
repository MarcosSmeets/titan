import { useEffect, useRef } from 'react';
import type { StageEvent } from '../types';

interface MissionEventTimelineProps {
  events: StageEvent[];
  currentTime: number;
  isLive?: boolean;
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function eventColor(description: string): string {
  const d = description.toLowerCase();
  if (d.includes('separation') || d.includes('staging')) return '#ffaa00';
  if (d.includes('orbit') || d.includes('circulariz')) return '#22aa44';
  return '#4488ff';
}

export default function MissionEventTimeline({ events, currentTime, isLive }: MissionEventTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, isLive]);

  if (events.length === 0) {
    return (
      <div style={{ fontSize: '10px', color: '#334', letterSpacing: '1px', padding: '4px 0' }}>
        NO EVENTS
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={{ maxHeight: '180px', overflowY: 'auto', position: 'relative' }}>
      {/* Vertical line */}
      <div style={{
        position: 'absolute', left: '7px', top: '4px', bottom: '4px',
        width: '2px', background: '#1a1a2e',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '0' }}>
        {events.map((e, i) => {
          const color = eventColor(e.description);
          const isPast = e.time <= currentTime;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              opacity: isPast ? 1 : 0.4,
            }}>
              {/* Dot on the timeline */}
              <div style={{
                width: '16px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '2px',
              }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: isPast ? color : 'transparent',
                  border: `2px solid ${color}`,
                }} />
              </div>

              {/* Event content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: '10px', color: color, fontWeight: 600,
                }}>
                  T+{fmtTime(e.time)}
                </div>
                <div style={{ fontSize: '11px', color: '#bbc', marginTop: '1px' }}>
                  {e.description}
                </div>
              </div>

              {/* Stage badge */}
              <span style={{
                fontSize: '8px', letterSpacing: '1px', fontWeight: 700,
                padding: '1px 5px', borderRadius: '3px',
                background: `${color}15`, color, border: `1px solid ${color}30`,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                S{e.newStage + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
