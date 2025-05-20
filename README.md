# react-state-reflector

**Bi-directional shared state between React (in WebViews) and native Android.**  
This monorepo provides a React hook and an Android bridge class that synchronize state transparently between JavaScript and Java using a shared messaging protocol.

## ✨ Features

- 🔁 Two-way state sync between React and Android WebView
- 🧠 Deep change detection via Proxy — no manual setters needed
- 📦 `useSharedState` hook in React auto-sends updates
- 📲 Android bridge class for receiving/sending shared state

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

Option 1: Copy the `StateReflectorBridge.java` into your project:
```java
import com.example.statereflector.StateReflectorBridge;
```

Option 2: Use JitPack/Maven (coming soon)

---

## 🔧 Usage

### React

```tsx
import { useSharedState } from "react-state-reflector";

function SettingsPanel() {
  const [prefs] = useSharedState("prefs", {
    theme: "dark",
    notifications: true,
  });

  return (
    <div>
      <label>
        Theme:
        <input
          type="checkbox"
          checked={prefs.theme === "dark"}
          onChange={(e) => (prefs.theme = e.target.checked ? "dark" : "light")}
        />
      </label>
      <label>
        Notifications:
        <input
          type="checkbox"
          checked={prefs.notifications}
          onChange={(e) => (prefs.notifications = e.target.checked)}
        />
      </label>
    </div>
  );
}
```

---

### Android (Java)

```java
StateReflectorBridge bridge = new StateReflectorBridge(myWebView);
myWebView.addJavascriptInterface(bridge, "AndroidBridge");

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

### `useSharedState(key, initialValue)`

- Deep proxy-wrapped object
- Syncs to native on mutation
- Receives updates from native via `postMessage`

### `StateReflectorBridge` (Android)

- `postMessage(String json)` — called from JS
- `sendStateToJS(String key, Object value)` — push update to JS
- `setOnStateUpdateListener(BiConsumer<String, Object>)` — react to JS state

---

## 📜 License

MIT © Fluid Immersive, Inc.

