import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

/* ------------------------------------------------------------------ */
/*  Android bridge helpers                                            */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    StateReflectorBridge?: { 
      postMessage?: (msg: string) => void;
      ping?: () => void;
    };
  }
}

const log = (msg: string, data?: any) => console.log(`[StateReflector] ${msg}`, data ?? "");

/** Send a state update to the Android side */
function sendToAndroid(key: string, value: unknown) {
  const payload = { type: "SHARED_STATE_UPDATE", key, value };
  window.StateReflectorBridge?.postMessage?.(JSON.stringify(payload));
  
}

/* ------------------------------------------------------------------ */
/*  Global registry: key → all React setState functions               */
/* ------------------------------------------------------------------ */

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
const registry = new Map<string, Set<Setter<any>>>();

function dispatchToAll<T>(key: string, action: React.SetStateAction<T>) {
  const setters = registry.get(key);
  if (!setters?.size) return;

  let lastValue: T | undefined;
  setters.forEach(set => {
    set((prev: T) => {
      lastValue = typeof action === "function" ? (action as any)(prev) : action;
      return lastValue as T;
    });
  });
  if (lastValue !== undefined) sendToAndroid(key, lastValue);
}

/* ------------------------------------------------------------------ */
/*  useSharedState – API identical to React.useState                  */
/* ------------------------------------------------------------------ */

export function useSharedState<T>(
  keyOrInitial: string | T,
  maybeInitial?: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Derive key + initial value
  const key = typeof keyOrInitial === "string" ? keyOrInitial : uuidv4();
  const initial =
    (typeof keyOrInitial === "string" ? maybeInitial : keyOrInitial) as T;

  const [state, setState] = useState<T>(initial);
  const keyRef = useRef(key); // stable between renders

  /* ---- Register / unregister this component's setter ---- */
  useEffect(() => {
    let entry = registry.get(keyRef.current);
    if (!entry) {
      entry = new Set();
      registry.set(keyRef.current, entry);
    }
    entry.add(setState);

    return () => {
      entry!.delete(setState);
      if (entry!.size === 0) registry.delete(keyRef.current);
    };
  }, []);

  /* ---- Public setter: broadcast to every subscriber ---- */
  const sharedSetter: React.Dispatch<React.SetStateAction<T>> = action => {
    dispatchToAll<T>(keyRef.current, action);
  };

  return [state, sharedSetter];
}

/* ------------------------------------------------------------------ */
/*  One-time listener for messages coming **from** native code        */
/* ------------------------------------------------------------------ */

(function installBridgeListener() {
  if ((window as any).__sharedStateBridgeInstalled) return;
  (window as any).__sharedStateBridgeInstalled = true;

  window.addEventListener("message", evt => {
    try {
      if (evt.data === 'PING') {
        log("← PING received from Android");
        window.StateReflectorBridge?.ping?.();
        return;
      }
      
      const { type, key, value } = JSON.parse(evt.data);
      if (type === "SHARED_STATE_UPDATE_FROM_NATIVE") {
        log("← from Android", { key, value });
        dispatchToAll(key, value);
      }
    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  window.StateReflectorBridge?.ping?.();
})();
