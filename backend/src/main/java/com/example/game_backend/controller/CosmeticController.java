package com.example.game_backend.controller;

import com.example.game_backend.entity.Cosmetic;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.SkinTexture;
import com.example.game_backend.repository.CosmeticRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.AdminAccess;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Pattern;

/** US-30: administrators publish cosmetic items; the pictures are public. */
@RestController
@RequestMapping("/api")
public class CosmeticController {
    private static final Pattern DATA_URL = Pattern.compile("^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$");
    private static final int MAX_IMAGE_CHARS = 700_000;

    private final CosmeticRepository cosmetics;
    private final UserRepository users;
    private final TokenService tokens;
    private final AdminAccess admins;

    public CosmeticController(CosmeticRepository cosmetics, UserRepository users, TokenService tokens, AdminAccess admins) {
        this.admins = admins;
        this.cosmetics = cosmetics;
        this.users = users;
        this.tokens = tokens;
    }

    private void requireAdmin(String auth) {
        admins.require(auth);
    }

    @GetMapping("/admin/cosmetics")
    public ResponseEntity<List<Map<String, Object>>> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Cosmetic c : cosmetics.findAllByOrderByIdDesc()) out.add(view(c));
        return ResponseEntity.ok(out);
    }

    /** A new store skin: a pixel texture from the editor ("texture"), or, for older clients, a picture ("image"). */
    @PostMapping("/admin/cosmetics")
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body,
                                                       @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        Cosmetic c = new Cosmetic();
        applyNameAndPrice(c, body);
        Object texture = body.get("texture");
        if (texture != null) {
            SkinTexture.validate(texture.toString());
            c.setTexture(texture.toString());
            c.setImage(texture.toString()); // the picture column is required; the texture doubles as it
            c.setSeasonReward(Boolean.TRUE.equals(body.get("seasonReward")));
            return ResponseEntity.ok(view(cosmetics.save(c)));
        }
        String image = body.get("image") == null ? "" : body.get("image").toString();
        if (!DATA_URL.matcher(image).matches() || image.length() > MAX_IMAGE_CHARS) {
            throw new ApiException(400, "Upload a PNG, JPEG, WebP or GIF image (under about 500 KB)").with("field", "image");
        }
        c.setImage(image);
        return ResponseEntity.ok(view(cosmetics.save(c)));
    }

    /** Edit a skin made in the editor: name, price and texture (players who own it keep it). */
    @PutMapping("/admin/cosmetics/{id}")
    public ResponseEntity<Map<String, Object>> update(@PathVariable long id, @RequestBody Map<String, Object> body,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        Cosmetic c = cosmetics.findById(id).orElseThrow(() -> new ApiException(404, "Item not found"));
        applyNameAndPrice(c, body);
        Object texture = body.get("texture");
        if (texture != null) {
            SkinTexture.validate(texture.toString());
            c.setTexture(texture.toString());
            c.setImage(texture.toString());
        }
        // an already awarded prize stays a prize (its winners keep it, nobody can buy it)
        if (body.containsKey("seasonReward") && c.getAwardedSeason() == null) {
            c.setSeasonReward(Boolean.TRUE.equals(body.get("seasonReward")));
        }
        return ResponseEntity.ok(view(cosmetics.save(c)));
    }

    /** The texture of an editor-made skin, for the admin editor to load it again. */
    @GetMapping("/admin/cosmetics/{id}/texture")
    public ResponseEntity<Map<String, Object>> textureForEditing(@PathVariable long id,
                                                                 @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        Cosmetic c = cosmetics.findById(id).orElseThrow(() -> new ApiException(404, "Item not found"));
        Map<String, Object> m = view(c);
        m.put("texture", c.getTexture());
        return ResponseEntity.ok(m);
    }

    private static void applyNameAndPrice(Cosmetic c, Map<String, Object> body) {
        String name = body.get("name") == null ? "" : body.get("name").toString().trim();
        if (name.length() < 2 || name.length() > 40) {
            throw new ApiException(400, "Item name must be 2-40 characters").with("field", "name");
        }
        int price;
        try {
            price = Integer.parseInt(String.valueOf(body.get("price")).trim());
        } catch (NumberFormatException e) {
            throw new ApiException(400, "Price must be a whole number").with("field", "price");
        }
        if (price < 0 || price > 1_000_000) {
            throw new ApiException(400, "Price must be between 0 and 1,000,000").with("field", "price");
        }
        c.setName(name);
        c.setPrice(price);
    }

    @PostMapping("/admin/cosmetics/{id}/{action}")
    public ResponseEntity<Map<String, Object>> toggle(@PathVariable long id, @PathVariable String action,
                                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        requireAdmin(auth);
        Cosmetic c = cosmetics.findById(id).orElseThrow(() -> new ApiException(404, "Item not found"));
        if (!action.equals("publish") && !action.equals("withdraw")) throw new ApiException(404, "Unknown action");
        c.setPublished(action.equals("publish"));
        return ResponseEntity.ok(view(cosmetics.save(c)));
    }

    /** Public: the texture of an animated skin (404 for an older picture-only item). */
    @GetMapping("/cosmetics/{skinId}/texture")
    public ResponseEntity<byte[]> texture(@PathVariable String skinId) {
        Cosmetic c = bySkinId(skinId);
        if (c == null || c.getTexture() == null) return ResponseEntity.notFound().build();
        String data = c.getTexture();
        return ResponseEntity.ok()
                .header("Content-Type", "image/png")
                // short: an admin may redraw the skin
                .header("Cache-Control", "public, max-age=60")
                .header("X-Content-Type-Options", "nosniff")
                .body(Base64.getDecoder().decode(data.substring(data.indexOf(',') + 1)));
    }

    private Cosmetic bySkinId(String skinId) {
        if (!skinId.startsWith("c_")) return null;
        try {
            return cosmetics.findById(Long.parseLong(skinId.substring(2))).orElse(null);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @GetMapping("/cosmetics/{skinId}/image")
    public ResponseEntity<byte[]> image(@PathVariable String skinId) {
        if (!skinId.startsWith("c_")) return ResponseEntity.notFound().build();
        Cosmetic c;
        try {
            c = cosmetics.findById(Long.parseLong(skinId.substring(2))).orElse(null);
        } catch (NumberFormatException e) {
            return ResponseEntity.notFound().build();
        }
        if (c == null) return ResponseEntity.notFound().build();
        String data = c.getImage();
        int comma = data.indexOf(',');
        String type = data.substring(5, data.indexOf(';'));
        try {
            return ResponseEntity.ok()
                    .header("Content-Type", type)
                    .header("Cache-Control", "public, max-age=300")
                    .header("X-Content-Type-Options", "nosniff")
                    .body(Base64.getDecoder().decode(data.substring(comma + 1)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private static Map<String, Object> view(Cosmetic c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getSkinId());
        m.put("name", c.getName());
        m.put("price", c.getPrice());
        m.put("published", c.isPublished());
        m.put("animated", c.getTexture() != null);
        m.put("seasonReward", c.isSeasonReward());
        m.put("awardedSeason", c.getAwardedSeason());
        return m;
    }
}
