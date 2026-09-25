# Hunt Content & Copy

One place to fine-tune all wording and see which 3D model belongs to each stop.

- **Stops, clues, and models** → edit `route.js`
- **Screen copy** (intro, victory, AR labels, buttons) → edit `index.html`
- **Status / system messages** → edit `app.js`

After editing any of `route.js`, `styles.css`, or `app.js`, bump the `?v=N` number on that file in `index.html` so phones don't load a stale cached version.

---

### 📍 1. Stops — locations, pop-ups, and models (`route.js` & `CONTENT.md`)

**Stop 1 — Union Market**

* **Location:** 38.908306, -76.997250 · arrival radius 20 m
* **3D model:** `assets/models/union-market.glb`
* **Pop-up title:** Interrogations & Bad Drinks
* **Pop-up message:** Where it all started. I drank a terrible spritzer, you had a beer and generously paid because I had no ID. I also interrogated you with a million questions. Time to move.

**Stop 2 — La Cosecha / Grand Cata**

* **Location:** 38.908778, -76.999444 · arrival radius 18 m
* **3D model:** `assets/models/la_cosecha.glb`
* **Pop-up title:** Would you buy me a drink?
* **Pop-up message:** I ordered that weird orange wine you absolutely hated, and you stuck to a solid Malbec. Then we got kicked out almost immediately. The universe was clearly telling us to hurry up.

**Stop 3 — La Cervecería**

* *(Keep your existing coordinates/radius here)*
* **3D model:** `assets/models/red_bear_brewing.glb`
* **Pop-up title:** Bold Moves Only
* **Pop-up message:** Over my cider and your IPA, the flirting leveled up. I told you I wanted to kiss you, your debit card crashed until Evan saved the day, and you smoothly invited yourself to my place. Iconic!

**Stop 4 — The Apartment**

* *(Keep your existing coordinates/radius here)*
* **3D model:** `assets/models/the_rigby.glb`
* **Pop-up title:** The Setup
* **Pop-up message:** We made it. I showed off the view, you stayed, and the rest is history. I ♥️ YOU

**Stop 5 — Euonia (Final Stop)**

* *(Euonia's 38.907966 -77.001971)* · arrival radius 20 m
* **3D model:** `assets/models/the_world.glb` *(The holographic spinning globe)*
* **Pop-up title:** Thank you querida!
* **Pop-up message:** Time flies when you're having fun. Now we have a whole world left to discover. 
Happy Anniversary!

---

### 📱 2. Screen copy (`index.html` & `CONTENT.md`)

**Opening screen (intro)**

* **Eyebrow:** our 2 year Anniversary
* **Title:** Tinder, a date of chaos and romance
* **Paragraph 1:** Welcome, Jess. Your mission is simple: follow the coordinates, remember how we survived our first date without valid IDs or working debit cards, and make it to the final surprise.
* **Paragraph 2:** Stay silly, and try to arrive at the final surprise without getting too distracted by my presence. The final prize may be a new plan... or it may be a very good excuse to invite yourself over again.
* **Button:** Begin the adventure!

**Victory screen (When she closes the Euonia pop-up)**

**Eyebrow:** We made it to two years!
**Title:** It was easy, and fun. 
Now, will you accept the ultimate challenge to explore the rest of the world with me undefinetly?
**Button:** I accept!

*(The rest of the UI and system messages remain exactly the same as your previous setup!)*