package com.example.game_backend.security;

import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Administrator rights are a flag on the account. ADMIN_USERNAMES only says which account receives it:
 * the account holding that name at startup or registration. After that the rights stay with the account
 * (a rename does not hand them to someone else) and nobody may rename themselves into a configured name.
 * Removing a name from ADMIN_USERNAMES revokes the rights of the account it granted on the next start.
 */
@Component
public class AdminAccess implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminAccess.class);

    private final Set<String> configured = new HashSet<>();
    private final UserRepository users;
    private final TokenService tokens;

    public AdminAccess(@Value("${game.admin-usernames:}") String admins, UserRepository users, TokenService tokens) {
        for (String a : admins.split(",")) {
            if (!a.isBlank()) {
                configured.add(a.trim().toLowerCase(Locale.ROOT));
            }
        }
        this.users = users;
        this.tokens = tokens;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (User u : users.findByAdminTrue()) {
            if (u.getAdminGrant() == null || !configured.contains(u.getAdminGrant())) {
                log.warn("Revoking admin rights of {} (no longer in ADMIN_USERNAMES)", u.getUsername());
                u.setAdmin(false);
                u.setAdminGrant(null);
                users.save(u);
            }
        }
        for (String name : configured) {
            boolean granted = users.findByAdminTrue().stream().anyMatch(u -> name.equals(u.getAdminGrant()));
            if (!granted) {
                users.findByUsernameIgnoreCase(name).ifPresent(this::grantIfConfigured);
            }
        }
    }

    /** Called at startup and right after registration. */
    public void grantIfConfigured(User u) {
        String name = u.getUsername().toLowerCase(Locale.ROOT);
        if (!configured.contains(name) || u.isAdmin()) {
            return;
        }
        boolean alreadyGranted = users.findByAdminTrue().stream().anyMatch(x -> name.equals(x.getAdminGrant()));
        if (alreadyGranted) {
            return; // that name already made someone admin; a later holder of the name gets nothing
        }
        u.setAdmin(true);
        u.setAdminGrant(name);
        users.save(u);
        log.info("Granted admin rights to user #{} ({})", u.getId(), u.getUsername());
    }

    /** A configured admin name may only be taken at registration, never by renaming. */
    public boolean isReservedName(String username) {
        return username != null && configured.contains(username.toLowerCase(Locale.ROOT));
    }

    public User require(String authorizationHeader) {
        long id = tokens.requireUserId(authorizationHeader);
        User u = users.findById(id).orElseThrow(() -> new ApiException(401, "Please log in again"));
        if (!u.isAdmin()) {
            throw new ApiException(403, "Administrator access required");
        }
        return u;
    }
}
