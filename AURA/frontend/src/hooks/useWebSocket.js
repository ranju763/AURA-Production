import { useEffect, useRef, useState, useCallback } from 'react';
import { createWebSocketConnection } from '@/lib/websocket';

export function useWebSocket(path, options = {}) {
  const { onMessage, onOpen, onClose, onError, enabled = true } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!enabled || !path) return;

    const connection = createWebSocketConnection(path, {
      onOpen: (event, ws) => {
        setIsConnected(true);
        if (onOpen) onOpen(event, ws);
      },
      onClose: (event, ws) => {
        setIsConnected(false);
        if (onClose) onClose(event, ws);
      },
      onError: (error, ws) => {
        if (onError) onError(error, ws);
      },
      onMessage: (data, event, ws) => {
        setLastMessage(data);
        if (onMessage) onMessage(data, event, ws);
      },
    });

    wsRef.current = connection;

    return () => {
      connection.close();
    };
  }, [path, enabled, onMessage, onOpen, onClose, onError]);

  const sendMessage = useCallback((data) => {
    return wsRef.current?.send(data) ?? false;
  }, []);

  return { isConnected, lastMessage, sendMessage };
}
