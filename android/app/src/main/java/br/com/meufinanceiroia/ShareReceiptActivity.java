package br.com.meufinanceiroia;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.TypedValue;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.google.android.gms.tasks.Tasks;
import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * "Compartilhar" no comprovante do app do banco → Meu Financeiro. Cobre o
 * Pix que o banco não avisa por notificação (quando a própria pessoa faz o
 * Pix com o app aberto). O texto da imagem/PDF é lido aqui no celular (ML
 * Kit, sem custo e sem mandar a imagem para fora); só o texto vai para o
 * site, que entende o comprovante e lança na hora.
 */
public class ShareReceiptActivity extends Activity {

    private static final String SITE = "https://meu-financeiro-ia.onrender.com";
    private static final int BG = Color.parseColor("#09090B");
    private static final int TEXT = Color.parseColor("#F4F4F5");
    private static final int MUTED = Color.parseColor("#A1A1AA");
    private static final int OK = Color.parseColor("#6EE7B7");
    private static final int WARN = Color.parseColor("#FCD34D");
    private static final int MAX_PDF_PAGES = 2;
    private static final int MAX_TEXT = 3800;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextView status;
    private TextView detail;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(28), dp(20), dp(32));
        scroll.addView(root);
        setContentView(scroll);

        root.addView(text("Lançar comprovante", 24, TEXT, true, 0));
        status = text("Lendo o comprovante…", 16, TEXT, true, 16);
        root.addView(status);
        detail = text("", 13, MUTED, false, 6);
        root.addView(detail);
        root.addView(button("Abrir Meu Financeiro", () -> {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE + "/dashboard"));
            intent.setClass(this, LauncherActivity.class);
            tryStart(intent);
            finish();
        }));
        root.addView(button("Fechar", this::finish));

        handle(getIntent());
    }

    @Override
    protected void onDestroy() {
        worker.shutdown();
        super.onDestroy();
    }

    private void handle(Intent intent) {
        if (Prefs.endpoint(this) == null) {
            show(WARN, "Conecte o app primeiro", "No Meu Financeiro: Bancos → Saldo em tempo real → Ativar neste celular.");
            return;
        }
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            show(WARN, "Nada para lançar", "No comprovante do app do banco, toque em Compartilhar e escolha Meu Financeiro.");
            return;
        }
        String type = intent.getType() == null ? "" : intent.getType();
        CharSequence sharedText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri == null) {
            if (sharedText != null && sharedText.length() > 0) send(sharedText.toString());
            else show(WARN, "Não recebi o comprovante", "Tente compartilhar de novo como imagem ou PDF.");
            return;
        }
        worker.execute(() -> {
            try {
                String read = type.equals("application/pdf") ? readPdf(uri) : readImage(InputImage.fromFilePath(this, uri));
                if (sharedText != null && sharedText.length() > 0) read = sharedText + "\n" + read;
                String result = read;
                main.post(() -> send(result));
            } catch (Exception e) {
                main.post(() -> show(WARN, "Não consegui ler o comprovante",
                        "Tente de novo. Se continuar, tire um print do comprovante e compartilhe a imagem."));
            }
        });
    }

    private String readPdf(Uri uri) throws Exception {
        StringBuilder all = new StringBuilder();
        try (ParcelFileDescriptor file = getContentResolver().openFileDescriptor(uri, "r")) {
            if (file == null) throw new IllegalStateException("sem arquivo");
            try (PdfRenderer renderer = new PdfRenderer(file)) {
                for (int index = 0; index < Math.min(MAX_PDF_PAGES, renderer.getPageCount()); index += 1) {
                    try (PdfRenderer.Page page = renderer.openPage(index)) {
                        int width = 1400;
                        int height = Math.max(1, Math.round((float) page.getHeight() / page.getWidth() * width));
                        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                        bitmap.eraseColor(Color.WHITE);
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                        if (all.length() > 0) all.append('\n');
                        all.append(readImage(InputImage.fromBitmap(bitmap, 0)));
                    }
                }
            }
        }
        return all.toString();
    }

    /** Texto em linhas como aparece na tela: rótulo e valor lado a lado ("Nome Fulano"). */
    private String readImage(InputImage image) throws Exception {
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        try {
            Text result = Tasks.await(recognizer.process(image));
            List<Text.Line> lines = new ArrayList<>();
            for (Text.TextBlock block : result.getTextBlocks()) lines.addAll(block.getLines());
            Collections.sort(lines, (a, b) -> Integer.compare(centerY(a), centerY(b)));

            StringBuilder out = new StringBuilder();
            List<Text.Line> row = new ArrayList<>();
            for (Text.Line line : lines) {
                if (!row.isEmpty() && !sameRow(row.get(0), line)) {
                    appendRow(out, row);
                    row.clear();
                }
                row.add(line);
            }
            appendRow(out, row);
            return out.toString();
        } finally {
            recognizer.close();
        }
    }

    private static int centerY(Text.Line line) {
        Rect box = line.getBoundingBox();
        return box == null ? 0 : box.centerY();
    }

    private static boolean sameRow(Text.Line first, Text.Line other) {
        Rect a = first.getBoundingBox();
        Rect b = other.getBoundingBox();
        if (a == null || b == null) return false;
        return Math.abs(a.centerY() - b.centerY()) < Math.max(8, Math.min(a.height(), b.height()) * 0.6);
    }

    private static void appendRow(StringBuilder out, List<Text.Line> row) {
        if (row.isEmpty()) return;
        List<Text.Line> sorted = new ArrayList<>(row);
        Collections.sort(sorted, (a, b) -> Integer.compare(
                a.getBoundingBox() == null ? 0 : a.getBoundingBox().left,
                b.getBoundingBox() == null ? 0 : b.getBoundingBox().left));
        if (out.length() > 0) out.append('\n');
        for (int index = 0; index < sorted.size(); index += 1) {
            if (index > 0) out.append(' ');
            out.append(sorted.get(index).getText());
        }
    }

    private void send(String read) {
        String cleaned = read.trim();
        if (cleaned.isEmpty()) {
            show(WARN, "Não achei texto no comprovante", "Tire um print do comprovante e compartilhe a imagem.");
            return;
        }
        if (cleaned.length() > MAX_TEXT) cleaned = cleaned.substring(0, MAX_TEXT);
        show(TEXT, "Lançando…", "");
        Forwarder.postReceipt(this, Forwarder.receipt(cleaned), outcome -> {
            if (!outcome.delivered) {
                show(WARN, "Sem conexão agora", "Vou lançar sozinho quando a internet voltar.");
            } else if (outcome.summary.startsWith("Registrado")) {
                show(OK, "✅ " + outcome.summary, "O saldo e o limite de hoje já foram atualizados. Chega um aviso em seguida.");
            } else if (outcome.summary.startsWith("Já estava")) {
                show(OK, "✅ " + outcome.summary, "Esse Pix já estava no Meu Financeiro — não lancei de novo.");
            } else {
                show(WARN, outcome.summary, "Se for um comprovante de Pix ou transferência, tire um print e compartilhe a imagem.");
            }
        });
    }

    private void show(int color, String title, String description) {
        status.setText(title);
        status.setTextColor(color);
        detail.setText(description);
    }

    private boolean tryStart(Intent intent) {
        try {
            startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }

    private TextView text(String value, int sp, int color, boolean bold, int topDp) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setTextColor(color);
        view.setLineSpacing(0, 1.15f);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(0, dp(topDp), 0, 0);
        return view;
    }

    private Button button(String label, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(v -> action.run());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(12);
        button.setLayoutParams(params);
        return button;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
