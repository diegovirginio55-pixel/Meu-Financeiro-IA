package br.com.meufinanceiroia;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Apps de banco cujos avisos são encaminhados. Só esses: avisos de outros
 * apps (WhatsApp etc.) nunca saem do celular.
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
            "com.bradesco",
            "br.com.bradesco.next",
            "com.santander.app",
            "com.itau",
            "com.itau.iti",
            "br.com.bb.android",
            "com.c6bank.app",
            "com.picpay",
            "com.mercadopago.wallet"
    ));

    static final String NAMES =
            "Nubank, Inter, Caixa, Caixa Tem, Bradesco, next, Santander, Itaú, iti, Banco do Brasil, C6 Bank, PicPay e Mercado Pago";

    static boolean isBank(String packageName) {
        return packageName != null && PACKAGES.contains(packageName.toLowerCase(Locale.ROOT));
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
