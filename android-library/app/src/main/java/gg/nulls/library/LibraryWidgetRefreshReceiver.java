package gg.nulls.library;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Private refresh target; the widget provider itself remains system-only. */
public final class LibraryWidgetRefreshReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent != null && LibraryWidgetProvider.ACTION_REFRESH.equals(intent.getAction())) {
            LibraryWidgetProvider.refreshAll(context);
        }
    }
}
