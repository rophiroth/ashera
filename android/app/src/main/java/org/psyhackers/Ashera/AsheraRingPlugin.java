package org.psyhackers.Ashera;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.io.IOException;
import java.util.UUID;

import nodomain.freeyourgadget.gadgetbridge.impl.GBDevice;
import nodomain.freeyourgadget.gadgetbridge.model.DeviceService;
import nodomain.freeyourgadget.gadgetbridge.model.DeviceType;
import nodomain.freeyourgadget.gadgetbridge.service.devices.yawell.ring.YawellRingDeviceSupport;
import nodomain.freeyourgadget.gadgetbridge.util.GB;
import nodomain.freeyourgadget.gadgetbridge.impl.GBDevice;
import nodomain.freeyourgadget.gadgetbridge.GBApplication;

@CapacitorPlugin(name = "AsheraRing", permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT }, alias = "ble")
})
public class AsheraRingPlugin extends Plugin {

    private static final String TAG = "AsheraRing";

    // The Authentic Gadgetbridge Support Class
    private YawellRingDeviceSupport deviceSupport;
    private GBDevice gbDevice;
    private boolean isInitialized = false;

    // Reflection Logic to Stub GBApplication (Existing logic kept for safety)
    private void initGadgetbridge() {
        if (isInitialized)
            return;
        try {
            Log.d(TAG, "Initializing Gadgetbridge Environment Stubs...");
            Context appCtx = getContext().getApplicationContext();

            // 2. Initialize GBApplication (Critical for SharedPrefs)
            Log.d("AsheraRing", "Initializing GBApplication stub...");
            Class<?> gbAppClass = Class.forName("nodomain.freeyourgadget.gadgetbridge.GBApplication");
            Constructor<?> gbAppConstructor = gbAppClass.getDeclaredConstructor();
            gbAppConstructor.setAccessible(true);
            Object gbAppInstance = gbAppConstructor.newInstance();

            // Attach Context to the GBApplication instance (so getSharedPreferences works)
            // attachBaseContext is protected in ContextWrapper
            Method attachBaseContext = android.content.ContextWrapper.class.getDeclaredMethod("attachBaseContext",
                    Context.class);
            attachBaseContext.setAccessible(true);
            attachBaseContext.invoke(gbAppInstance, appCtx);

            // Inject into static 'context' and 'app' fields to ensure singletons are set
            Field contextField = gbAppClass.getDeclaredField("context");
            contextField.setAccessible(true);
            contextField.set(null, gbAppInstance);

            try {
                Field appField = gbAppClass.getDeclaredField("app");
                appField.setAccessible(true);
                appField.set(null, gbAppInstance);
            } catch (NoSuchFieldException e) {
                Log.w("AsheraRing", "Field 'app' not found in GBApplication, skipping.");
            }

            // 2.5 Initialize GBPrefs (Critical for ActivityUser)
            android.content.SharedPreferences sharedPrefs = android.preference.PreferenceManager
                    .getDefaultSharedPreferences(appCtx);
            Class<?> gbPrefsClass = Class.forName("nodomain.freeyourgadget.gadgetbridge.util.GBPrefs");
            Constructor<?> gbPrefsConstructor = gbPrefsClass
                    .getDeclaredConstructor(android.content.SharedPreferences.class);
            gbPrefsConstructor.setAccessible(true);
            Object gbPrefsInstance = gbPrefsConstructor.newInstance(sharedPrefs);

            Field prefsField = gbAppClass.getDeclaredField("prefs");
            prefsField.setAccessible(true);
            prefsField.set(null, gbPrefsInstance);

            // Also set sharedPrefs field in GBApplication if exists
            try {
                Field sharedPrefsField = gbAppClass.getDeclaredField("sharedPrefs");
                sharedPrefsField.setAccessible(true);
                sharedPrefsField.set(null, sharedPrefs);
            } catch (NoSuchFieldException e) {
                // Ignore
            }

            // Verify Injection
            Method getPrefsMethod = gbAppClass.getDeclaredMethod("getPrefs");
            Object checkPrefs = getPrefsMethod.invoke(null);
            Log.d(TAG, "VERIFY: GBApplication.getPrefs() is: " + checkPrefs);

            // 3. Initialize LockHandler (Database Layer) for DB Access
            java.lang.reflect.Field lockField = nodomain.freeyourgadget.gadgetbridge.GBApplication.class
                    .getDeclaredField("lockHandler");
            lockField.setAccessible(true);

            if (lockField.get(null) == null) {
                nodomain.freeyourgadget.gadgetbridge.database.DBOpenHelper helper = new nodomain.freeyourgadget.gadgetbridge.database.DBOpenHelper(
                        appCtx, "Gadgetbridge", null);
                android.database.sqlite.SQLiteDatabase db = helper.getWritableDatabase();
                nodomain.freeyourgadget.gadgetbridge.entities.DaoMaster daoMaster = new nodomain.freeyourgadget.gadgetbridge.entities.DaoMaster(
                        db);

                Class<?> lockHandlerClass = Class
                        .forName("nodomain.freeyourgadget.gadgetbridge.LockHandler");
                java.lang.reflect.Constructor<?> ctor = lockHandlerClass.getDeclaredConstructor();
                ctor.setAccessible(true);
                Object lockHandlerInstance = ctor.newInstance();

                java.lang.reflect.Method initMethod = lockHandlerClass.getDeclaredMethod("init",
                        nodomain.freeyourgadget.gadgetbridge.entities.DaoMaster.class,
                        nodomain.freeyourgadget.gadgetbridge.entities.DaoMaster.OpenHelper.class);
                initMethod.setAccessible(true);
                initMethod.invoke(lockHandlerInstance, daoMaster, helper);

                lockField.set(null, lockHandlerInstance);
                Log.d(TAG, "Gadgetbridge DB Layer Initialized!");
            }

            // 2. Register Broadcast Receiver to capture Authentic Intents
            android.content.IntentFilter filter = new android.content.IntentFilter();
            filter.addAction(DeviceService.ACTION_REALTIME_SAMPLES);
            filter.addAction(GBDevice.ACTION_DEVICE_CHANGED);
            filter.addAction(GBApplication.ACTION_NEW_DATA); // Used for sync finish

            androidx.localbroadcastmanager.content.LocalBroadcastManager.getInstance(getContext())
                    .registerReceiver(gbReceiver, filter);

            isInitialized = true;

        } catch (Exception e) {
            Log.e(TAG, "Failed to init Gadgetbridge reflection", e);
        }
    }

    // Capture intents broadcast by YawellRingDeviceSupport/PacketHandler
    private final android.content.BroadcastReceiver gbReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();

            if (DeviceService.ACTION_REALTIME_SAMPLES.equals(action)) {
                Object sample = intent.getParcelableExtra(DeviceService.EXTRA_REALTIME_SAMPLE);

                if (sample instanceof nodomain.freeyourgadget.gadgetbridge.entities.ColmiHeartRateSample) {
                    nodomain.freeyourgadget.gadgetbridge.entities.ColmiHeartRateSample hr = (nodomain.freeyourgadget.gadgetbridge.entities.ColmiHeartRateSample) sample;
                    JSObject ret = new JSObject();
                    ret.put("heartRate", hr.getHeartRate());
                    notifyListeners("onData", ret);
                } else if (sample instanceof nodomain.freeyourgadget.gadgetbridge.entities.ColmiActivitySample) {
                    nodomain.freeyourgadget.gadgetbridge.entities.ColmiActivitySample act = (nodomain.freeyourgadget.gadgetbridge.entities.ColmiActivitySample) sample;
                    JSObject ret = new JSObject();
                    ret.put("steps", act.getSteps());
                    ret.put("calories", act.getCalories());
                    ret.put("distance", act.getDistance());
                    notifyListeners("onData", ret);
                }
            } else if (GBDevice.ACTION_DEVICE_CHANGED.equals(action)) {
                Object device = intent.getParcelableExtra(GBDevice.EXTRA_DEVICE);
                if (device instanceof GBDevice) {
                    GBDevice gbDevice = (GBDevice) device;
                    JSObject ret = new JSObject();
                    ret.put("state", gbDevice.getStateString(getContext()));
                    ret.put("batteryLevel", gbDevice.getBatteryLevel());
                    notifyListeners("onConnectionChange", ret);
                }
            } else if (GBApplication.ACTION_NEW_DATA.equals(action)) {
                // Sync Finished! Now we fetch from DB.
                Log.d(TAG, "Sync Finished (ACTION_NEW_DATA)! Fetching fresh data from DB...");
                fetchRecentDataFromDB();
            }
        }
    };

    private void fetchRecentDataFromDB() {
        try {
            Log.d(TAG, "Querying DB for recent samples...");

            // 1. Get DB Instance (using our reflective access or creating new helper)
            // We need to ensure we use the SAME DB connection or at least the same file.
            Context appCtx = getContext().getApplicationContext();
            nodomain.freeyourgadget.gadgetbridge.database.DBOpenHelper helper = new nodomain.freeyourgadget.gadgetbridge.database.DBOpenHelper(
                    appCtx, "Gadgetbridge", null);
            android.database.sqlite.SQLiteDatabase db = helper.getReadableDatabase();

            // 2. Find Device ID
            long deviceId = -1;
            try (android.database.Cursor cursor = db.rawQuery("SELECT _id FROM DEVICE WHERE ADDRESS = ?",
                    new String[] { gbDevice.getAddress() })) {
                if (cursor.moveToFirst()) {
                    deviceId = cursor.getLong(0);
                }
            }
            if (deviceId == -1) {
                Log.w(TAG, "Device not found in DB for address: " + gbDevice.getAddress());
                // Fallback: Try to find ANY device if address mismatch (debug only)
                try (android.database.Cursor cursor = db.rawQuery("SELECT _id FROM DEVICE LIMIT 1", null)) {
                    if (cursor.moveToFirst())
                        deviceId = cursor.getLong(0);
                }
            }

            Log.d(TAG, "Found Device ID in DB: " + deviceId);

            JSObject ret = new JSObject();
            com.getcapacitor.JSArray heartRates = new com.getcapacitor.JSArray();
            com.getcapacitor.JSArray activities = new com.getcapacitor.JSArray();

            // 3. Query Heart Rate (Last 24h)
            long yesterday = (System.currentTimeMillis() / 1000) - (24 * 60 * 60);
            try (android.database.Cursor cursor = db.rawQuery(
                    "SELECT TIMESTAMP, HEART_RATE FROM COLMI_HEART_RATE_SAMPLE WHERE DEVICE_ID = ? AND TIMESTAMP > ? ORDER BY TIMESTAMP ASC",
                    new String[] { String.valueOf(deviceId), String.valueOf(yesterday) })) {

                Log.d(TAG, "HR Rows found: " + cursor.getCount());
                while (cursor.moveToNext()) {
                    JSObject sample = new JSObject();
                    sample.put("timestamp", cursor.getLong(0) * 1000); // MS
                    sample.put("heartRate", cursor.getInt(1));
                    heartRates.put(sample);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to query COLMI_HEART_RATE_SAMPLE", e);
            }

            // 4. Query Activity (Steps/Sleep/etc) - Table might be COLMI_ACTIVITY_SAMPLE or
            // YAW_ACTIVITY_SAMPLE
            // Checking standard Gadgetbridge naming... probably COLMI_ACTIVITY_SAMPLE
            try (android.database.Cursor cursor = db.rawQuery(
                    "SELECT TIMESTAMP, STEPS, CALORIES, DISTANCE FROM COLMI_ACTIVITY_SAMPLE WHERE DEVICE_ID = ? AND TIMESTAMP > ? ORDER BY TIMESTAMP ASC",
                    new String[] { String.valueOf(deviceId), String.valueOf(yesterday) })) {

                Log.d(TAG, "Activity Rows found: " + cursor.getCount());
                while (cursor.moveToNext()) {
                    JSObject sample = new JSObject();
                    sample.put("timestamp", cursor.getLong(0) * 1000);
                    sample.put("steps", cursor.getInt(1));
                    sample.put("calories", cursor.getInt(2));
                    sample.put("distance", cursor.getInt(3));
                    activities.put(sample);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to query COLMI_ACTIVITY_SAMPLE", e);
            }

            ret.put("syncFinished", true);
            ret.put("history", new JSObject().put("heartRate", heartRates).put("activity", activities));

            notifyListeners("onSyncFinished", ret);

        } catch (Exception e) {
            Log.e(TAG, "Error fetching from DB", e);
        }
    }

    @Override
    public void load() {
        super.load();
        initGadgetbridge();

        // Initialize GBDevice (Virtual Representation)
        gbDevice = new GBDevice("00:00:00:00:00:00", "AsheraRing", "AsheraRing", null, DeviceType.UNKNOWN);

        // Initialize Authentic Support Class
        deviceSupport = new YawellRingDeviceSupport();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String address = call.getString("deviceId");
        if (address == null) {
            call.reject("Must provide deviceId");
            return;
        }

        // Update GBDevice with real address
        gbDevice = new GBDevice(address, "AsheraRing", "AsheraRing", null, DeviceType.UNKNOWN);

        BluetoothManager mgr = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        deviceSupport.setContext(gbDevice, mgr.getAdapter(), getContext());

        // Since AbstractBTLESingleDeviceSupport manages its own queue and connection,
        // we call connect(). Note: This might be async.
        boolean success = deviceSupport.connect();

        if (success) {
            JSObject ret = new JSObject();
            ret.put("status", "connecting");
            call.resolve(ret);
        } else {
            call.reject("Authentic Connect Failed");
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        if (deviceSupport != null) {
            deviceSupport.disconnect();
        }
        call.resolve();
    }

    @PluginMethod
    public void measureHeartRate(PluginCall call) {
        // Delegate to Authentic Method
        if (deviceSupport != null) {
            deviceSupport.onHeartRateTest();
            call.resolve();
        } else {
            call.reject("Not Connected");
        }
    }

    @PluginMethod
    public void fetchTemperatureHistory(PluginCall call) {
        // The authentic method is 'fetchTemperature', but it's private in
        // YawellRingDeviceSupport.
        // However, onFetchRecordedData(0) triggers 'fetchHistoryActivity' ->
        // 'fetchHistoryHR' -> 'fetchHistoryStress' -> 'fetchHistorySpo2' ->
        // 'fetchHistorySleep' -> 'fetchHistoryHRV' -> 'fetchTemperature'.
        // So we trigger the full sync chain.
        if (deviceSupport != null) {
            deviceSupport.onFetchRecordedData(0);
            call.resolve();
        } else {
            call.reject("Not Connected");
        }
    }

    @PluginMethod
    public void fetchSleepHistory(PluginCall call) {
        // Same as above, part of the full sync chain.
        if (deviceSupport != null) {
            deviceSupport.onFetchRecordedData(0);
            call.resolve();
        } else {
            call.reject("Not Connected");
        }
    }

    @PluginMethod
    public void sendCommand(PluginCall call) {
        // Pure Gadgetbridge shouldn't need raw commands from JS,
        // but keeping this for "advanced" debugging if needed.
        call.resolve();
    }
}
