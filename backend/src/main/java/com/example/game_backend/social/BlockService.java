package com.example.game_backend.social;

import com.example.game_backend.entity.PlayerBlock;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.FriendshipRepository;
import com.example.game_backend.repository.PlayerBlockRepository;
import com.example.game_backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Blocking a player: any friendship or request between the two is removed, and from then on neither can send
 * the other friend requests or duels, join the other's room, watch the other's matches, or be paired in Quick Play.
 * The blocked player is not told; they just see the generic "not possible" answers.
 */
@Service
public class BlockService {
    public static final int MAX_BLOCKS = 500;

    private final PlayerBlockRepository blocks;
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final TransactionTemplate tx;

    public BlockService(PlayerBlockRepository blocks, FriendshipRepository friendships, UserRepository users,
                        PlatformTransactionManager tm) {
        this.blocks = blocks;
        this.friendships = friendships;
        this.users = users;
        this.tx = new TransactionTemplate(tm);
    }

    public boolean blockedEitherWay(long a, long b) {
        return a != b && blocks.existsEitherWay(a, b);
    }

    public List<Map<String, Object>> list(long me) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (PlayerBlock b : blocks.findByBlockerIdOrderByCreatedAtDesc(me)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", b.getBlockedId());
            m.put("username", users.findById(b.getBlockedId()).map(User::getUsername).orElse("?"));
            m.put("since", b.getCreatedAt().toString());
            out.add(m);
        }
        return out;
    }

    public Map<String, Object> block(long me, long userId) {
        if (me == userId) {
            throw new ApiException(400, "You cannot block yourself");
        }
        User target = users.findById(userId).filter(u -> !u.isBot())
                .orElseThrow(() -> new ApiException(404, "Player not found"));
        return tx.execute(st -> {
            if (blocks.findByBlockerIdAndBlockedId(me, userId).isEmpty()) {
                if (blocks.countByBlockerId(me) >= MAX_BLOCKS) {
                    throw new ApiException(409, "Your block list is full");
                }
                blocks.save(new PlayerBlock(me, userId));
            }
            friendships.findPair(me, userId).ifPresent(friendships::delete);
            return Map.<String, Object>of("blocked", true, "username", target.getUsername());
        });
    }

    public void unblock(long me, long userId) {
        tx.executeWithoutResult(st -> blocks.findByBlockerIdAndBlockedId(me, userId).ifPresent(blocks::delete));
    }

    public void deleteFor(long userId) {
        tx.executeWithoutResult(st -> blocks.deleteAllFor(userId));
    }
}
