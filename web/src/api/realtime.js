import { useEffect, useRef, useState } from "react";
import { WS_BASE } from "./client";

const normalizeMessage = (raw) => {
  try {
    return JSON.parse(raw.data);
  } catch {
    return null;
  }
};

export const useRealtimeSocket = (session, options = {}) => {
  const socketRef = useRef(null);
  const [connection, setConnection] = useState("idle");
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!session?.token) return undefined;

    const socket = new WebSocket(`${WS_BASE}/ws`);
    socketRef.current = socket;
    setConnection("connecting");

    socket.addEventListener("open", () => {
      setConnection("authenticating");
      socket.send(JSON.stringify({
        type: session.role === "admin" ? "auth:admin" : "auth:user",
        token: session.token
      }));
    });

    socket.addEventListener("message", (raw) => {
      const message = normalizeMessage(raw);
      if (!message) return;
      if (message.type === "socket:authenticated") {
        setConnection("connected");
      }
      setEvents((current) => [message, ...current].slice(0, 50));
      options.onMessage?.(message);
    });

    socket.addEventListener("close", () => {
      setConnection("closed");
    });

    socket.addEventListener("error", () => {
      setConnection("error");
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [session?.token, session?.role]);

  const send = (payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime socket is not connected");
    }
    socket.send(JSON.stringify(payload));
  };

  return { connection, events, send };
};
