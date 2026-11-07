package gg.nulls.library;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.widget.RemoteViews;

import java.text.DateFormat;
import java.util.Date;

/** Home-screen shortcuts into the app's existing library actions. */
public final class LibraryWidgetProvider extends AppWidgetProvider {
    static final String ACTION_REFRESH = "gg.nulls.library.widget.REFRESH";

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) update(context, manager, widgetId);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, LibraryWidgetProvider.class));
        new LibraryWidgetProvider().onUpdate(context, manager, ids);
    }

    private void update(Context context, AppWidgetManager manager, int widgetId) {
        Localizer localizer = new Localizer(context);
        android.content.SharedPreferences settings = context.getSharedPreferences("settings", Context.MODE_PRIVATE);
        String theme = settings.getString("theme", "system");
        boolean dark = theme.equals("dark") || theme.equals("system") &&
                (context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        String accentChoice = settings.getString("accent_color", ThemePalette.SYSTEM);
        int accent = ThemePalette.resolve(context, accentChoice, dark);
        boolean customAccent = ThemePalette.isValidAccent(accentChoice) && !ThemePalette.SYSTEM.equals(accentChoice);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.library_widget);
        views.setTextViewText(R.id.widget_title, localizer.t("Библиотека"));
        views.setTextViewText(R.id.widget_status,
                localizer.t("Библиотека") + " · " + DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()));
        views.setTextViewText(R.id.widget_search, localizer.t("Библиотека"));
        views.setTextViewText(R.id.widget_mine, localizer.t("Мои скрипты"));
        views.setTextViewText(R.id.widget_favorites, localizer.t("Избранное"));
        views.setTextViewText(R.id.widget_import, localizer.t("Импортировать .lua"));
        views.setInt(R.id.widget_logo, "setColorFilter", accent);
        views.setInt(R.id.widget_refresh, "setColorFilter", accent);
        if (customAccent) {
            int cardColor = ThemePalette.widgetCardColor(accent, dark);
            int cardText = ThemePalette.onColor(cardColor);
            if (Build.VERSION.SDK_INT >= 31) {
                android.content.res.ColorStateList tint = android.content.res.ColorStateList.valueOf(cardColor);
                for (int id : new int[]{R.id.widget_search, R.id.widget_mine, R.id.widget_favorites, R.id.widget_import}) {
                    views.setColorStateList(id, "setBackgroundTintList", tint);
                    views.setTextColor(id, cardText);
                }
            }
        }
        for (int slot = 0; slot < WidgetActions.count(); slot++) {
            int viewId = new int[]{R.id.widget_search, R.id.widget_mine, R.id.widget_favorites, R.id.widget_import}[slot];
            bindActivity(context, views, viewId, WidgetActions.actionFor(slot), slot + 1);
        }
        Intent refresh = new Intent(context, LibraryWidgetRefreshReceiver.class).setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(context, widgetId, refresh,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPending);
        manager.updateAppWidget(widgetId, views);
    }

    private static void bindActivity(Context context, RemoteViews views, int viewId, String action, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_VIEW)
                .putExtra("library_action", action)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pending);
    }
}
