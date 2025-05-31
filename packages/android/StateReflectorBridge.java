package so.fluid.statereflector;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONObject;
import org.json.JSONException;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiConsumer;
import android.util.Log;

public class StateReflectorBridge {

    private final WebView webView;
    private final Map<String, Object> sharedState = new HashMap<>();
    private BiConsumer<String, Object> onStateUpdateFromJS;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public boolean isInitialized = false;

    public StateReflectorBridge(WebView webView) {
        this.webView = webView;
    }

    @JavascriptInterface
    public void postMessage(String json) {
        try {
            JSONObject message = new JSONObject(json);
            String type = message.optString("type");
            if ("SHARED_STATE_UPDATE".equals(type)) {
                String key = message.getString("key");
                Object value = message.get("value");

                // Save and notify
                sharedState.put(key, value);
                if (onStateUpdateFromJS != null) {
                    onStateUpdateFromJS.accept(key, value);
                }
            }
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    /**
     * Set callback to receive state updates from JS
     */
    public void setOnStateUpdateListener(BiConsumer<String, Object> listener) {
        this.onStateUpdateFromJS = listener;
    }

    /**
     * Get the latest known value for a given shared state key
     */
    public Object getSharedState(String key) {
        return sharedState.get(key);
    }

    /**
     * Push new state to JS side
     */
    public void sendStateToJS(String key, Object value) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("type", "SHARED_STATE_UPDATE_FROM_NATIVE");
            payload.put("key", key);
            payload.put("value", value);
            String script = "window.postMessage('" + payload.toString() + "', '*');";
            mainHandler.post(() -> {
                webView.evaluateJavascript(script, null);
            });
        } catch (JSONException e) {
            e.printStackTrace();
        }
    }

    /**
     * JS can call this to confirm the interface is connected
     */
    @JavascriptInterface
    public void ping() {
        Log.d("StateReflectorBridge", "JS Interface is connected (ping received)");
        isInitialized = true;
    }
}
