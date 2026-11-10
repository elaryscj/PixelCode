package com.example.game_backend.controller;

import com.example.game_backend.entity.Cosmetic;
import com.example.game_backend.entity.User;
import com.example.game_backend.repository.CosmeticRepository;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.game.SkinCatalog;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/store")
public class StoreController {
    private final UserRepository users;
    private final TokenService tokens;

    private final CosmeticRepository cosmetics;

    public StoreController(UserRepository users, TokenService tokens, CosmeticRepository cosmetics) {
        this.users = users;
        this.tokens = tokens;
        this.cosmetics = cosmetics;
    }

    /** Price of a built-in skin or a published admin item, or null when it cannot be bought. */
    private Integer priceOf(String skinId) {
        if (SkinCatalog.exists(skinId)) return SkinCatalog.PRICES.get(skinId);
        if (skinId.startsWith("c_")) {
            try {
                return cosmetics.findById(Long.parseLong(skinId.substring(2)))
                        .filter(Cosmetic::isPublished).map(Cosmetic::getPrice).orElse(null);
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> state(@RequestHeader(value = "Authorization", required = false) String auth) {
        return ResponseEntity.ok(view(load(tokens.requireUserId(auth))));
    }

    @PostMapping("/buy/{skinId}")
    @Transactional
    public ResponseEntity<Map<String, Object>> buy(@PathVariable String skinId,
                                                   @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = load(tokens.requireUserId(auth));
        Integer found = priceOf(skinId);
        if (found == null) {
            throw new ApiException(404, "Unknown skin");
        }
        Set<String> owned = owned(u);
        if (owned.contains(skinId)) {
            throw new ApiException(409, "You already own this skin");
        }
        int price = found;
        if (u.getPixels() < price) {
            throw new ApiException(402, "Insufficient PIXELS balance").with("missing", price - u.getPixels());
        }
        u.setPixels(u.getPixels() - price);
        owned.add(skinId);
        u.setOwnedSkins(String.join(",", owned));
        u.setActiveSkin(skinId);
        users.save(u);
        return ResponseEntity.ok(view(u));
    }

    @PostMapping("/equip/{skinId}")
    @Transactional
    public ResponseEntity<Map<String, Object>> equip(@PathVariable String skinId,
                                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        User u = load(tokens.requireUserId(auth));
        if (!owned(u).contains(skinId)) {
            throw new ApiException(403, "You do not own this skin");
        }
        u.setActiveSkin(skinId);
        users.save(u);
        return ResponseEntity.ok(view(u));
    }

    private User load(long id) {
        return users.findById(id).orElseThrow(() -> new ApiException(401, "Please log in again"));
    }

    private static Set<String> owned(User u) {
        Set<String> set = new LinkedHashSet<>(Arrays.asList(u.getOwnedSkins().split(",")));
        set.removeIf(String::isBlank);
        set.add("neon_ronin");
        return set;
    }

    private Map<String, Object> view(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("balance", u.getPixels());
        m.put("owned", new ArrayList<>(owned(u)));
        m.put("active", u.getActiveSkin());
        Map<String, Integer> prices = new LinkedHashMap<>(SkinCatalog.PRICES);
        List<Map<String, Object>> catalog = new ArrayList<>();
        for (Cosmetic c : cosmetics.findByPublishedTrueOrderByIdAsc()) {
            prices.put(c.getSkinId(), c.getPrice());
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", c.getSkinId());
            item.put("name", c.getName());
            catalog.add(item);
        }
        m.put("prices", prices);
        m.put("catalog", catalog);
        return m;
    }
}
