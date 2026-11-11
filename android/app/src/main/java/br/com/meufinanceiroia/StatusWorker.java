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

import java.util.concurrent.TimeUnit;

/**
 * "Estou vivo": a cada 6 horas (e ao abrir a tela de status ou religar o
 * leitor) manda ao site a versão do app e se o acesso às notificações está
 * liberado. Se o celular ficar mais de um dia sem dar sinal, ou o leitor
 * for desligado, o site avisa — antes só se percebia quando faltava um
 * lançamento. Não envia nenhuma notificação nem dado do celular.
 */
public class StatusWorker extends Worker {
    private static final String PERIODIC = "status-periodic";
    private static final String NOW = "status-now";

    public StatusWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        if (Prefs.endpoint(context) == null) return Result.success();
        Forwarder.Outcome outcome = Forwarder.post(context, Forwarder.status());
        return outcome.delivered || getRunAttemptCount() >= 3 ? Result.success() : Result.retry();
    }

    private static Constraints online() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    static void schedule(Context context) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(StatusWorker.class, 6, TimeUnit.HOURS)
                .setConstraints(online())
                .build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    static void sendNow(Context context) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(StatusWorker.class)
                .setConstraints(online())
                .build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork(NOW, ExistingWorkPolicy.REPLACE, request);
    }
}
