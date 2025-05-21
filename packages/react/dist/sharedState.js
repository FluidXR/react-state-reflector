"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSharedState = useSharedState;
var react_1 = require("react");
var uuid_1 = require("uuid");
// Type guard for proxy objects
function isProxy(obj) {
    return obj && typeof obj === 'object' && '__isProxy' in obj;
}
/**
 * Registry of all shared state instances (key → setState function)
 */
var sharedStateRegistry = new Map();
/**
 * Debug mode flag - enabled when StateReflectorBridge is not available
 */
var isDebugMode = true;
/**
 * Debug logging utility
 */
function debugLog(message, data) {
    if (isDebugMode) {
        console.log("[StateReflector Debug] ".concat(message), data ? data : '');
    }
}
/**
 * Sends a shared state update to the Android bridge
 */
function sendToAndroidSharedState(key, value) {
    var _a, _b;
    try {
        var message = {
            type: "SHARED_STATE_UPDATE",
            key: key,
            value: value,
        };
        debugLog("State Update for key \"".concat(key, "\":"), {
            value: value,
            timestamp: new Date().toISOString()
        });
        if (!isDebugMode) {
            (_b = (_a = window.StateReflectorBridge) === null || _a === void 0 ? void 0 : _a.postMessage) === null || _b === void 0 ? void 0 : _b.call(_a, JSON.stringify(message));
        }
    }
    catch (err) {
        console.error("Failed to send shared state to Android:", err);
    }
}
/**
 * Updates an object with new values while maintaining reactivity
 */
function updateReactiveObject(target, newValue) {
    Object.keys(newValue).forEach(function (key) {
        var value = newValue[key];
        if (typeof value === 'object' && value !== null) {
            if (!target[key] || !target[key].__isProxy) {
                target[key] = createReactiveObject(value, function () {
                    sendToAndroidSharedState('', target);
                });
            }
            else {
                updateReactiveObject(target[key], value);
            }
        }
        else {
            target[key] = value;
        }
    });
}
/**
 * Creates a deep proxy for an object that tracks any mutation
 */
function createReactiveObject(obj, onChange) {
    var handler = {
        get: function (target, prop) {
            var value = target[prop];
            if (typeof value === "object" && value !== null && !value.__isProxy) {
                target[prop] = createReactiveObject(value, onChange);
            }
            return target[prop];
        },
        set: function (target, prop, value) {
            if (target[prop] !== value) {
                if (typeof value === 'object' && value !== null) {
                    if (!target[prop] || !target[prop].__isProxy) {
                        target[prop] = createReactiveObject(value, onChange);
                    }
                    else {
                        updateReactiveObject(target[prop], value);
                    }
                }
                else {
                    target[prop] = value;
                }
                onChange();
            }
            return true;
        },
        deleteProperty: function (target, prop) {
            if (prop in target) {
                delete target[prop];
                onChange();
            }
            return true;
        }
    };
    var proxy = new Proxy(obj, handler);
    Object.defineProperty(proxy, "__isProxy", {
        value: true,
        enumerable: false,
    });
    return proxy;
}
/**
 * React hook for shared state synced with Android WebView
 */
function useSharedState(keyOrInitial, maybeInitial) {
    var key = typeof keyOrInitial === "string" ? keyOrInitial : (0, uuid_1.v4)();
    var initial = typeof keyOrInitial === "string" ? maybeInitial : keyOrInitial;
    var keyRef = (0, react_1.useRef)(key);
    var initialRef = (0, react_1.useRef)(initial);
    var _a = (0, react_1.useState)(0), forceRender = _a[1];
    var proxyRef = (0, react_1.useRef)(initial);
    var triggerUpdate = function () {
        var current = proxyRef.current;
        sendToAndroidSharedState(keyRef.current, current);
        forceRender(function (v) { return v + 1; });
    };
    (0, react_1.useEffect)(function () {
        if (!isProxy(proxyRef.current)) {
            proxyRef.current = createReactiveObject(__assign({}, initialRef.current), triggerUpdate);
        }
        sharedStateRegistry.set(keyRef.current, {
            set: function (newValue) {
                var oldValue = proxyRef.current;
                updateReactiveObject(proxyRef.current, newValue);
                // Only trigger update if the value actually changed
                if (JSON.stringify(oldValue) !== JSON.stringify(proxyRef.current)) {
                    triggerUpdate();
                }
            },
        });
        return function () {
            sharedStateRegistry.delete(keyRef.current);
        };
    }, []); // Empty dependency array since we're using refs
    return [proxyRef.current, function (v) {
            var _a;
            (_a = sharedStateRegistry.get(keyRef.current)) === null || _a === void 0 ? void 0 : _a.set(v);
        }];
}
/**
 * One-time global bridge listener (auto-installs)
 */
function installBridgeListener() {
    if (window.__sharedStateBridgeInstalled)
        return;
    window.__sharedStateBridgeInstalled = true;
    window.addEventListener("message", function (event) {
        try {
            var _a = JSON.parse(event.data), type = _a.type, key = _a.key, value = _a.value;
            if (type === "SHARED_STATE_UPDATE_FROM_NATIVE") {
                var entry = sharedStateRegistry.get(key);
                if (entry) {
                    entry.set(value);
                }
            }
        }
        catch (err) {
            // Ignore malformed messages
        }
    });
}
installBridgeListener();
