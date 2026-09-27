import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { io } from 'socket.io-client'
import { api } from '../api/api'

const socket = io({ autoConnect: false })

// Подписывает клиента на события комнаты; при любом изменении расписания
// помечает кэш броней устаревшим, и RTK Query перезапрашивает только его.
export function useRoomEvents(roomId: string | null) {
  const dispatch = useDispatch()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const refresh = () => dispatch(api.util.invalidateTags(['Booking']))
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('booking:created', refresh)
    socket.on('booking:cancelled', refresh)
    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('booking:created', refresh)
      socket.off('booking:cancelled', refresh)
      socket.disconnect()
    }
  }, [dispatch])

  useEffect(() => {
    if (!roomId) return
    const subscribe = () => socket.emit('room:subscribe', roomId)
    subscribe()
    socket.on('connect', subscribe)
    return () => {
      socket.off('connect', subscribe)
      socket.emit('room:unsubscribe', roomId)
    }
  }, [roomId])

  return connected
}
