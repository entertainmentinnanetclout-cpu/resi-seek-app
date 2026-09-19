package org.reskonnect.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private boolean rendererRecoveryScheduled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebView webView = bridge.getWebView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }

        webView.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                getSharedPreferences("reskonnect_runtime", MODE_PRIVATE)
                    .edit()
                    .putLong("last_renderer_loss_at", System.currentTimeMillis())
                    .putBoolean("last_renderer_did_crash", detail != null && detail.didCrash())
                    .apply();

                if (!rendererRecoveryScheduled && !isFinishing()) {
                    rendererRecoveryScheduled = true;
                    runOnUiThread(() -> recreate());
                }
                return true;
            }
        });
    }
}
