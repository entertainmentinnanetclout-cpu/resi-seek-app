package org.reskonnect.app;

import android.content.ComponentCallbacks2;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import org.json.JSONObject;

/**
 * ResKonnect Android host with explicit WebView renderer recovery.
 * A renderer that has exited must never be reused.
 */
public class MainActivity extends BridgeActivity {
    private static final String PREFS = "rk_runtime_stability";
    private static final String KEY_PENDING_EVENT = "pending_runtime_event";
    private static final String KEY_GRAPHICS_SAFE_UNTIL = "graphics_safe_until";
    private static final long GRAPHICS_SAFE_MODE_MS = 24L * 60L * 60L * 1000L;

    private WebView activeWebView;
    private boolean rendererRecoveryScheduled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                activeWebView = webView;
                rendererRecoveryScheduled = false;
                deliverPendingRuntimeState(webView);
            }

            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                if (rendererRecoveryScheduled) return true;
                rendererRecoveryScheduled = true;

                final long now = System.currentTimeMillis();
                final long safeUntil = now + GRAPHICS_SAFE_MODE_MS;
                final JSONObject event = new JSONObject();
                try {
                    event.put("event_type", "renderer_gone");
                    event.put("did_crash", detail != null && detail.didCrash());
                    event.put("renderer_priority", detail != null ? detail.rendererPriorityAtExit() : -1);
                    event.put("manufacturer", Build.MANUFACTURER);
                    event.put("model", Build.MODEL);
                    event.put("sdk_int", Build.VERSION.SDK_INT);
                    event.put("app_version", appVersion());
                    event.put("safe_mode_until", safeUntil);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        PackageInfo currentWebView = WebView.getCurrentWebViewPackage();
                        if (currentWebView != null) {
                            event.put("webview_package", currentWebView.packageName);
                            event.put("webview_version", currentWebView.versionName);
                        }
                    }
                } catch (Exception ignored) {
                    // Diagnostics must never become a second crash path.
                }

                getSharedPreferences(PREFS, MODE_PRIVATE)
                    .edit()
                    .putString(KEY_PENDING_EVENT, event.toString())
                    .putLong(KEY_GRAPHICS_SAFE_UNTIL, safeUntil)
                    .apply();

                runOnUiThread(() -> {
                    try {
                        ViewParent parent = webView.getParent();
                        if (parent instanceof ViewGroup) {
                            ((ViewGroup) parent).removeView(webView);
                        }
                    } catch (Exception ignored) {}
                    try {
                        webView.stopLoading();
                        webView.destroy();
                    } catch (Exception ignored) {}
                    activeWebView = null;

                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        if (!isFinishing() && !isDestroyed()) recreate();
                    }, 250L);
                });
                return true;
            }
        });

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level < ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) return;
        final String script =
            "window.dispatchEvent(new CustomEvent(\'rk-native-memory-pressure\',{detail:{level:" +
            level + "}}));";
        runOnUiThread(() -> {
            try {
                if (activeWebView != null) activeWebView.evaluateJavascript(script, null);
            } catch (Exception ignored) {}
        });
    }

    @Override
    protected void onDestroy() {
        activeWebView = null;
        super.onDestroy();
    }

    private void deliverPendingRuntimeState(WebView webView) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String pending = prefs.getString(KEY_PENDING_EVENT, null);
        long safeUntil = prefs.getLong(KEY_GRAPHICS_SAFE_UNTIL, 0L);

        String pendingLiteral = pending == null ? "null" : JSONObject.quote(pending);
        String script =
            "(function(){try{" +
            "localStorage.setItem(\'rk_native_graphics_safe_mode_until_v1\',\'" + safeUntil + "\');" +
            "var raw=" + pendingLiteral + ";" +
            "if(raw){localStorage.setItem(\'rk_native_pending_runtime_event_v1\',raw);" +
            "window.dispatchEvent(new CustomEvent(\'rk-native-runtime-event\',{detail:JSON.parse(raw)}));}" +
            "}catch(e){}})();";

        try {
            webView.evaluateJavascript(script, ignored -> {
                if (pending != null) prefs.edit().remove(KEY_PENDING_EVENT).apply();
            });
        } catch (Exception ignored) {
            // Keep the SharedPreferences breadcrumb for the next successful boot.
        }
    }

    private String appVersion() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            return info.versionName == null ? "unknown" : info.versionName;
        } catch (Exception ignored) {
            return "unknown";
        }
    }
}
