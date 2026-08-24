'use client'

import { useEffect, useReducer, useCallback } from 'react'
import { Globe } from 'lucide-react'

const US_TIMEZONES = [
  { label: 'EST', full: 'Eastern', timezone: 'America/New_York', color: 'from-blue-500 to-blue-600' },
  { label: 'CST', full: 'Central', timezone: 'America/Chicago', color: 'from-emerald-500 to-emerald-600' },
  { label: 'MST', full: 'Mountain', timezone: 'America/Denver', color: 'from-amber-500 to-amber-600' },
  { label: 'PST', full: 'Pacific', timezone: 'America/Los_Angeles', color: 'from-rose-500 to-rose-600' },
]

interface TzState {
  times: Record<string, string>
  dates: Record<string, string>
  pulse: boolean
}

interface TzAction {
  type: 'TICK'
  times: Record<string, string>
  dates: Record<string, string>
  pulse: boolean
}

function tzReducer(state: TzState, action: TzAction): TzState {
  return { times: action.times, dates: action.dates, pulse: action.pulse }
}

const initialState: TzState = { times: {}, dates: {}, pulse: false }

export default function TimezoneBar() {
  const [state, dispatch] = useReducer(tzReducer, initialState)

  const tick = useCallback(() => {
    const now = new Date()
    const t: Record<string, string> = {}
    const d: Record<string, string> = {}
    US_TIMEZONES.forEach((tz) => {
      try {
        t[tz.label] = now.toLocaleTimeString('en-US', { timeZone: tz.timezone, hour: '2-digit', minute: '2-digit', hour12: true })
        d[tz.label] = now.toLocaleDateString('en-US', { timeZone: tz.timezone, weekday: 'short', month: 'short', day: 'numeric' })
      } catch (err) {
        t[tz.label] = '--:--'
        d[tz.label] = ''
      }
    })
    dispatch({ type: 'TICK', times: t, dates: d, pulse: now.getSeconds() % 2 === 0 })
  }, [])

  useEffect(() => {
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [tick])

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2.5" style={{ background: 'linear-gradient(to right, #0f172a, #1e293b, #0f172a)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
      <Globe className="w-4 h-4 text-teal-400 shrink-0" />
      {US_TIMEZONES.map((tz) => (
        <div
          key={tz.label}
          className="relative flex flex-col items-center px-6 py-1.5 rounded-xl transition-all duration-300"
          style={{ background: state.pulse ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }}
        >
          <div
            className="absolute top-0 rounded-full"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              width: '24px',
              height: '2px',
              background: 'linear-gradient(to right, var(--tw-gradient-stops))',
            }}
          />
          <span className="text-[9px] font-bold text-teal-400 uppercase tracking-widest">{tz.full}</span>
          <span className="text-base font-mono font-bold text-white tabular-nums mt-0.5">
            {state.times[tz.label] || '--:--'}
          </span>
          <span className="text-[9px] text-slate-500 mt-0.5">{state.dates[tz.label]}</span>
        </div>
      ))}
    </div>
  )
}
