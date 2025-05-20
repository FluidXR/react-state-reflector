# react-state-reflector

**Bi-directional shared state between React and native Android.**  
This lightweight library enables React apps running inside Android WebViews to transparently sync shared state with the native layer.

## ✨ Features

- 🔁 Two-way state sync between React and Android
- 🧠 Deep change detection via proxy — no manual setters or diffing needed
- 💡 Works with plain React, no dependencies beyond `react`
- 📦 Simple hook-based API: `useSharedState`

## 🚀 Installation

```bash
npm install react-state-reflector
```

## 🔧 Usage

### In React

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

### In Android (Java)

```java
@JavascriptInterface
public void postMessage(String json) {
    JSONObject msg = new JSONObject(json);
    if ("SHARED_STATE_UPDATE".equals(msg.getString("type"))) {
        String key = msg.getString("key");
        Object value = msg.get("value");
        // Store value or trigger logic...
    }
}

// Later, send update to JS:
String script = "window.postMessage(" + new JSONObject()
    .put("type", "SHARED_STATE_UPDATE_FROM_NATIVE")
    .put("key", "prefs")
    .put("value", new JSONObject().put("theme", "light"))
    .toString() + ", '*');";
webView.evaluateJavascript(script, null);
```

## 📦 API

### `useSharedState(key, initialValue)`

Returns a deeply reactive object that automatically syncs across the JS/native boundary.

- Mutate fields directly: `prefs.theme = "light"`
- No need to call a setter unless replacing the whole object
- State is automatically mirrored to Android and back

## 🔐 TypeScript Support

Fully typed, with generics:

```ts
const [prefs] = useSharedState<Prefs>("prefs", {
  theme: "dark",
  notifications: true,
});
```

## 📜 License

MIT © [YourName or Organization]
