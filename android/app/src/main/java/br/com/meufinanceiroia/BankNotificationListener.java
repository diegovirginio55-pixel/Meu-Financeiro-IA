package br.com.meufinanceiroia;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Recebe os avisos que aparecem no celular (precisa do "Acesso às
 * notificações") e encaminha só os dos apps de banco (BankApps).
 */
public class BankNotificationListener extends NotificationListenerService {

    @Override
    public void onListenerConnected() {
        Prefs.setListenerConnected(this, true);
    }

    @Override
    public void onListenerDisconnected() {
        Prefs.setListenerConnected(this, false);
        try {
            requestRebind(new ComponentName(this, BankNotificationListener.class));
        } catch (RuntimeException ignored) {
            // alguns fabricantes não permitem; a tela de status pede de novo
        }
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String packageName = sbn.getPackageName();
        if (!BankApps.isBank(packageName)) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;
        // Resumo de grupo e avisos fixos ("processando…") não são movimentações.
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

        Bundle extras = notification.extras;
        if (extras == null) return;
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_TEXT));
        if (body.isEmpty()) {
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null) {
                StringBuilder joined = new StringBuilder();
                for (CharSequence line : lines) {
                    if (line == null) continue;
                    if (joined.length() > 0) joined.append(' ');
                    joined.append(line);
                }
                body = joined.toString().trim();
            }
        }
        if (title.isEmpty() && body.isEmpty()) return;

        Prefs.recordSeen(this, BankApps.label(this, packageName), title.isEmpty() ? body : title + " — " + body);
        if (Prefs.endpoint(this) == null) return;

        String id = Forwarder.noticeId(packageName, title, body, sbn.getPostTime());
        if (!Prefs.markIfNew(this, id)) return;
        Forwarder.send(this, Forwarder.notice(packageName, title, body, id, sbn.getPostTime()));
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }
}
