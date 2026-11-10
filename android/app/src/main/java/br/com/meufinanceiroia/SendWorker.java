package br.com.meufinanceiroia;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/** Reenvia um aviso que não chegou ao servidor (sem internet, servidor fora do ar…). */
public class SendWorker extends Worker {
    private static final String KEY_BODY = "body";
    private static final int MAX_ATTEMPTS = 20;

    public SendWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        String raw = getInputData().getString(KEY_BODY);
        if (raw == null) return Result.success();
        try {
            Forwarder.Outcome outcome = Forwarder.post(getApplicationContext(), new JSONObject(raw));
            if (outcome.delivered) return Result.success();
            return getRunAttemptCount() < MAX_ATTEMPTS ? Result.retry() : Result.failure();
        } catch (JSONException e) {
            return Result.success();
        }
    }

    static void enqueue(Context context, String body) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(SendWorker.class)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .setInputData(new Data.Builder().putString(KEY_BODY, body).build())
                .build();
        WorkManager.getInstance(context).enqueue(request);
    }
}
