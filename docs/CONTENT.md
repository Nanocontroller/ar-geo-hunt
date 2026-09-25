# Hunt Content & Copy

One place to fine-tune all wording and see which 3D model belongs to each stop.

- **Stops, clues, and models** → edit `route.js`
- **Screen copy** (intro, victory, AR labels, buttons) → edit `index.html`
- **Status / system messages** → edit `app.js`

After editing any of `route.js`, `styles.css`, or `app.js`, bump the `?v=N` number on that file in `index.html` so phones don't load a stale cached version.

---

## 1. Stops — locations, pop-ups, and models

Edit these in `route.js`. Each stop's pop-up shows a **title** and a **message** when the player arrives.


### Stop 1 — Union Market
- **Location:** 38.908306, -76.997250 · arrival radius 20 m
- **3D model:** `assets/models/union-market.glb`
- **Pop-up title:** Our first sight!
- **Pop-up message:** You made it to home base. It all started here. Forgotten I.D., lots of questions,too mich noise, and the desire to learn more about you.... Next hint: let's go to a more quiet place.

### Stop 2 — La Cosecha
- **Location:** 38.908778, -76.999444 · arrival radius 18 m
- **3D model:** `assets/models/la_cosecha.glb`
- **Pop-up title:** Checkpoint 2
- **Pop-up message:** This is the part where the mission gets delicious. Buy me a glass of orange wine, and spark the moment, I'll buy you some Malbec. Then find the next clue and pretend you are not already planning your next drink.  Nuestra etapa de querer ser sofisticadas duró exactamente lo que tardaron en decirnos 'estamos cerrando'. Pedir una copa de vino y que te corran de inmediato fue claramente una señal del universo para acelerar las cosas.

### Stop 3 — Red Bear Brewing
- **Location:** 38.905570, -77.002481 · arrival radius 18 m
- **3D model:** `assets/models/red_bear_brewing.glb`
- **Pop-up title:** Checkpoint 5
- **Pop-up message:** The plot thickens. You have survived the adventure, the snacks, and the walking. 
El nivel crítico. Tuvimos miradas, una tarjeta de débito rebelde que necesitó el rescate de Evan por teléfono, y yo soltando un 'te quiero besar'. Lo más importante de esta parada: tu audacia impecable para autoinvitarte a mi departamento. The final prize is not far away — and it is the kind of place you are allowed to invite yourselves to.

### Stop 4 — The Rigby
- **Location:** 38.906031, -77.002184 · arrival radius 20 m
- **3D model:** `assets/models/the_rigby.glb`
- **Pop-up title:** A pleasant surprise
- **Pop-up message:**  "Yes, we absolutely can invite ourselves here." Mission complete — you found the anniversary prize. El lugar de la vista espectacular y el verdadero inicio de nuestra historia. De sobrevivir pizzas crudas y desalojos, a 2 años increíbles juntas. 

### Stop 5 -take me for brunch
- **Location: TBD
- **3D model:** `assets/models/the_globe.glb`  ⚠️ not added yet — drop this file in `assets/models/` or the finale model won't show
- **Pop-up title:** And the adventure continues
- **Pop-up message:** Are you willining to continue the adventure with me and expand beyon NoMa to the world? 
I love you!

### Model → stop cheat sheet
The file numbers do **not** match the stop numbers. To swap a stop's model, either replace the file below with your own (same name) or change its `modelUrl` in `route.js`.

| Stop | Name | Model file |
|---|---|---|
| 1 | Union Market | `union-market.glb` |
| 2 | La Cosecha | `la_cosecha.glb` |
| 3 | Red Bear Brewing | `red_bear_brewing.glb` |
| 4 | The Rigby | `the_rigby.glb` |
| 5 | Final | `the_globe.glb` ⚠️ missing |


Models are `.glb` files in `assets/models/`. iOS "place in your space" (Quick Look) auto-converts to USDZ on the fly — no separate file needed.

---

## 2. Screen copy

Edit these in `index.html`.

**Opening screen (intro)**
- Eyebrow: 2 year Anniversary Mission
- Title: Operation: Make It a Memory
- Paragraph 1: Tinder, date of chaos and romance. 
Bienvenida, Jess. Tu misión es simple: seguir las coordenadas, recordar cómo sobrevivimos a nuestra primera cita sin identificaciones válidas, tarjetas de credito negadas y llegar a la sorpresa final.

- Paragraph 2: Stay silly, and arrive at the final surprise without getting too distracted by my presence.The final prize may be a new plan. It may be a very good excuse to invite yourselves somewhere.
- Button: Begin the adventure!



**Info drawer** (tap the status pill)
- Eyebrow: Union Market DC Adventure
- Reset button: Reset Progress

**AR clue overlay**
- Label: AR Clue
- Close button: Close & continue

**Victory screen**
- Eyebrow: Happy 2 year Anniversary
- Title: I love you and challeng you to stay with me!
- Button: Play again

**Other buttons**
- Start Hunt

---

## 3. Status & system messages

Edit these in `app.js`. Mostly automatic — usually no need to change.

**Status pill (by phase)**
- Waiting for GPS · Tracking checkpoint · AR clue ready · Hunt complete

**Distance line**
- "Locating you…" (no GPS yet)
- "6 min · 450 m walk" (walking ETA + distance)
- "120 m" (straight-line fallback)
- "Arrived — hunt complete"

**Victory text (auto):** "You solved 6 of 6 checkpoints and completed the Union Market route."

**Location-permission help (shown if GPS is blocked):** "Safari may be blocking location. Open Settings → Safari → Websites → Location, then retry." (plus a couple of similar variants for denied/blocked states)
