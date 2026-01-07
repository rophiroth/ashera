package org.psyhackers.Ashera;

import com.getcapacitor.BridgeActivity;
import nodomain.freeyourgadget.gadgetbridge.R;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AsheraRingPlugin.class);
        super.onCreate(savedInstanceState);

        // PROOF OF UPDATE
        android.widget.Toast.makeText(this, "Build: SUPER_ICON_V3 + GADGETBRIDGE", android.widget.Toast.LENGTH_LONG)
                .show();

    }
}
