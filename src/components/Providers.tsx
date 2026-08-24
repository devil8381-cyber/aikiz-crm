'use client'

import { SessionProvider } from 'next-auth/react'
import { WebSocketProvider } from './WebSocketProvider'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WebSocketProvider>
        {children}
      </WebSocketProvider>
    </SessionProvider>
  )
}
