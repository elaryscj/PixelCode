package com.example.game_backend.entity;

import jakarta.persistence.*;

/** A skin published by an administrator (US-30). Built-in skins live in SkinCatalog. */
@Entity
@Table(name = "cosmetics")
public class Cosmetic {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private int price;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String image;
    @Column(nullable = false)
    private boolean published = true;
    /**
     * The skin as a pixel texture (PNG data URL, SkinTexture.WIDTH x HEIGHT; layout in frontend game/skinRig.ts),
     * animated by the client. Null for older items that are a single picture (`image`).
     */
    @Column(columnDefinition = "TEXT")
    private String texture;

    public Long getId() { return id; }
    public String getSkinId() { return "c_" + id; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public int getPrice() { return price; }
    public void setPrice(int v) { this.price = v; }
    public String getImage() { return image; }
    public void setImage(String v) { this.image = v; }
    public boolean isPublished() { return published; }
    public void setPublished(boolean v) { this.published = v; }
    public String getTexture() { return texture; }
    public void setTexture(String v) { this.texture = v; }
}
