import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

declare global {
  interface Window {
    StateReflectorBridge?: {
      postMessage?: (message: string) => void;
    };
  }
}

// Type guard for proxy objects
function isProxy(obj: any): obj is { __isProxy: boolean } {
  return obj && typeof obj === 'object' && '__isProxy' in obj;
}

/**
 * Registry of all shared state instances (key → setState function)
 */
const sharedStateRegistry = new Map<string, { set: (v: any) => void }>();

/**
 * Debug mode flag - enabled when StateReflectorBridge is not available
 */
const isDebugMode = true;

/**
 * Debug logging utility
 */
function debugLog(message: string, data?: any) {
  if (isDebugMode) {
    console.log(`[StateReflector Debug] ${message}`, data ? data : '');
  }
}

/**
 * Sends a shared state update to the Android bridge
 */
function sendToAndroidSharedState(key: string, value: any) {
  try {
    const message = {
      type: "SHARED_STATE_UPDATE",
      key,
      value,
    };
    
    debugLog(`State Update for key "${key}":`, {
      value,
      timestamp: new Date().toISOString()
    });

    if (!isDebugMode) {
      window.StateReflectorBridge?.postMessage?.(JSON.stringify(message));
    }
  } catch (err) {
    console.error("Failed to send shared state to Android:", err);
  }
}

/**
 * Updates an object with new values while maintaining reactivity
 */
function updateReactiveObject<T extends object>(target: T, newValue: T) {
  Object.keys(newValue).forEach(key => {
    const value = (newValue as any)[key];
    if (typeof value === 'object' && value !== null) {
      if (!(target as any)[key] || !(target as any)[key].__isProxy) {
        (target as any)[key] = createReactiveObject(value, () => {
          sendToAndroidSharedState('', target);
        });
      } else {
        updateReactiveObject((target as any)[key], value);
      }
    } else {
      (target as any)[key] = value;
    }
  });
}

/**
 * Creates a deep proxy for an object that tracks any mutation
 */
function createReactiveObject<T extends object>(
  obj: T,
  onChange: () => void
): T {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      const value = target[prop];
      if (typeof value === "object" && value !== null && !value.__isProxy) {
        target[prop] = createReactiveObject(value, onChange);
      }
      return target[prop];
    },
    set(target, prop, value) {
      if (target[prop] !== value) {
        if (typeof value === 'object' && value !== null) {
          if (!target[prop] || !target[prop].__isProxy) {
            target[prop] = createReactiveObject(value, onChange);
          } else {
            updateReactiveObject(target[prop], value);
          }
        } else {
          target[prop] = value;
        }
        onChange();
      }
      return true;
    },
    deleteProperty(target, prop) {
      if (prop in target) {
        delete target[prop];
        onChange();
      }
      return true;
    }
  };

  const proxy = new Proxy(obj, handler);
  Object.defineProperty(proxy, "__isProxy", {
    value: true,
    enumerable: false,
  });

  return proxy;
}

/**
 * React hook for shared state synced with Android WebView
 */
export function useSharedState<T extends object>(
  keyOrInitial: string | T,
  maybeInitial?: T
): [T, (v: T) => void] {
  const key = typeof keyOrInitial === "string" ? keyOrInitial : uuidv4();
  const initial = typeof keyOrInitial === "string" ? maybeInitial! : keyOrInitial;
  const keyRef = useRef(key);
  const initialRef = useRef(initial);

  const [, forceRender] = useState(0);
  const proxyRef = useRef<T>(initial);

  const triggerUpdate = () => {
    const current = proxyRef.current!;
    sendToAndroidSharedState(keyRef.current, current);
    forceRender((v) => v + 1);
  };

  useEffect(() => {
    if (!isProxy(proxyRef.current)) {
      proxyRef.current = createReactiveObject({ ...initialRef.current }, triggerUpdate);
    }

    sharedStateRegistry.set(keyRef.current, {
      set: (newValue) => {
        const oldValue = proxyRef.current;
        updateReactiveObject(proxyRef.current, newValue);
        // Only trigger update if the value actually changed
        if (JSON.stringify(oldValue) !== JSON.stringify(proxyRef.current)) {
          triggerUpdate();
        }
      },
    });

    return () => {
      sharedStateRegistry.delete(keyRef.current);
    };
  }, []); // Empty dependency array since we're using refs

  return [proxyRef.current!, (v: T) => {
    sharedStateRegistry.get(keyRef.current)?.set(v);
  }];
}

/**
 * One-time global bridge listener (auto-installs)
 */
function installBridgeListener() {
  if ((window as any).__sharedStateBridgeInstalled) return;
  (window as any).__sharedStateBridgeInstalled = true;

  window.addEventListener("message", (event) => {
    try {
      const { type, key, value } = JSON.parse(event.data);
      if (type === "SHARED_STATE_UPDATE_FROM_NATIVE") {
        const entry = sharedStateRegistry.get(key);
        if (entry) {
          entry.set(value);
        }
      }
    } catch (err) {
      // Ignore malformed messages
    }
  });
}

installBridgeListener();