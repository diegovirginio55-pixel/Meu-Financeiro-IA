package br.com.meufinanceiroia;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Envia o aviso do banco para o Meu Financeiro (/api/ingest/notification).
 * Tenta na hora; se não houver rede ou o servidor falhar, o SendWorker
 * reenvia sozinho quando a conexão voltar. O "id" do aviso garante que um
 * reenvio não duplique o lançamento.
 */
final class Forwarder {
    private Forwarder() {}

    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final long DEDUPE_WINDOW_MS = 10 * 60 * 1000L;
    private static final Locale PT_BR = new Locale("pt", "BR");

    static final class Outcome {
        /** O servidor respondeu (mesmo que tenha ignorado o aviso): não adianta reenviar. */
        final boolean delivered;
        final String summary;

        Outcome(boolean delivered, String summary) {
            this.delivered = delivered;
            this.summary = summary;
        }
    }

    interface Callback {
        void done(Outcome outcome);
    }

    /** Mesmo aviso (app + título + texto) dentro de 10 min = mesmo id. */
    static String noticeId(String packageName, String title, String text, long postTime) {
        long bucket = postTime / DEDUPE_WINDOW_MS;
        return "a" + sha256(packageName + "|" + title + "|" + text + "|" + bucket).substring(0, 31);
    }

    static JSONObject notice(String packageName, String title, String text, String id, long postTime) {
        JSONObject body = new JSONObject();
        try {
            body.put("app", packageName);
            body.put("title", title);
            body.put("text", text);
            body.put("id", id);
            body.put("at", postTime);
        } catch (JSONException ignored) {
            // put com String/long não falha
        }
        return body;
    }

    /** Envia em segundo plano; se falhar, agenda o reenvio. */
    static void send(Context context, JSONObject body) {
        Context app = context.getApplicationContext();
        EXECUTOR.execute(() -> {
            Outcome outcome = post(app, body);
            if (!outcome.delivered) SendWorker.enqueue(app, body.toString());
        });
    }

    /** Botão "Enviar teste": o site registra "teste" na lista de notificações recebidas. */
    static void ping(Context context, Callback callback) {
        Context app = context.getApplicationContext();
        Handler main = new Handler(Looper.getMainLooper());
        EXECUTOR.execute(() -> {
            JSONObject body = new JSONObject();
            try {
                body.put("ping", true);
            } catch (JSONException ignored) {
                // não falha
            }
            Outcome outcome = post(app, body);
            main.post(() -> callback.done(outcome));
        });
    }

    static Outcome post(Context context, JSONObject body) {
        String endpoint = Prefs.endpoint(context);
        if (endpoint == null) {
            return new Outcome(true, "Não conectado: toque em Ativar neste celular no site.");
        }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(20_000);
            // O servidor grátis pode levar até ~1 min para acordar.
            connection.setReadTimeout(90_000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(bytes);
            }
            int code = connection.getResponseCode();
            String response = readAll(code >= 400 ? connection.getErrorStream() : connection.getInputStream());
            String summary = describe(code, response);
            Prefs.recordSend(context, summary);
            // Movimentação registrada: o widget mostra o saldo novo.
            if (code < 300) WidgetUpdateWorker.refreshNow(context);
            return new Outcome(code < 500, summary);
        } catch (IOException | RuntimeException e) {
            String summary = "Sem conexão com o servidor — o app tenta de novo sozinho.";
            Prefs.recordSend(context, summary);
            return new Outcome(false, summary);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String describe(int code, String response) {
        if (code == 401) return "Link inválido: no site, toque em Ativar neste celular de novo.";
        try {
            JSONObject json = new JSONObject(response);
            if (json.optBoolean("ping")) return "Teste recebido pelo Meu Financeiro ✓";
            if (json.has("ignored")) return "Ignorado: " + json.optString("ignored");
            if (json.has("registered")) {
                JSONObject movement = json.optJSONObject("movement");
                String what = movement == null
                        ? ""
                        : movement.optString("description") + " · R$ "
                        + String.format(PT_BR, "%.2f", movement.optDouble("amount", 0));
                return (json.optBoolean("registered") ? "Registrado: " : "Já estava registrado: ") + what;
            }
            if (json.has("error")) return "Erro: " + json.optString("error");
        } catch (JSONException ignored) {
            // resposta não é JSON
        }
        return "Resposta do servidor: " + code;
    }

    private static String readAll(InputStream in) throws IOException {
        if (in == null) return "";
        try (InputStream stream = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = stream.read(buffer)) != -1) out.write(buffer, 0, read);
            return out.toString("UTF-8");
        }
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format(Locale.ROOT, "%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(value.hashCode()) + "00000000000000000000000000000000";
        }
    }
}
