package org.reskonnect.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;

/** Native GPS bridge for the signed Play Store application. Never depends on WebView geolocation prompts. */
@CapacitorPlugin(name = "ResKonnectLocation", permissions = {
    @Permission(alias = "location", strings = {
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_FINE_LOCATION
    })
})
public class ResKonnectLocationPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void getPosition(PluginCall call) {
        if (!hasLocationPermission()) {
            requestPermissionForAlias("location", call, "onLocationPermission");
            return;
        }
        acquire(call);
    }

    @PermissionCallback
    private void onLocationPermission(PluginCall call) {
        if (hasLocationPermission()) acquire(call);
        else call.reject("Location permission was denied. Enable Location for ResKonnect in Android app settings.", "PERMISSION_DENIED");
    }

    private boolean hasLocationPermission() {
        Context context = getContext();
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject encode(Location location) {
        JSObject result = new JSObject();
        result.put("latitude", location.getLatitude());
        result.put("longitude", location.getLongitude());
        result.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 0);
        result.put("altitude", location.hasAltitude() ? location.getAltitude() : null);
        result.put("heading", location.hasBearing() ? location.getBearing() : null);
        result.put("speed", location.hasSpeed() ? location.getSpeed() : null);
        result.put("timestamp", location.getTime());
        return result;
    }

    private void acquire(PluginCall call) {
        if (!hasLocationPermission()) {
            call.reject("Location permission is not available", "PERMISSION_DENIED");
            return;
        }
        final LocationManager manager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (manager == null) {
            call.reject("Location service is unavailable", "UNAVAILABLE");
            return;
        }
        try {
            final boolean gps = manager.isProviderEnabled(LocationManager.GPS_PROVIDER);
            final boolean network = manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
            if (!gps && !network) {
                call.reject("Turn on your device Location service or choose a campus manually.", "LOCATION_OFF");
                return;
            }
            final String provider = gps && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                ? LocationManager.GPS_PROVIDER : (network ? LocationManager.NETWORK_PROVIDER : LocationManager.GPS_PROVIDER);
            final Location recent = manager.getLastKnownLocation(provider);
            if (recent != null && System.currentTimeMillis() - recent.getTime() < 90_000) {
                call.resolve(encode(recent));
                return;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                final android.os.CancellationSignal cancel = new android.os.CancellationSignal();
                final boolean[] completed = { false };
                final Runnable timeout = () -> {
                    if (completed[0]) return;
                    completed[0] = true;
                    cancel.cancel();
                    if (recent != null) call.resolve(encode(recent));
                    else call.reject("Location is taking too long. Select your campus to continue.", "TIMEOUT");
                };
                main.postDelayed(timeout, 11_000);
                manager.getCurrentLocation(provider, cancel, getContext().getMainExecutor(), location -> {
                    if (completed[0]) return;
                    completed[0] = true;
                    main.removeCallbacks(timeout);
                    if (location != null) call.resolve(encode(location));
                    else if (recent != null) call.resolve(encode(recent));
                    else call.reject("Could not determine your location. Choose your campus manually.", "UNAVAILABLE");
                });
            } else {
                final boolean[] completed = { false };
                final LocationListener listener = new LocationListener() {
                    @Override public void onLocationChanged(Location location) {
                        if (completed[0]) return;
                        completed[0] = true;
                        manager.removeUpdates(this);
                        call.resolve(encode(location));
                    }
                    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
                    @Override public void onProviderEnabled(String provider) { }
                    @Override public void onProviderDisabled(String provider) { }
                };
                main.postDelayed(() -> {
                    if (completed[0]) return;
                    completed[0] = true;
                    manager.removeUpdates(listener);
                    if (recent != null) call.resolve(encode(recent));
                    else call.reject("Location is taking too long. Select your campus to continue.", "TIMEOUT");
                }, 11_000);
                manager.requestLocationUpdates(provider, 0, 0, listener, Looper.getMainLooper());
            }
        } catch (SecurityException ex) {
            call.reject("Location permission was denied", "PERMISSION_DENIED");
        } catch (Exception ex) {
            call.reject("Location is temporarily unavailable. Select your campus to continue.", "UNAVAILABLE");
        }
    }
}
