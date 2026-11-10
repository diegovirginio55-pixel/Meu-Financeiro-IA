package br.com.meufinanceiroia;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import java.util.ArrayList;
import java.util.List;

/** Configuração e últimos eventos, guardados só no celular. */
final class Prefs {
    private Prefs() {}

    private static final String NAME = "meu_financeiro";
    private static final int MAX_RECENT_IDS = 60;

    private static SharedPreferences sp(Context context) {
        return context.getApplicationContext().getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    /** Link pessoal (…/api/ingest/notification?token=…), vindo do botão "Ativar neste celular". */
    static String endpoint(Context context) {
        return sp(context).getString("endpoint", null);
    }

    static void setEndpoint(Context context, String url) {
        sp(context).edit().putString("endpoint", url).apply();
    }

    static void recordSeen(Context context, String app, String preview) {
        sp(context).edit()
                .putLong("seen_at", System.currentTimeMillis())
                .putString("seen_app", app)
                .putString("seen_preview", preview.length() > 140 ? preview.substring(0, 140) + "…" : preview)
                .apply();
    }

    static long seenAt(Context context) {
        return sp(context).getLong("seen_at", 0);
    }

    static String seenApp(Context context) {
        return sp(context).getString("seen_app", "");
    }

    static String seenPreview(Context context) {
        return sp(context).getString("seen_preview", "");
    }

    static void recordSend(Context context, String summary) {
        sp(context).edit()
                .putLong("sent_at", System.currentTimeMillis())
                .putString("sent_summary", summary)
                .apply();
    }

    static long sentAt(Context context) {
        return sp(context).getLong("sent_at", 0);
    }

    static String sentSummary(Context context) {
        return sp(context).getString("sent_summary", "");
    }

    static void setListenerConnected(Context context, boolean connected) {
        sp(context).edit().putBoolean("listener_connected", connected).apply();
    }

    static boolean listenerConnected(Context context) {
        return sp(context).getBoolean("listener_connected", false);
    }

    /** true se este aviso ainda não foi encaminhado (o app do banco às vezes reposta o mesmo aviso). */
    static synchronized boolean markIfNew(Context context, String id) {
        String joined = sp(context).getString("recent_ids", "");
        List<String> ids = new ArrayList<>();
        if (!TextUtils.isEmpty(joined)) {
            for (String item : joined.split(",")) {
                if (!item.isEmpty()) ids.add(item);
            }
        }
        if (ids.contains(id)) return false;
        ids.add(0, id);
        while (ids.size() > MAX_RECENT_IDS) ids.remove(ids.size() - 1);
        sp(context).edit().putString("recent_ids", TextUtils.join(",", ids)).apply();
        return true;
    }
}
