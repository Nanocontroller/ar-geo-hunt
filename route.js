window.unionMarketRoute = [
  {
    id: 'cp-1',
    name: 'Union Market',
    lat: 38.908306,
    lng: -76.997250,
    radius: 20,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'Interrogations & Bad Drinks',
      text: `Where it all started. I drank a terrible spritzer, you had a beer and generously paid because I had no ID. I also interrogated you with a million questions. Time to move.`,
      modelUrl: './assets/models/union-market.glb'
    }
  },
  {
    id: 'cp-2',
    name: 'La Cosecha / Grand Cata',
    lat: 38.908778,
    lng: -76.999444,
    radius: 18,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'Would you buy me a drink?',
      text: `I ordered that weird orange wine you absolutely hated, and you stuck to a solid Malbec. Then we got kicked out almost immediately. The universe was clearly telling us to hurry up.`,
      modelUrl: './assets/models/la_cosecha.glb'
    }
  },
  {
    id: 'cp-3',
    name: 'La Cervecería',
    lat: 38.905570,
    lng: -77.002481,
    radius: 18,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'Bold Moves Only',
      text: `Over my cider and your IPA, the flirting leveled up. I told you I wanted to kiss you, your debit card crashed until Evan saved the day, and you smoothly invited yourself to my place. Iconic!`,
      modelUrl: './assets/models/red_bear_brewing.glb'
    }
  },
  {
    id: 'cp-4',
    name: 'The Apartment',
    lat: 38.906031,
    lng: -77.002184,
    radius: 20,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'The Setup',
      text: `We made it. I showed off the view, you stayed, and the rest is history. I ♥️ YOU`,
      modelUrl: './assets/models/the_rigby.glb'
    }
  },
  {
    id: 'cp-5',
    name: 'Final Stop',
    // Euonia (old Eunia coordinates) — the grand finale.
    lat: 38.907966,
    lng: -77.001971,
    radius: 20,
    final: true,
    bloom: { strength: 1.4, threshold: 0.7, radius: 0.7 },
    clue: {
      title: 'Thank you querida!',
      text: `Time flies when you're having fun. Now we have a whole world left to discover.\nHappy Anniversary!`,
      modelUrl: './assets/models/the_world.glb'
    }
  }
];
