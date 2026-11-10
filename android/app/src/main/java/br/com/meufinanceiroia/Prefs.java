package br.com.meufinanceiroia;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

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

    static void saveWidgetData(Context context, double balance, double todaySpent) {
        sp(context).edit()
                .putString("widget_balance", Double.toString(balance))
                .putString("widget_today", Double.toString(todaySpent))
                .putLong("widget_at", System.currentTimeMillis())
                .apply();
    }

    /** {saldo, gastos de hoje} ou null se ainda não buscou. */
    static double[] widgetData(Context context) {
        String balance = sp(context).getString("widget_balance", null);
        String today = sp(context).getString("widget_today", null);
        if (balance == null || today == null) return null;
        try {
            return new double[] {Double.parseDouble(balance), Double.parseDouble(today)};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    static long widgetAt(Context context) {
        return sp(context).getLong("widget_at", 0);
    }

    // ---- apps fora da lista que o usuário ligou na tela de status ----

    static boolean isExtraApp(Context context, String packageName) {
        return sp(context).getStringSet("extra_apps", new HashSet<>()).contains(packageName);
    }

    static Set<String> extraApps(Context context) {
        return new HashSet<>(sp(context).getStringSet("extra_apps", new HashSet<>()));
    }

    static void setExtraApp(Context context, String packageName, boolean on) {
        Set<String> apps = extraApps(context);
        if (on) apps.add(packageName);
        else apps.remove(packageName);
        sp(context).edit().putStringSet("extra_apps", apps).apply();
    }

    /** App fora da lista que mostrou aviso com R$ (só no celular — nada disso é enviado). */
    static final class Candidate {
        final String packageName;
        final String label;
        final int count;
        final long at;
        final String preview;

        Candidate(String packageName, String label, int count, long at, String preview) {
            this.packageName = packageName;
            this.label = label;
            this.count = count;
            this.at = at;
            this.preview = preview;
        }
    }

    private static final int MAX_CANDIDATES = 8;

    static synchronized void recordCandidate(Context context, String packageName, String label, String preview) {
        JSONObject all = candidatesJson(context);
        JSONObject item = all.optJSONObject(packageName);
        int count = item == null ? 0 : item.optInt("count", 0);
        try {
            JSONObject updated = new JSONObject();
            updated.put("label", label);
            updated.put("count", count + 1);
            updated.put("at", System.currentTimeMillis());
            updated.put("preview", preview.length() > 120 ? preview.substring(0, 120) + "…" : preview);
            all.put(packageName, updated);
            // Guarda só os mais recentes.
            while (all.length() > MAX_CANDIDATES) {
                String oldest = null;
                long oldestAt = Long.MAX_VALUE;
                Iterator<String> keys = all.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    long at = all.optJSONObject(key) == null ? 0 : all.optJSONObject(key).optLong("at", 0);
                    if (at < oldestAt) {
                        oldestAt = at;
                        oldest = key;
                    }
                }
                if (oldest == null) break;
                all.remove(oldest);
            }
        } catch (JSONException ignored) {
            return;
        }
        sp(context).edit().putString("candidates", all.toString()).apply();
    }

    /** Mais recentes primeiro. */
    static List<Candidate> candidates(Context context) {
        JSONObject all = candidatesJson(context);
        List<Candidate> list = new ArrayList<>();
        Iterator<String> keys = all.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            JSONObject item = all.optJSONObject(key);
            if (item == null) continue;
            list.add(new Candidate(key, item.optString("label", key), item.optInt("count", 1), item.optLong("at", 0),
                    item.optString("preview", "")));
        }
        Collections.sort(list, (a, b) -> Long.compare(b.at, a.at));
        return list;
    }

    private static JSONObject candidatesJson(Context context) {
        try {
            return new JSONObject(sp(context).getString("candidates", "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
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
