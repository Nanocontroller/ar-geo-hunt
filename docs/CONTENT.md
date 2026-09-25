# Hunt Content & Copy

One place to fine-tune all wording and see which 3D model belongs to each stop.

- **Stops, clues, and models** → edit `route.js`
- **Screen copy** (intro, victory, AR labels, buttons) → edit `index.html`
- **Status / system messages** → edit `app.js`

After editing any of `route.js`, `styles.css`, or `app.js`, bump the `?v=N` number on that file in `index.html` so phones don't load a stale cached version.

---
Here is the updated layout for your `CONTENT.md` and `route.js` files, making **Euonia** the grand finale where you ask her to keep exploring the world with you.

I kept the spinning holographic globe model for this stop, as it perfectly matches the theme of exploring the world together!

---

### 📍 1. Stops — locations, pop-ups, and models (`route.js` & `CONTENT.md`)

**Stop 1 — Union Market**

* **Location:** 38.908306, -76.997250 · arrival radius 20 m
* **3D model:** `assets/models/union-market.glb`
* **Pop-up title:** Interrogations & Bad Spritzes
* **Pop-up message:** Where it all started. I drank a terrible spritz, you had a beer and generously paid because I had no ID. I also interrogated you with a million questions. Time to move.

**Stop 2 — La Cosecha / Grand Cata**

* **Location:** 38.908778, -76.999444 · arrival radius 18 m
* **3D model:** `assets/models/la_cosecha.glb`
* **Pop-up title:** Would you buy me a drink?
* **Pop-up message:** I ordered that weird orange wine you absolutely hated, and you stuck to a solid Malbec. Then we got kicked out almost immediately. The universe was clearly telling us to hurry up.

**Stop 3 — La Cervecería**

* *(Keep your existing coordinates/radius here)*
* **3D model:** `assets/models/red_bear_brewing.glb`
* **Pop-up title:** Bold Moves Only
* **Pop-up message:** Over my cider and your IPA, the flirting leveled up. I told you I wanted to kiss you, your debit card crashed until Evan saved the day, and you smoothly invited yourself to my place. Iconic.

**Stop 4 — The Apartment**

* *(Keep your existing coordinates/radius here)*
* **3D model:** `assets/models/the_rigby.glb`
* **Pop-up title:** The Setup
* **Pop-up message:** We made it. I showed off the view, you stayed, and the rest is history. This is where the real relationship actually began.

**Stop 5 — Euonia (Final Stop)**

* *(Insert Euonia's coordinates here)* · arrival radius 20 m
* **3D model:** `assets/models/the_world.glb` *(The holographic spinning globe)*
* **Pop-up title:** Final Checkpoint: Euonia
* **Pop-up message:** We survived the chaos of date one, and now we have a whole world left to discover. 
Jess, will you continue with me and explore our lives and the world together? 
Happy Anniversary!

---

### 📱 2. Screen copy (`index.html` & `CONTENT.md`)

**Opening screen (intro)**

* **Eyebrow:** 2-Year Anniversary
* **Title:** Tinder, a date of chaos and romance
* **Paragraph 1:** Welcome, Jess. Your mission is simple: follow the coordinates, remember how we survived our first date without valid IDs or working debit cards, and make it to the final surprise.
* **Paragraph 2:** Stay silly, and try to arrive at the final surprise without getting too distracted by my presence. The final prize may be a new plan... or it may be a very good excuse to invite yourself over again.
* **Button:** Begin the adventure!

**Victory screen (When she closes the Euonia pop-up)**

**Eyebrow:** Happy 2-Year Anniversary
**Title:** We survived the first date chaos. Now, will you accept the ultimate challenge to explore the rest of the world with me undefinetly?
**Button:** Yes, I'm in!

*(The rest of the UI and system messages remain exactly the same as your previous setup!)*