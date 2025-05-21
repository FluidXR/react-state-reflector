declare global {
    interface Window {
        StateReflectorBridge?: {
            postMessage?: (message: string) => void;
        };
    }
}
/**
 * React hook for shared state synced with Android WebView
 */
export declare function useSharedState<T extends object>(keyOrInitial: string | T, maybeInitial?: T): [T, (v: T) => void];
