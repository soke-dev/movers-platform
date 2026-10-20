import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const toast = useCallback((text, bad = false) => {
    clearTimeout(timer.current);
    setMsg({ text, bad });
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <Ctx.Provider value={toast}>
      {children}
      {msg && <div className={`toast${msg.bad ? ' bad' : ''}`} role="status">{msg.text}</div>}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
