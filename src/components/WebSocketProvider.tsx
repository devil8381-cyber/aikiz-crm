'use client'

import { useWebSocket } from '@/hooks/useWebSocket'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Wifi, WifiOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function LiveIndicator() {
  const { data: session } = useSession()
  const wsConnected = useAppStore(s => s.wsConnected)
  const onlineAgents = useAppStore(s => s.onlineAgents)

  if (!session) return null

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg border backdrop-blur-sm transition-all duration-300 ${
            wsConnected
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-700'
              : 'bg-red-50/90 border-red-200 text-red-600'
          }`}
        >
          <div className='relative'>
            {wsConnected ? (
              <Wifi className='w-3.5 h-3.5' />
            ) : (
              <WifiOff className='w-3.5 h-3.5' />
            )}
            <div
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
              }`}
            />
          </div>
          <div className='flex flex-col'>
            <span className='text-[10px] font-bold leading-none'>
              {wsConnected ? 'LIVE' : 'OFFLINE'}
            </span>
            {wsConnected && onlineAgents > 0 && (
              <span className='text-[9px] text-emerald-600/70 leading-none mt-0.5'>
                {onlineAgents} agent{onlineAgents !== 1 ? 's' : ''} online
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  useWebSocket()

  return (
    <>
      {children}
      <LiveIndicator />
    </>
  )
}
