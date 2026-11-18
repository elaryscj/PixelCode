package com.example.game_backend.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;

/**
 * Freedom Pay's pg_sig: MD5 of "scriptName;value1;value2;...;secretKey", values sorted by parameter name,
 * pg_sig itself left out. The script name is the last segment of the URL path (init_payment.php for a request
 * to /init_payment.php; for a callback, the last segment of our own result URL). docs.freedompay.kz, Signature.
 */
public final class FreedomPaySignature {
    private FreedomPaySignature() {
    }

    public static String sign(String scriptName, Map<String, String> params, String secretKey) {
        StringBuilder sb = new StringBuilder(scriptName);
        for (Map.Entry<String, String> e : new TreeMap<>(params).entrySet()) {
            if (!"pg_sig".equals(e.getKey())) {
                sb.append(';').append(e.getValue() == null ? "" : e.getValue());
            }
        }
        sb.append(';').append(secretKey);
        try {
            byte[] d = MessageDigest.getInstance("MD5").digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static boolean valid(String scriptName, Map<String, String> params, String secretKey) {
        String sig = params.get("pg_sig");
        if (sig == null || secretKey == null || secretKey.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(sign(scriptName, params, secretKey).getBytes(StandardCharsets.US_ASCII),
                sig.toLowerCase().getBytes(StandardCharsets.US_ASCII));
    }

    /** Last segment of a URL path: the "script name" in the signature. */
    public static String scriptName(String urlOrPath) {
        String p = urlOrPath;
        int q = p.indexOf('?');
        if (q >= 0) {
            p = p.substring(0, q);
        }
        while (p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p.substring(p.lastIndexOf('/') + 1);
    }
}
