import { useEffect, useRef } from 'react'
import { subscribeRealtime } from '../services/realtimeService.js'

function useRealtimeEvent(eventName, handler) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => subscribeRealtime(eventName, (payload) => handlerRef.current(payload)), [eventName])
}

export default useRealtimeEvent
