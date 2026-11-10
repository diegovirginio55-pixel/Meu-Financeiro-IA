package br.com.meufinanceiroia;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.service.notification.NotificationListenerService;
import android.text.format.DateUtils;
import android.util.TypedValue;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.app.NotificationManagerCompat;

import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Tela "Leitura dos bancos": mostra o que falta para o saldo em tempo real
 * funcionar (conta conectada, acesso às notificações, bateria), o último
 * aviso visto/enviado e um botão de teste. Também recebe o link pessoal do
 * botão "Ativar neste celular" do site (meufinanceiro://setup?u=…).
 */
public class StatusActivity extends Activity {
    private static final String SITE = "https://meu-financeiro-ia.onrender.com";
    private static final int BG = Color.parseColor("#09090B");
    private static final int CARD = Color.parseColor("#18181B");
    private static final int TEXT = Color.parseColor("#F4F4F5");
    private static final int MUTED = Color.parseColor("#A1A1AA");
    private static final int OK = Color.parseColor("#6EE7B7");
    private static final int WARN = Color.parseColor("#FCD34D");

    private static final int REQUEST_NOTIFICATIONS = 7;

    private LinearLayout root;
    private String testMessage;
    private int notificationAsks;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        scroll.setFillViewport(true);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(32));
        scroll.addView(root);
        setContentView(scroll);

        handleSetupLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSetupLink(intent);
        render();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (hasNotificationAccess()) {
            try {
                NotificationListenerService.requestRebind(new ComponentName(this, BankNotificationListener.class));
            } catch (RuntimeException ignored) {
                // sem problema: o Android liga o serviço sozinho
            }
        }
        render();
    }

    private void handleSetupLink(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"meufinanceiro".equals(data.getScheme())) return;
        String url = data.getQueryParameter("u");
        if (url != null && url.startsWith("https://") && url.contains("/api/ingest/notification") && url.contains("token=")) {
            Prefs.setEndpoint(this, url);
            Toast.makeText(this, "Conectado à sua conta ✓", Toast.LENGTH_LONG).show();
        } else {
            Toast.makeText(this, "Link inválido. No site, toque em Ativar neste celular de novo.", Toast.LENGTH_LONG).show();
        }
    }

    private void render() {
        root.removeAllViews();
        addText("Leitura dos bancos", 24, TEXT, true, 0);
        addText("Quando um app de banco mostrar um aviso de compra ou Pix, o Meu Financeiro registra na hora e o saldo "
                + "atualiza — sem esperar a atualização diária.", 14, MUTED, false, 8);

        boolean connected = Prefs.endpoint(this) != null;
        boolean access = hasNotificationAccess();
        boolean battery = ignoresBatteryOptimizations();

        LinearLayout account = addCard(connected, "Conta conectada", connected
                ? "Ligado ao seu Meu Financeiro."
                : "Abra o Meu Financeiro → Bancos → Saldo em tempo real e toque em “Ativar neste celular”.");
        if (!connected) addButton(account, "Abrir Saldo em tempo real", v -> openSite("/bancos/tempo-real"));

        LinearLayout notifications = addCard(access, "Acesso às notificações", access
                ? "Liberado."
                : "Necessário para ler os avisos dos bancos. Toque em Liberar acesso e ligue o Meu Financeiro. "
                + "Se a opção estiver cinza: Abrir informações do app → ⋮ (canto de cima) → Permitir configurações "
                + "restritas, e tente de novo.");
        if (!access) {
            addButton(notifications, "Liberar acesso", v -> openNotificationAccess());
            addButton(notifications, "Abrir informações do app", v -> openAppDetails());
        }

        boolean appNotifications = NotificationManagerCompat.from(this).areNotificationsEnabled();
        LinearLayout alerts = addCard(appNotifications, "Avisos de movimentação", appNotifications
                ? "O Meu Financeiro pode te avisar quando entrar ou sair dinheiro."
                : "Libere as notificações do Meu Financeiro para receber os avisos de entrada e saída de dinheiro.");
        if (!appNotifications) addButton(alerts, "Liberar notificações", v -> requestAppNotifications());

        LinearLayout power = addCard(battery, "Bateria sem restrição", battery
                ? "O Android não vai pausar a leitura."
                : "Sem isso o Android pode pausar a leitura depois de um tempo.");
        if (!battery) addButton(power, "Liberar", v -> requestBatteryExemption());

        addText("Últimos eventos", 16, TEXT, true, 24);
        long seenAt = Prefs.seenAt(this);
        addText("Último aviso de banco visto: " + (seenAt == 0
                ? "nenhum ainda"
                : ago(seenAt) + " · " + Prefs.seenApp(this) + "\n“" + Prefs.seenPreview(this) + "”"), 13, MUTED, false, 8);
        long sentAt = Prefs.sentAt(this);
        addText("Último envio: " + (sentAt == 0 ? "nenhum ainda" : ago(sentAt) + " · " + Prefs.sentSummary(this)),
                13, MUTED, false, 8);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.VERTICAL);
        actions.setPadding(0, dp(16), 0, 0);
        root.addView(actions);
        if (connected) {
            addButton(actions, "Enviar teste", v -> sendTest());
            if (testMessage != null) addTextTo(actions, testMessage, 13, MUTED, false, 4);
        }
        addButton(actions, "Abrir Meu Financeiro", v -> openSite("/"));

        addText("Bancos lidos: " + BankApps.NAMES + ". Avisos de outros apps nunca saem do celular.", 12, MUTED, false, 24);
    }

    private void sendTest() {
        testMessage = "Enviando… (se o servidor estiver dormindo, pode levar até 1 minuto)";
        render();
        Forwarder.ping(this, outcome -> {
            testMessage = outcome.summary;
            if (!isFinishing()) render();
        });
    }

    private boolean hasNotificationAccess() {
        return NotificationManagerCompat.getEnabledListenerPackages(this).contains(getPackageName());
    }

    private boolean ignoresBatteryOptimizations() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
    }

    private void openNotificationAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent detail = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS);
            detail.putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
                    new ComponentName(this, BankNotificationListener.class).flattenToString());
            if (tryStart(detail)) return;
        }
        if (!tryStart(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))) openAppDetails();
    }

    private void openAppDetails() {
        tryStart(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
    }

    private void requestAppNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && shouldAskNotificationPermission()) {
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            return;
        }
        Intent settings = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        settings.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        if (!tryStart(settings)) openAppDetails();
    }

    /** Depois de 2 recusas o Android não mostra mais o pedido: aí abre as configurações direto. */
    private boolean shouldAskNotificationPermission() {
        return notificationAsks < 2;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATIONS) {
            notificationAsks += 1;
            render();
        }
    }

    private void requestBatteryExemption() {
        Intent request = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + getPackageName()));
        if (!tryStart(request)) tryStart(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
    }

    private void openSite(String path) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE + path));
        intent.setClass(this, LauncherActivity.class);
        tryStart(intent);
    }

    private boolean tryStart(Intent intent) {
        try {
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }

    private CharSequence ago(long at) {
        return DateUtils.getRelativeTimeSpanString(at, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS);
    }

    // ---- layout ----

    private LinearLayout addCard(boolean ok, String title, String description) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable background = new GradientDrawable();
        background.setColor(CARD);
        background.setCornerRadius(dp(16));
        card.setBackground(background);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(12);
        root.addView(card, params);

        addTextTo(card, (ok ? "✅  " : "⚠️  ") + title, 16, ok ? OK : WARN, true, 0);
        addTextTo(card, description, 13, MUTED, false, 4);
        return card;
    }

    private void addButton(LinearLayout parent, String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(listener);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(8);
        parent.addView(button, params);
    }

    private void addText(String text, int sp, int color, boolean bold, int topDp) {
        addTextTo(root, text, sp, color, bold, topDp);
    }

    private void addTextTo(LinearLayout parent, String text, int sp, int color, boolean bold, int topDp) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTextColor(color);
        view.setLineSpacing(0, 1.15f);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(0, dp(topDp), 0, 0);
        parent.addView(view);
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
