package com.example.game_backend.social;

import com.example.game_backend.entity.Friendship;
import com.example.game_backend.entity.User;
import com.example.game_backend.error.ApiException;
import com.example.game_backend.repository.FriendshipRepository;
import com.example.game_backend.repository.UserRepository;
import com.example.game_backend.security.TokenService;
import com.example.game_backend.service.RoomService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Friends: requests by username, the friend list with online / in-match status, and duel challenges.
 * A challenge opens (or reuses) the challenger's private room and shows the friend an invitation
 * wherever they are in the game; invitations live in memory for the room's join window.
 */
@Service
public class FriendService {
    public static final int MAX_FRIENDS = 100;
    public static final int MAX_OUTGOING = 30;
    static final long ONLINE_MS = 2 * 60_000L;
    static final long INVITE_MS = 5 * 60_000L;

    public record Invite(long fromUserId, String fromName, String code, long expiresAt) {
    }

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final TokenService tokens;
    private final RoomService rooms;
    private final TransactionTemplate tx;
    private final SimpMessagingTemplate messaging;
    /** invited user id -> open invitations */
    private final Map<Long, List<Invite>> invites = new ConcurrentHashMap<>();
    private final Object lock = new Object();

    public FriendService(FriendshipRepository friendships, UserRepository users, TokenService tokens, RoomService rooms,
                         PlatformTransactionManager tm, SimpMessagingTemplate messaging) {
        this.messaging = messaging;
        this.friendships = friendships;
        this.users = users;
        this.tokens = tokens;
        this.rooms = rooms;
        this.tx = new TransactionTemplate(tm);
    }

    // ---------------------------------------------------------------- list

    public Map<String, Object> list(long me) {
        List<Map<String, Object>> friends = new ArrayList<>();
        List<Map<String, Object>> incoming = new ArrayList<>();
        List<Map<String, Object>> outgoing = new ArrayList<>();
        for (Friendship f : friendships.findAllFor(me)) {
            User other = users.findById(f.other(me)).orElse(null);
            if (other == null) {
                continue;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("requestId", f.getId());
            m.put("userId", other.getId());
            m.put("username", other.getUsername());
            m.put("rating", other.getRating());
            m.put("activeSkin", other.getActiveSkin());
            if (f.isAccepted()) {
                m.put("status", status(other.getId()));
                friends.add(m);
            } else if (f.getAddresseeId() == me) {
                incoming.add(m);
            } else {
                outgoing.add(m);
            }
        }
        // online first, then in a match, then offline; by name inside each group
        friends.sort((a, b) -> {
            int c = Integer.compare(rank((String) a.get("status")), rank((String) b.get("status")));
            return c != 0 ? c : ((String) a.get("username")).compareToIgnoreCase((String) b.get("username"));
        });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("friends", friends);
        out.put("incoming", incoming);
        out.put("outgoing", outgoing);
        return out;
    }

    private static int rank(String status) {
        return switch (status) {
            case "ONLINE" -> 0;
            case "IN_MATCH" -> 1;
            default -> 2;
        };
    }

    /** ONLINE, IN_MATCH (in a lobby or a running match) or OFFLINE */
    String status(long userId) {
        Map<String, Object> room = rooms.mine(userId);
        if (room != null && !"WAITING".equals(String.valueOf(room.get("roomStatus")))) {
            return "IN_MATCH";
        }
        return System.currentTimeMillis() - tokens.lastActive(userId) < ONLINE_MS ? "ONLINE" : "OFFLINE";
    }

    // ---------------------------------------------------------------- requests

    public Map<String, Object> request(long me, String username) {
        String name = username == null ? "" : username.trim();
        if (name.isEmpty()) {
            throw new ApiException(400, "Enter a player's name").with("field", "username");
        }
        synchronized (lock) {
            return tx.execute(st -> {
                User target = users.findByUsernameIgnoreCase(name)
                        .filter(u -> !u.isBot())
                        .orElseThrow(() -> new ApiException(404, "Player not found").with("field", "username"));
                if (target.getId() == me) {
                    throw new ApiException(400, "You cannot add yourself").with("field", "username");
                }
                Friendship existing = friendships.findPair(me, target.getId()).orElse(null);
                if (existing != null) {
                    if (existing.isAccepted()) {
                        throw new ApiException(409, "You are already friends").with("field", "username");
                    }
                    if (existing.getRequesterId() == me) {
                        throw new ApiException(409, "Friend request already sent").with("field", "username");
                    }
                    // they asked first: this is a yes
                    existing.setAccepted(true);
                    friendships.save(existing);
                    poke(target.getId(), "FRIEND_ACCEPTED");
                    return Map.<String, Object>of("accepted", true, "username", target.getUsername());
                }
                List<Friendship> mine = friendships.findAllFor(me);
                if (mine.stream().filter(Friendship::isAccepted).count() >= MAX_FRIENDS) {
                    throw new ApiException(409, "Your friend list is full").with("field", "username");
                }
                if (mine.stream().filter(f -> !f.isAccepted() && f.getRequesterId() == me).count() >= MAX_OUTGOING) {
                    throw new ApiException(409, "Too many requests are waiting for an answer").with("field", "username");
                }
                friendships.save(new Friendship(me, target.getId()));
                poke(target.getId(), "FRIEND_REQUEST");
                return Map.<String, Object>of("accepted", false, "username", target.getUsername());
            });
        }
    }

    public void accept(long me, long requestId) {
        synchronized (lock) {
            tx.executeWithoutResult(st -> {
                Friendship f = friendships.findById(requestId)
                        .filter(x -> x.getAddresseeId() == me && !x.isAccepted())
                        .orElseThrow(() -> new ApiException(404, "Friend request not found"));
                f.setAccepted(true);
                friendships.save(f);
                poke(f.getRequesterId(), "FRIEND_ACCEPTED");
            });
        }
    }

    /** decline a request, cancel your own, or remove a friend */
    public void remove(long me, long requestId) {
        synchronized (lock) {
            tx.executeWithoutResult(st -> {
                Friendship f = friendships.findById(requestId)
                        .filter(x -> x.getRequesterId() == me || x.getAddresseeId() == me)
                        .orElseThrow(() -> new ApiException(404, "Friend request not found"));
                friendships.delete(f);
            });
        }
    }

    public long pendingFor(long me) {
        return friendships.countByAddresseeIdAndAcceptedFalse(me);
    }

    public void deleteFor(long userId) {
        tx.executeWithoutResult(st -> friendships.deleteAllFor(userId));
        invites.remove(userId);
    }

    // ---------------------------------------------------------------- duel challenges

    /** Opens the challenger's private room (or reuses their waiting one) and invites the friend into it. */
    public Map<String, Object> challenge(long me, long friendId) {
        Friendship f = friendships.findPair(me, friendId).filter(Friendship::isAccepted)
                .orElseThrow(() -> new ApiException(404, "This player is not your friend"));
        String st = status(f.other(me));
        if (!"ONLINE".equals(st)) {
            throw new ApiException(409, "IN_MATCH".equals(st) ? "Your friend is in a match right now" : "Your friend is offline");
        }
        Map<String, Object> room = rooms.createRoom(me); // throws "already in a match" for a running one
        String code = String.valueOf(room.get("code"));
        String myName = users.findById(me).map(User::getUsername).orElse("?");
        List<Invite> list = invites.computeIfAbsent(friendId, k -> new CopyOnWriteArrayList<>());
        list.removeIf(i -> i.fromUserId() == me);
        list.add(new Invite(me, myName, code, System.currentTimeMillis() + INVITE_MS));
        poke(friendId, "DUEL_INVITE");
        return room;
    }

    /** Open invitations for this player (only rooms that still wait for a second player). */
    public List<Map<String, Object>> invitesFor(long me) {
        List<Invite> list = invites.get(me);
        List<Map<String, Object>> out = new ArrayList<>();
        if (list == null) {
            return out;
        }
        long now = System.currentTimeMillis();
        list.removeIf(i -> i.expiresAt() < now || !stillWaiting(i));
        for (Invite i : list) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("fromUserId", i.fromUserId());
            m.put("fromName", i.fromName());
            m.put("code", i.code());
            m.put("expiresAt", i.expiresAt());
            out.add(m);
        }
        return out;
    }

    private boolean stillWaiting(Invite i) {
        try {
            Map<String, Object> room = rooms.getRoom(i.code());
            return "WAITING".equals(String.valueOf(room.get("roomStatus")));
        } catch (ApiException e) {
            return false;
        }
    }

    /** Instant nudge on the player's private channel; the client then reloads what changed. */
    void poke(long userId, String type) {
        try {
            messaging.convertAndSend("/topic/inbox/" + tokens.inboxChannel(userId), (Object) Map.of("type", type));
        } catch (RuntimeException ignored) {
            // the client also polls, so a lost nudge only delays things a little
        }
    }

    public void dismissInvite(long me, String code) {
        List<Invite> list = invites.get(me);
        if (list != null) {
            list.removeIf(i -> i.code().equalsIgnoreCase(code));
        }
    }
}
