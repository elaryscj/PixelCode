package com.example.game_backend.game;

import com.example.game_backend.error.ApiException;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SkinTextureTest {
    private static String png(int w, int h, int painted, String format) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        for (int i = 0; i < painted; i++) {
            img.setRGB(i % w, i / w, 0xFF336699);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(out.toByteArray());
    }

    @Test
    void acceptsAPaintedTextureOfTheRightSize() throws Exception {
        byte[] bytes = SkinTexture.validate(png(32, 16, 200, "png"));
        assertTrue(bytes.length > 0);
    }

    @Test
    void refusesWrongSizeEmptyOrNotAPng() throws Exception {
        assertEquals("The skin texture must be 32 x 16 pixels",
                assertThrows(ApiException.class, () -> SkinTexture.validate(png(64, 64, 200, "png"))).getMessage());
        assertThrows(ApiException.class, () -> SkinTexture.validate(png(32, 16, 3, "png")));
        assertThrows(ApiException.class, () -> SkinTexture.validate(png(32, 16, 200, "gif"))); // GIF bytes, PNG label
        assertThrows(ApiException.class, () -> SkinTexture.validate("data:image/png;base64,AAAA"));
        assertThrows(ApiException.class, () -> SkinTexture.validate(null));
    }
}
