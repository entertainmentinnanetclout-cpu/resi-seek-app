package org.reskonnect.app;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class RendererRecoveryTest {
    @Test
    public void rendererCrashWritesRecoveryMarkerAndKeepsActivityRecoverable() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferences prefs = context.getSharedPreferences("rk_runtime_stability", Context.MODE_PRIVATE);
        prefs.edit().clear().commit();

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertNotNull(activity.getBridge());
                assertNotNull(activity.getBridge().getWebView());
                // Android documents chrome://crash as a way to test renderer termination.
                activity.getBridge().getWebView().loadUrl("chrome://crash");
            });

            long deadline = SystemClock.elapsedRealtime() + 12_000L;
            long safeUntil = 0L;
            while (SystemClock.elapsedRealtime() < deadline) {
                safeUntil = prefs.getLong("graphics_safe_until", 0L);
                if (safeUntil > System.currentTimeMillis()) break;
                SystemClock.sleep(200L);
            }
            assertTrue("renderer recovery safe-mode marker was not written", safeUntil > System.currentTimeMillis());

            // ActivityScenario follows Activity recreation; a fresh bridge/WebView must exist.
            scenario.onActivity(activity -> {
                assertNotNull(activity.getBridge());
                assertNotNull(activity.getBridge().getWebView());
            });
        }
    }
}
