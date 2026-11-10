package br.com.meufinanceiroia;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Recebe os avisos que aparecem no celular (precisa do "Acesso às
 * notificações") e encaminha só os dos apps de banco (BankApps), os dos
 * apps que o usuário ligou na tela de status e os SMS de banco com valor.
 * Avisos com R$ de outros apps ficam só no celular, listados na tela de
 * status para o usuário decidir se quer ligar a leitura daquele app.
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
        if (packageName == null || packageName.equals(getPackageName())) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;
        // Resumo de grupo e avisos fixos ("processando…") não são movimentações.
        if ((notification.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) return;

        Bundle extras = notification.extras;
        if (extras == null) return;
        boolean sms = BankApps.isSmsApp(packageName);
        String title = text(extras.getCharSequence(Notification.EXTRA_TITLE));
        String body = sms ? lastMessage(extras) : "";
        if (body.isEmpty()) body = text(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
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

        boolean forward = BankApps.isBank(packageName)
                || Prefs.isExtraApp(this, packageName)
                || (sms && BankApps.looksLikeBankSms(title, body));
        String preview = title.isEmpty() ? body : title + " — " + body;
        if (!forward) {
            // Fica só no celular: aparece na tela de status como sugestão de app para ligar.
            if (!sms && BankApps.mentionsMoney(preview)) {
                Prefs.recordCandidate(this, packageName, BankApps.label(this, packageName), preview);
            }
            return;
        }

        String label = BankApps.label(this, packageName);
        Prefs.recordSeen(this, sms ? label + " (SMS)" : label, preview);
        if (Prefs.endpoint(this) == null) return;

        String id = Forwarder.noticeId(packageName, title, body, sbn.getPostTime());
        if (!Prefs.markIfNew(this, id)) return;
        Forwarder.send(this, Forwarder.notice(packageName, label, title, body, id, sbn.getPostTime()));
    }

    /** SMS em conversa: o texto da última mensagem (o EXTRA_TEXT às vezes vem como "2 mensagens novas"). */
    private static String lastMessage(Bundle extras) {
        try {
            Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
            if (messages == null || messages.length == 0) return "";
            Parcelable last = messages[messages.length - 1];
            if (!(last instanceof Bundle)) return "";
            return text(((Bundle) last).getCharSequence("text"));
        } catch (RuntimeException e) {
            return "";
        }
    }

    private static String text(CharSequence value) {
        return value == null ? "" : value.toString().trim();
    }
}
