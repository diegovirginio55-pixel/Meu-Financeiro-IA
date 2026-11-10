package br.com.meufinanceiroia;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.TimeUnit;

/**
 * Busca saldo em conta e gastos de hoje em /api/ingest/widget (mesmo link
 * pessoal da leitura dos bancos) e atualiza o widget. Roda a cada 30 min,
 * ao abrir a tela de status e logo depois de cada aviso de banco enviado.
 */
public class WidgetUpdateWorker extends Worker {
    private static final String PERIODIC = "widget-periodic";
    private static final String NOW = "widget-now";

    public WidgetUpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String endpoint = Prefs.endpoint(context);
        if (endpoint == null) return Result.success();
        String widgetUrl = endpoint.replace("/api/ingest/notification", "/api/ingest/widget");

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(widgetUrl).openConnection();
            connection.setConnectTimeout(20_000);
            // O servidor grátis pode levar até ~1 min para acordar.
            connection.setReadTimeout(90_000);
            int code = connection.getResponseCode();
            if (code != 200) return code >= 500 ? Result.retry() : Result.success();
            JSONObject json = new JSONObject(readAll(connection.getInputStream()));
            Prefs.saveWidgetData(context, json.optDouble("balance", 0), json.optDouble("todaySpent", 0));
            BalanceWidgetProvider.renderAll(context);
            return Result.success();
        } catch (Exception e) {
            return getRunAttemptCount() < 3 ? Result.retry() : Result.failure();
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static Constraints online() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** Atualiza já (se houver widget na tela). */
    static void refreshNow(Context context) {
        Context app = context.getApplicationContext();
        if (!BalanceWidgetProvider.hasWidgets(app)) return;
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(WidgetUpdateWorker.class)
                .setConstraints(online())
                .build();
        WorkManager.getInstance(app).enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, request);
    }

    static void schedulePeriodic(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(WidgetUpdateWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(online())
                .build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    static void cancelPeriodic(Context context) {
        WorkManager.getInstance(context.getApplicationContext()).cancelUniqueWork(PERIODIC);
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        try (InputStream stream = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toString("UTF-8");
        }
    }
}
