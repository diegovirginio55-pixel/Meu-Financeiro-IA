package br.com.meufinanceiroia;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.format.DateFormat;
import android.widget.RemoteViews;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

import java.text.NumberFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget da tela inicial: saldo em conta e gastos de hoje. Mostra na hora o
 * último valor guardado e pede ao WidgetUpdateWorker para buscar o atual.
 */
public class BalanceWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        render(context, manager, widgetIds);
        WidgetUpdateWorker.refreshNow(context);
    }

    @Override
    public void onEnabled(Context context) {
        WidgetUpdateWorker.schedulePeriodic(context);
    }

    @Override
    public void onDisabled(Context context) {
        WidgetUpdateWorker.cancelPeriodic(context);
    }

    /** Redesenha todos os widgets com os valores guardados. */
    static void renderAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BalanceWidgetProvider.class));
        if (ids != null && ids.length > 0) render(context, manager, ids);
    }

    static boolean hasWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, BalanceWidgetProvider.class));
        return ids != null && ids.length > 0;
    }

    private static void render(Context context, AppWidgetManager manager, int[] widgetIds) {
        NumberFormat money = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
        double[] data = Prefs.widgetData(context);
        long at = Prefs.widgetAt(context);

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("https://meu-financeiro-ia.onrender.com/dashboard"));
        open.setClass(context, LauncherActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        for (int id : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_balance);
            if (data != null) {
                views.setTextViewText(R.id.widget_balance, money.format(data[0]));
                views.setTextViewText(R.id.widget_today, money.format(data[1]));
                views.setTextViewText(R.id.widget_updated,
                        "atualizado às " + DateFormat.getTimeFormat(context).format(new Date(at)));
            } else if (Prefs.endpoint(context) != null) {
                views.setTextViewText(R.id.widget_updated, "Buscando o saldo…");
            }
            views.setOnClickPendingIntent(R.id.widget_root, tap);
            manager.updateAppWidget(id, views);
        }
    }
}
