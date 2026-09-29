package org.reskonnect.app;

import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ResKonnectMain";
    private static final String PREFS = "rk_native_runtime";
    private static final String KEY_PENDING = "renderer_recovery_pending";
    private static final String KEY_DID_CRASH = "renderer_did_crash";
    private static final String KEY_PRIORITY = "renderer_priority";
    private static final String KEY_ROUTE = "renderer_route";
    private static final String KEY_TIME = "renderer_time";
    private static final String KEY_COUNT = "renderer_recent_count";
    private static final String KEY_LAST = "renderer_last_time";
    private static final long REPEAT_WINDOW_MS = 120_000L;

    private boolean recoveringRenderer = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (recoveringRenderer) return true;
                recoveringRenderer = true;

                final long now = System.currentTimeMillis();
                final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
                final long previous = prefs.getLong(KEY_LAST, 0L);
                final int recentCount = (previous > 0 && now - previous <= REPEAT_WINDOW_MS)
                    ? prefs.getInt(KEY_COUNT, 0) + 1
                    : 1;

                String route = "/";
                try {
                    final String currentUrl = view.getUrl();
                    if (currentUrl != null) {
                        final String path = Uri.parse(currentUrl).getPath();
                        if (path != null && !path.isEmpty()) route = path;
                    }
                } catch (Exception ignored) {}

                prefs.edit()
                    .putBoolean(KEY_PENDING, true)
                    .putBoolean(KEY_DID_CRASH, detail.didCrash())
                    .putInt(KEY_PRIORITY, detail.rendererPriorityAtExit())
                    .putString(KEY_ROUTE, route)
                    .putLong(KEY_TIME, now)
                    .putLong(KEY_LAST, now)
                    .putInt(KEY_COUNT, recentCount)
                    .apply();

                Log.e(TAG, "WebView renderer exited; recovering activity. didCrash="
                    + detail.didCrash() + " priority=" + detail.rendererPriorityAtExit()
                    + " route=" + route + " recentCount=" + recentCount);

                try {
                    // Android explicitly requires a renderer-lost WebView to be
                    // detached, destroyed and never reused. Tear down Capacitor's
                    // bridge/plugin lifecycle before dropping the reference so the
                    // old Activity cannot leak plugin or handler-thread state.
                    if (bridge != null) {
                        try {
                            bridge.onDestroy();
                        } catch (Exception bridgeCleanupError) {
                            Log.w(TAG, "Capacitor bridge cleanup was incomplete", bridgeCleanupError);
                        }
                    }
                    final ViewParent parent = view.getParent();
                    if (parent instanceof ViewGroup) ((ViewGroup) parent).removeView(view);
                    view.destroy();
                    bridge = null;
                } catch (Exception cleanupError) {
                    Log.w(TAG, "Renderer cleanup was incomplete", cleanupError);
                }

                new Handler(Looper.getMainLooper()).post(MainActivity.this::recreate);
                return true;
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                final SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
                if (!prefs.getBoolean(KEY_PENDING, false)) return;

                final boolean didCrash = prefs.getBoolean(KEY_DID_CRASH, false);
                final int priority = prefs.getInt(KEY_PRIORITY, -1);
                final int recentCount = prefs.getInt(KEY_COUNT, 1);
                final long time = prefs.getLong(KEY_TIME, 0L);
                final String route = prefs.getString(KEY_ROUTE, "/");
                final boolean safeGraphics = recentCount >= 2;

                final String safeRoute = route == null ? "/" : route.replace("\\", "\\\\").replace("'", "\\'");
                final String script =
                    "(function(){try{" +
                    (safeGraphics ? "localStorage.setItem('rk_native_safe_graphics_v1','1');" : "") +
                    "localStorage.setItem('rk_native_renderer_recovery_v1',JSON.stringify({" +
                    "didCrash:" + didCrash + "," +
                    "priority:" + priority + "," +
                    "recentCount:" + recentCount + "," +
                    "time:" + time + "," +
                    "route:'" + safeRoute + "'" +
                    "}));" +
                    "window.dispatchEvent(new CustomEvent('rk-native-renderer-recovered',{detail:{" +
                    "didCrash:" + didCrash + "," +
                    "priority:" + priority + "," +
                    "recentCount:" + recentCount + "," +
                    "time:" + time + "," +
                    "route:'" + safeRoute + "'" +
                    "}}));}catch(e){}})();";

                try {
                    view.evaluateJavascript(script, null);
                    prefs.edit().putBoolean(KEY_PENDING, false).apply();
                    recoveringRenderer = false;
                } catch (Exception error) {
                    Log.w(TAG, "Could not publish renderer recovery event", error);
                }
            }
        });

        super.onCreate(savedInstanceState);
    }
}
