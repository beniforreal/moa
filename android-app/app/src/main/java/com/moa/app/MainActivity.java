package com.moa.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1001;
    private WebView webView;
    private String pushToken = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                dispatchPushToken();
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(), "MoaAndroid");

        pushToken = getSharedPreferences("moa", MODE_PRIVATE).getString("fcm_token", "");
        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) return;
            pushToken = task.getResult();
            getSharedPreferences("moa", MODE_PRIVATE).edit().putString("fcm_token", pushToken).apply();
            dispatchPushToken();
        });

        requestPushPermission();
        webView.loadUrl(BuildConfig.MOA_APP_URL);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel("moa_updates", "MOA 알림", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("새 댓글, 문의 및 운영 알림");
            manager.createNotificationChannel(channel);
        }
    }

    private void requestPushPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
        }
    }

    private void dispatchPushToken() {
        if (webView == null || pushToken == null || pushToken.isEmpty()) return;
        final String js = "window.dispatchEvent(new CustomEvent('moa-push-token',{detail:{token:" +
                JSONObject.quote(pushToken) + "}}));";
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public String getPushToken() {
            return pushToken == null ? "" : pushToken;
        }

        @JavascriptInterface
        public void requestPushPermission() {
            runOnUiThread(MainActivity.this::requestPushPermission);
        }
    }
}
