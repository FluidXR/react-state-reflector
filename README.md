# react-state-reflector

**Bi-directional shared state between React (in WebViews) and native Android.**  
This monorepo provides a React hook and an Android bridge class that synchronize state transparently between JavaScript and Java using a shared messaging protocol.

## ✨ Features

- 🔁 Two-way state sync between React and Android WebView
- 🧠 Automatic state synchronization on updates
- 📦 `useSharedState` hook in React with familiar useState API
- 📲 Android bridge class for receiving/sending shared state
- 🔍 Optional debug logging for development

---

## 📦 Monorepo Structure

```
react-state-reflector/
├── packages/
│   ├── react/       # React library (useSharedState)
│   └── android/     # Java library (StateReflectorBridge)
```

---

## 🚀 Installation

### JavaScript (React)
```bash
npm install react-state-reflector
```

### Android (Java)

Copy the `StateReflectorBridge.java` into your project:
```java
import so.fluid.reactstatereflector.StateReflectorBridge;
```

---

## 🔧 Usage

### React

```tsx
import { useSharedState } from "react-state-reflector";

function SettingsPanel() {
  // Use with a string key and initial value
  const [prefs, setPrefs] = useSharedState("prefs", {
    theme: "dark",
    notifications: true,
  });

  // Or use with just an initial value (auto-generates key)
  const [count, setCount] = useSharedState(0);

  return (
    <div>
      <label>
        Theme:
        <input
          type="checkbox"
          checked={prefs.theme === "dark"}
          onChange={(e) => setPrefs(prev => ({
            ...prev,
            theme: e.target.checked ? "dark" : "light"
          }))}
        />
      </label>
      <label>
        Notifications:
        <input
          type="checkbox"
          checked={prefs.notifications}
          onChange={(e) => setPrefs(prev => ({
            ...prev,
            notifications: e.target.checked
          }))}
        />
      </label>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
}
```

---

### Android (Java)

```java
StateReflectorBridge bridge = new StateReflectorBridge(myWebView);
// ⚠️ IMPORTANT: The interface name MUST be exactly "StateReflectorBridge"
myWebView.addJavascriptInterface(bridge, "StateReflectorBridge");

// Listen for JS updates
bridge.setOnStateUpdateListener((key, value) -> {
    Log.d("Reflector", "JS updated: " + key + " = " + value);
});
```

Send native → JS update:
```java
JSONObject prefs = new JSONObject().put("theme", "light");
bridge.sendStateToJS("prefs", prefs);
```

---

## 📦 API

### `useSharedState<T>(keyOrInitial: string | T, maybeInitial?: T)`

Returns a tuple `[state, setState]` similar to React's `useState`:

- If first argument is a string, it's used as the key and second argument is the initial value
- If first argument is not a string, it's used as the initial value and a UUID is generated as the key
- State updates are automatically synchronized with Android
- Supports both direct value updates and functional updates

### `StateReflectorBridge` (Android)

- `postMessage(String json)` — called from JS to send updates
- `sendStateToJS(String key, Object value)` — push update to JS
- `setOnStateUpdateListener(BiConsumer<String, Object>)` — react to JS state updates

### Debug Mode

The library includes a debug mode that can be enabled by setting `DEBUG = true` in the code. When enabled, it logs all state updates to the console.

---

## 📜 License

MIT © Fluid Immersive, Inc.