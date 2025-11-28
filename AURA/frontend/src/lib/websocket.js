const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function getWebSocketUrl(path) {
  const baseUrl = API_BASE_URL.replace(/^https?/, (match) => 
    match === 'https' ? 'wss' : 'ws'
  );
  return `${baseUrl}${path}`;
}

export function createWebSocketConnection(path, options = {}) {
  const { onOpen, onClose, onError, onMessage, reconnect = true } = options;

  let ws = null;
  let reconnectTimer = null;
  let isManualClose = false;

  const connect = () => {
    const url = getWebSocketUrl(path);
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const wsUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = (event) => {
      if (onOpen) onOpen(event, ws);
    };

    ws.onclose = (event) => {
      if (onClose) onClose(event, ws);
      if (!isManualClose && reconnect) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (error) => {
      if (onError) onError(error, ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data, event, ws);
      } catch {
        if (onMessage) onMessage(event.data, event, ws);
      }
    };
  };

  connect();

  return {
    send: (data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      }
      return false;
    },
    close: () => {
      isManualClose = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
  };
}
