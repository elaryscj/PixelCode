package com.example.game_backend.game;

import com.example.game_backend.error.ApiException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.regex.Pattern;

/**
 * Checks a skin texture sent by the admin editor: a PNG of exactly WIDTH x HEIGHT pixels with something drawn
 * on it. The layout of the body parts inside it is defined by the frontend (game/skinRig.ts).
 */
public final class SkinTexture {
    public static final int WIDTH = 32;
    public static final int HEIGHT = 16;
    private static final Pattern PNG_DATA_URL = Pattern.compile("^data:image/png;base64,[A-Za-z0-9+/=]+$");
    /** a 32x16 PNG is well under 3 KB; anything far larger is not a texture */
    private static final int MAX_CHARS = 20_000;

    private SkinTexture() {
    }

    /** @return the PNG bytes of a valid texture, otherwise an ApiException for the "texture" field */
    public static byte[] validate(String dataUrl) {
        if (dataUrl == null || dataUrl.length() > MAX_CHARS || !PNG_DATA_URL.matcher(dataUrl).matches()) {
            throw invalid("The skin texture must be a PNG");
        }
        byte[] png;
        BufferedImage img;
        try {
            png = Base64.getDecoder().decode(dataUrl.substring(dataUrl.indexOf(',') + 1));
            if (!isPng(png)) {
                throw invalid("The skin texture must be a PNG");
            }
            img = ImageIO.read(new ByteArrayInputStream(png));
        } catch (IllegalArgumentException | IOException e) {
            throw invalid("The skin texture must be a PNG");
        }
        if (img == null) {
            throw invalid("The skin texture must be a PNG");
        }
        if (img.getWidth() != WIDTH || img.getHeight() != HEIGHT) {
            throw invalid("The skin texture must be " + WIDTH + " x " + HEIGHT + " pixels");
        }
        int painted = 0;
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                if ((img.getRGB(x, y) >>> 24) > 0) {
                    painted++;
                }
            }
        }
        if (painted < 20) {
            throw invalid("Draw the skin first: the texture is almost empty");
        }
        return png;
    }

    private static final byte[] SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    /** only real PNG bytes reach the image decoder, whatever the data URL claims */
    private static boolean isPng(byte[] data) {
        if (data.length < SIGNATURE.length) {
            return false;
        }
        for (int i = 0; i < SIGNATURE.length; i++) {
            if (data[i] != SIGNATURE[i]) {
                return false;
            }
        }
        return true;
    }

    private static ApiException invalid(String message) {
        return new ApiException(400, message).with("field", "texture");
    }
}
