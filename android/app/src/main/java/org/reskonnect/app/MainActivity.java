package org.reskonnect.app;

import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private boolean rendererRecoveryScheduled = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final Bridge capacitorBridge = getBridge();
        final WebView webView = capacitorBridge.getWebView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }

        webView.setWebViewClient(new BridgeWebViewClient(capacitorBridge) {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                getSharedPreferences("reskonnect_runtime", MODE_PRIVATE)
                    .edit()
                    .putLong("last_renderer_loss_at", System.currentTimeMillis())
                    .putBoolean("last_renderer_did_crash", detail != null && detail.didCrash())
                    .apply();

                if (!rendererRecoveryScheduled && !isFinishing()) {
                    rendererRecoveryScheduled = true;
                    new Handler(Looper.getMainLooper()).post(() -> recreate());
                }
                return true;
            }
        });
    }
}
