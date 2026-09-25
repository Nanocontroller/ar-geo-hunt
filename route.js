window.unionMarketRoute = [
  {
    id: 'cp-1',
    name: 'Union Market',
    lat: 38.908306,
    lng: -76.997250,
    radius: 20,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'Our first sight!',
      text: `You made it to home base. It all started here. Forgotten I.D., lots of questions, too much noise, and the desire to learn more about you.... Next hint: let's go to a more quiet place.`,
      modelUrl: './assets/models/union-market.glb'
    }
  },
  {
    id: 'cp-2',
    name: 'La Cosecha',
    lat: 38.908778,
    lng: -76.999444,
    radius: 18,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'Checkpoint 2',
      text: `This is the part where the mission gets delicious. Buy me a glass of orange wine, and spark the moment, I'll buy you some Malbec. Then find the next clue and pretend you are not already planning your next drink. Nuestra etapa de querer ser sofisticadas duró exactamente lo que tardaron en decirnos 'estamos cerrando'. Pedir una copa de vino y que te corran de inmediato fue claramente una señal del universo para acelerar las cosas.`,
      modelUrl: './assets/models/la_cosecha.glb'
    }
  },
  {
    id: 'cp-3',
    name: 'Red Bear Brewing',
    lat: 38.905570,
    lng: -77.002481,
    radius: 18,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'Checkpoint 5',
      text: `The plot thickens. You have survived the adventure, the snacks, and the walking. El nivel crítico. Tuvimos miradas, una tarjeta de débito rebelde que necesitó el rescate de Evan por teléfono, y yo soltando un 'te quiero besar'. Lo más importante de esta parada: tu audacia impecable para autoinvitarte a mi departamento. The final prize is not far away — and it is the kind of place you are allowed to invite yourselves to.`,
      modelUrl: './assets/models/red_bear_brewing.glb'
    }
  },
  {
    id: 'cp-4',
    name: 'The Rigby',
    lat: 38.906031,
    lng: -77.002184,
    radius: 20,
    bloom: { strength: 1.1, threshold: 0.8, radius: 0.6 },
    clue: {
      title: 'A pleasant surprise',
      text: `"Yes, we absolutely can invite ourselves here." Mission complete — you found the anniversary prize. El lugar de la vista espectacular y el verdadero inicio de nuestra historia. De sobrevivir pizzas crudas y desalojos, a 2 años increíbles juntas.`,
      modelUrl: './assets/models/the_rigby.glb'
    }
  },
  {
    id: 'cp-5',
    name: 'Final',
    // Placeholder coordinates (REI) until the real brunch spot is chosen.
    lat: 38.9053987,
    lng: -77.0028936,
    radius: 50,
    final: true,
    bloom: { strength: 1.4, threshold: 0.7, radius: 0.7 },
    clue: {
      title: 'And the adventure continues',
      text: `Are you willing to continue the adventure with me and expand beyond NoMa to the world?\nI love you!`,
      modelUrl: './assets/models/the_globe.glb'
    }
  }
];
