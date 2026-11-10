package br.com.meufinanceiroia;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Apps de banco cujos avisos são encaminhados. Só esses (mais os que o
 * usuário ligar na tela de status e os SMS de banco): avisos de outros apps
 * (WhatsApp etc.) nunca saem do celular.
 *
 * Manter igual a PACKAGE_BANKS em lib/ingest/parse-notification.ts.
 */
final class BankApps {
    private BankApps() {}

    private static final Set<String> PACKAGES = new HashSet<>(Arrays.asList(
            "com.nu.production",
            "br.com.intermedium",
            "br.com.gabba.caixa",
            "br.gov.caixa.tem",
            "br.gov.caixa.cartoes",
            "com.bradesco",
            "br.com.bradesco.next",
            "com.santander.app",
            "com.itau",
            "com.itau.iti",
            "br.com.bb.android",
            "com.c6bank.app",
            "com.picpay",
            "com.mercadopago.wallet",
            "br.com.sicoobnet",
            "br.com.sicoob.moob",
            "br.com.neon",
            "br.com.uol.ps.myaccount"
    ));

    /** Apps de SMS: só passam mensagens com R$ E nome de banco (ex.: "CAIXA: Compra aprovada…"). */
    private static final Set<String> SMS_APPS = new HashSet<>(Arrays.asList(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.android.mms",
            "com.android.messaging",
            "com.motorola.messaging",
            "com.oneplus.mms",
            "com.sonyericsson.conversations"
    ));

    private static final Pattern MONEY = Pattern.compile("R\\$\\s*-?\\s*\\d");
    private static final Pattern BANK_WORDS = Pattern.compile(
            "(?iu)(caixa|nubank|\\binter\\b|bradesco|santander|ita[uú]|banco do brasil|\\bbb\\b|\\bc6\\b|picpay|"
                    + "mercado ?pago|sicoob|sicredi|\\bneon\\b|pagbank|pagseguro)");

    static final String NAMES =
            "Nubank, Inter, Caixa, Caixa Tem, Cartões CAIXA, Bradesco, next, Santander, Itaú, iti, Banco do Brasil, "
                    + "C6 Bank, PicPay, Mercado Pago, Sicoob, Neon e PagBank";

    static boolean isBank(String packageName) {
        return packageName != null && PACKAGES.contains(packageName.toLowerCase(Locale.ROOT));
    }

    static boolean isSmsApp(String packageName) {
        return packageName != null && SMS_APPS.contains(packageName.toLowerCase(Locale.ROOT));
    }

    /** SMS de banco com valor: tem R$ e o nome de um banco (no remetente ou no texto). */
    static boolean looksLikeBankSms(String title, String body) {
        String all = title + " " + body;
        return MONEY.matcher(all).find() && BANK_WORDS.matcher(all).find();
    }

    /** Aviso com valor em reais (para sugerir ligar a leitura de um app fora da lista). */
    static boolean mentionsMoney(String text) {
        return text != null && MONEY.matcher(text).find();
    }

    /** Nome do app como aparece no celular (ex.: "Inter"); se não achar, o pacote. */
    static String label(Context context, String packageName) {
        try {
            PackageManager pm = context.getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(packageName, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (PackageManager.NameNotFoundException | RuntimeException e) {
            return packageName;
        }
    }
}
