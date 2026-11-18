package com.example.game_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.ColumnDefault;

import java.time.Instant;

@Entity
@Table(name = "users")
// UPDATE only the columns that changed: saving a profile edit can never write back a stale balance or rating
@org.hibernate.annotations.DynamicUpdate
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, columnDefinition = "integer default 1500")
    private int rating = 1500;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private int wins = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private int losses = 0;

    @Column
    private Instant bannedUntil;

    @Column
    private String email;

    @Column(columnDefinition = "text")
    private String avatarUrl;

    @Column(nullable = false, columnDefinition = "integer default 1000")
    private int pixels = 1000;

    @Column(nullable = false, columnDefinition = "text default 'neon_ronin'")
    private String ownedSkins = "neon_ronin";

    // Length and default are kept separate: a combined columnDefinition makes ddl-auto=update
    // emit an invalid "alter column ... set data type varchar(64) default ..." on every start.
    @Column(nullable = false, length = 64)
    @ColumnDefault("'neon_ronin'")
    private String activeSkin = "neon_ronin";

    /** Admin rights belong to this account (not to whoever holds the name). See AdminAccess. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean admin = false;

    /** May run lessons (teacher mode): a free trial or a subscription (until teacherUntil), set in /admin. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean teacher = false;
    /** end of the teacher subscription / trial; null with teacher = true means no end (granted for good) */
    private Instant teacherUntil;
    /** the free teacher trial can be started once per account */
    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean teacherTrialUsed = false;

    /** The ADMIN_USERNAMES entry that granted `admin`; removing it from the config revokes the rights. */
    @Column
    private String adminGrant;

    /** The built-in opponent PIXEL_BOT: cannot log in, never listed on the leaderboard. */
    @Column(nullable = false)
    @ColumnDefault("false")
    private boolean bot = false;

    /** Bumped on password change/reset: every login token issued before that stops working. */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int tokenVersion = 0;

    /** Progress counters for achievements (see game/ProgressService). */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int doorsSolved = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private int hardDoorsSolved = 0;

    /** ranked wins in a row (a loss or draw resets it) */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int winStreak = 0;

    /** ranked matches in the current season: the season top 10 only counts players with a few of them */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int seasonMatches = 0;

    /** when the player last opened the PROGRESS screen: newer quests / achievements / season places are "new" */
    @Column
    private Instant progressSeenAt;

    /** days in a row the player opened the game (daily login reward) and the last such UTC day */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int loginStreak = 0;

    @Column
    private java.time.LocalDate lastLoginDay;

    public User() {
    }

    public User(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }
    public int getWins() { return wins; }
    public void setWins(int wins) { this.wins = wins; }
    public int getLosses() { return losses; }
    public void setLosses(int losses) { this.losses = losses; }
    public Instant getBannedUntil() { return bannedUntil; }
    public void setBannedUntil(Instant bannedUntil) { this.bannedUntil = bannedUntil; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public int getPixels() { return pixels; }
    public void setPixels(int pixels) { this.pixels = pixels; }
    public String getOwnedSkins() { return ownedSkins; }
    public void setOwnedSkins(String ownedSkins) { this.ownedSkins = ownedSkins; }
    public String getActiveSkin() { return activeSkin; }
    public void setActiveSkin(String activeSkin) { this.activeSkin = activeSkin; }

    public boolean isAdmin() { return admin; }
    public void setAdmin(boolean admin) { this.admin = admin; }
    public boolean isTeacher() { return teacher; }
    public void setTeacher(boolean teacher) { this.teacher = teacher; }
    public Instant getTeacherUntil() { return teacherUntil; }
    public void setTeacherUntil(Instant teacherUntil) { this.teacherUntil = teacherUntil; }
    public boolean isTeacherTrialUsed() { return teacherTrialUsed; }
    public void setTeacherTrialUsed(boolean teacherTrialUsed) { this.teacherTrialUsed = teacherTrialUsed; }

    /** Teacher mode right now: granted, and the subscription / trial has not run out. */
    public boolean hasTeacherAccess() {
        return teacher && (teacherUntil == null || teacherUntil.isAfter(Instant.now()));
    }
    public String getAdminGrant() { return adminGrant; }
    public void setAdminGrant(String adminGrant) { this.adminGrant = adminGrant; }
    public int getTokenVersion() { return tokenVersion; }
    public void setTokenVersion(int tokenVersion) { this.tokenVersion = tokenVersion; }

    public boolean isBot() { return bot; }
    public void setBot(boolean bot) { this.bot = bot; }

    public int getDoorsSolved() { return doorsSolved; }
    public void setDoorsSolved(int doorsSolved) { this.doorsSolved = doorsSolved; }
    public int getHardDoorsSolved() { return hardDoorsSolved; }
    public void setHardDoorsSolved(int hardDoorsSolved) { this.hardDoorsSolved = hardDoorsSolved; }
    public int getWinStreak() { return winStreak; }
    public void setWinStreak(int winStreak) { this.winStreak = winStreak; }
    public int getSeasonMatches() { return seasonMatches; }
    public void setSeasonMatches(int seasonMatches) { this.seasonMatches = seasonMatches; }

    public Instant getProgressSeenAt() { return progressSeenAt; }
    public void setProgressSeenAt(Instant progressSeenAt) { this.progressSeenAt = progressSeenAt; }

    public int getLoginStreak() { return loginStreak; }
    public void setLoginStreak(int loginStreak) { this.loginStreak = loginStreak; }
    public java.time.LocalDate getLastLoginDay() { return lastLoginDay; }
    public void setLastLoginDay(java.time.LocalDate lastLoginDay) { this.lastLoginDay = lastLoginDay; }

    public boolean isBanned() {
        return bannedUntil != null && bannedUntil.isAfter(Instant.now());
    }
}
