/**
 * TaaraNight Constellation Dataset
 *
 * Star positions approximate real astronomical configurations,
 * normalized to 0-1 coordinate space.
 * Stories are original bedtime myths written for a calming, sleep-friendly tone.
 */

import type { ConstellationDataset } from './constellations';

export const CONSTELLATION_DATA: ConstellationDataset = {
  constellations: [
    // ===== EASY CONSTELLATIONS (3-5 stars, simple shapes) =====

    {
      id: 'ursa-minor',
      name: 'Little Bear',
      difficulty: 'easy',
      stars: [
        { x: 0.5, y: 0.2 },   // Polaris (North Star)
        { x: 0.45, y: 0.35 },
        { x: 0.4, y: 0.5 },
        { x: 0.55, y: 0.5 },
        { x: 0.6, y: 0.35 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 1 },
      ],
      story: 'The Little Bear wanders the northern sky, forever circling the still point of the heavens. Her brightest star never moves, a gentle beacon for those who feel lost. When you cannot find your way, she reminds you: sometimes standing still is the bravest journey. Close your eyes and let her constancy calm your restless thoughts.'
    },

    {
      id: 'cassiopeia',
      name: 'The Queen\'s Throne',
      difficulty: 'easy',
      stars: [
        { x: 0.3, y: 0.4 },
        { x: 0.4, y: 0.5 },
        { x: 0.5, y: 0.45 },
        { x: 0.6, y: 0.5 },
        { x: 0.7, y: 0.4 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
      ],
      story: 'A queen sits upon her celestial throne, shaped like a gentle W across the midnight canvas. She once boasted of her beauty, but the stars taught her humility. Now she spins gracefully through the seasons, sharing her wisdom: true beauty lies in accepting our place in the vastness. Rest now, knowing you belong exactly where you are.'
    },

    {
      id: 'lyra',
      name: 'The Starlit Harp',
      difficulty: 'easy',
      stars: [
        { x: 0.5, y: 0.3 },   // Vega
        { x: 0.45, y: 0.5 },
        { x: 0.55, y: 0.5 },
        { x: 0.4, y: 0.65 },
        { x: 0.6, y: 0.65 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 1, to: 3 },
        { from: 2, to: 4 },
      ],
      story: 'A harp made of starlight plays melodies only the night can hear. Its strings once belonged to a musician who loved so deeply that even silence became song. The stars remember his music and hum it softly to those who listen. As you drift to sleep, the harp plays just for you—a lullaby woven from moonbeams and memory.'
    },

    {
      id: 'corona-borealis',
      name: 'The Northern Crown',
      difficulty: 'easy',
      stars: [
        { x: 0.4, y: 0.45 },
        { x: 0.45, y: 0.35 },
        { x: 0.5, y: 0.3 },
        { x: 0.55, y: 0.35 },
        { x: 0.6, y: 0.45 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
      ],
      story: 'A crown of seven jewels rests in the northern heavens, placed there by a god who loved a mortal. The gift was meant to say: you are precious beyond measure. Each star in the crown whispers this truth to anyone who gazes up. Tonight, the crown glows for you, a reminder that you are worthy of wonder. Let this thought ease you into dreams.'
    },

    {
      id: 'delphinus',
      name: 'The Dolphin',
      difficulty: 'easy',
      stars: [
        { x: 0.5, y: 0.4 },
        { x: 0.55, y: 0.45 },
        { x: 0.6, y: 0.5 },
        { x: 0.55, y: 0.55 },
        { x: 0.65, y: 0.4 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 1, to: 3 },
        { from: 0, to: 4 },
      ],
      story: 'A small dolphin leaps through the cosmic ocean, carrying stories between the stars. She once saved a poet from drowning, and in gratitude, he gave her a home in the sky. Now she swims through the darkness, bringing messages of hope to weary travelers. Her gift to you tonight: even in the deepest waters, there is always a way to the surface.'
    },

    // ===== MEDIUM CONSTELLATIONS (6-8 stars, moderate complexity) =====

    {
      id: 'orion',
      name: 'The Hunter',
      difficulty: 'medium',
      stars: [
        { x: 0.4, y: 0.25 },  // Betelgeuse
        { x: 0.6, y: 0.25 },
        { x: 0.45, y: 0.45 }, // Belt star 1
        { x: 0.5, y: 0.45 },  // Belt star 2
        { x: 0.55, y: 0.45 }, // Belt star 3
        { x: 0.35, y: 0.65 },
        { x: 0.6, y: 0.7 },   // Rigel
      ],
      connections: [
        { from: 0, to: 2 },
        { from: 1, to: 4 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 2, to: 5 },
        { from: 4, to: 6 },
      ],
      story: 'The Hunter strides across winter skies, his belt a perfect line of three bright stars. He chases not beasts but meaning, searching the cosmos for understanding. Long ago he learned that the greatest hunts are those within—the pursuit of peace, of purpose, of acceptance. His stars glow steady through the cold nights, patient companions for your own quiet quest. Rest, hunter. Tomorrow brings new trails.'
    },

    {
      id: 'cygnus',
      name: 'The Swan',
      difficulty: 'medium',
      stars: [
        { x: 0.5, y: 0.25 },  // Deneb (tail)
        { x: 0.5, y: 0.45 },  // Body center
        { x: 0.35, y: 0.5 },  // Left wing
        { x: 0.65, y: 0.5 },  // Right wing
        { x: 0.5, y: 0.6 },
        { x: 0.5, y: 0.75 },  // Head
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 1, to: 3 },
        { from: 1, to: 4 },
        { from: 4, to: 5 },
      ],
      story: 'A swan glides down the starry river of the Milky Way, wings outstretched in eternal flight. Legends say she carries the souls of stories not yet told, dreams waiting to be dreamed. Her neck stretches toward tomorrow while her wings embrace the now. She teaches a gentle lesson: grace is not the absence of struggle, but the choice to fly anyway. Spread your wings in sleep, and soar.'
    },

    {
      id: 'leo',
      name: 'The Lion',
      difficulty: 'medium',
      stars: [
        { x: 0.35, y: 0.35 },  // Regulus
        { x: 0.4, y: 0.4 },
        { x: 0.5, y: 0.45 },
        { x: 0.6, y: 0.4 },
        { x: 0.65, y: 0.5 },
        { x: 0.55, y: 0.6 },
        { x: 0.45, y: 0.55 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 2, to: 5 },
        { from: 5, to: 6 },
        { from: 6, to: 1 },
      ],
      story: 'The Lion rests among the spring stars, mighty heart beating slow and steady. Once fierce and fearsome, he learned that true strength is knowing when to be gentle. His brightest star, called the King, shines with quiet dignity. He guards the boundary between night and day, protecting the dreams of all who sleep beneath his watch. You are safe. You are strong. Let the Lion\'s courage soothe your worries.'
    },

    {
      id: 'scorpius',
      name: 'The Scorpion',
      difficulty: 'medium',
      stars: [
        { x: 0.4, y: 0.3 },   // Antares (heart)
        { x: 0.45, y: 0.4 },
        { x: 0.5, y: 0.45 },
        { x: 0.55, y: 0.5 },
        { x: 0.6, y: 0.6 },
        { x: 0.65, y: 0.7 },  // Tail
        { x: 0.35, y: 0.35 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 0, to: 6 },
      ],
      story: 'The Scorpion curves through summer nights, tail arched not to strike but to embrace the horizon. Her red heart-star pulses with ancient warmth, a reminder that even creatures feared for their sting carry tenderness within. She dwells in the south, keeping balance with the Hunter in the north. Her wisdom: all things have their season, their purpose, their place. Curl into sleep like her graceful arc, knowing you too belong.'
    },

    {
      id: 'gemini',
      name: 'The Twins',
      difficulty: 'medium',
      stars: [
        { x: 0.4, y: 0.3 },   // Castor
        { x: 0.45, y: 0.3 },  // Pollux
        { x: 0.4, y: 0.5 },
        { x: 0.45, y: 0.55 },
        { x: 0.4, y: 0.7 },
        { x: 0.45, y: 0.75 },
      ],
      connections: [
        { from: 0, to: 2 },
        { from: 2, to: 4 },
        { from: 1, to: 3 },
        { from: 3, to: 5 },
        { from: 0, to: 1 },
      ],
      story: 'Two brothers stand side by side among the stars, bound not by blood alone but by choice. One mortal, one divine, they refused to be parted even by death. The gods honored their love by placing them together forever in the sky. They teach us that connection transcends circumstance, that companionship is a gift we give each other. You are never truly alone—somewhere, your constellation twin shines for you. Rest in that knowledge.'
    },

    {
      id: 'taurus',
      name: 'The Bull',
      difficulty: 'medium',
      stars: [
        { x: 0.45, y: 0.4 },  // Aldebaran (eye)
        { x: 0.35, y: 0.3 },  // Horn tip
        { x: 0.4, y: 0.35 },
        { x: 0.5, y: 0.3 },   // Horn tip
        { x: 0.55, y: 0.35 },
        { x: 0.5, y: 0.55 },
        { x: 0.55, y: 0.6 },
      ],
      connections: [
        { from: 0, to: 2 },
        { from: 2, to: 1 },
        { from: 0, to: 4 },
        { from: 4, to: 3 },
        { from: 0, to: 5 },
        { from: 5, to: 6 },
      ],
      story: 'The Bull charges gently through autumn skies, his eye a warm orange star that glows like an ember. He carries the coming spring on his back, patient and sure-footed through winter\'s darkness. Once wild with youth, he has learned the power of stillness, the strength found in steadiness. His message tonight: you do not need to rush. Move at your own pace. Trust your own rhythm. Let his slow, steady strength anchor your dreams.'
    },

    // ===== HARD CONSTELLATIONS (9-12 stars, complex shapes) =====

    {
      id: 'draco',
      name: 'The Dragon',
      difficulty: 'hard',
      stars: [
        { x: 0.5, y: 0.2 },   // Head
        { x: 0.45, y: 0.25 },
        { x: 0.4, y: 0.35 },
        { x: 0.35, y: 0.45 },
        { x: 0.4, y: 0.55 },
        { x: 0.5, y: 0.6 },
        { x: 0.6, y: 0.55 },
        { x: 0.65, y: 0.45 },
        { x: 0.6, y: 0.35 },
        { x: 0.55, y: 0.25 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 6 },
        { from: 6, to: 7 },
        { from: 7, to: 8 },
        { from: 8, to: 9 },
        { from: 9, to: 0 },
      ],
      story: 'The Dragon winds between the two Bears, a serpentine guardian of the northern pole. She is ancient beyond memory, keeper of forgotten wisdom and lost constellations. Her coils hold the axis of the heavens, the turning point around which all stars dance. She whispers to the night: change is the only constant, and that is not something to fear. Curl into her protective spiral and let transformation come gently, in sleep.'
    },

    {
      id: 'pegasus',
      name: 'The Winged Horse',
      difficulty: 'hard',
      stars: [
        { x: 0.4, y: 0.4 },   // Great Square corner
        { x: 0.6, y: 0.4 },   // Great Square corner
        { x: 0.6, y: 0.6 },   // Great Square corner
        { x: 0.4, y: 0.6 },   // Great Square corner
        { x: 0.35, y: 0.35 }, // Wing
        { x: 0.3, y: 0.3 },
        { x: 0.65, y: 0.35 }, // Wing
        { x: 0.7, y: 0.3 },
        { x: 0.5, y: 0.7 },   // Neck/head
        { x: 0.5, y: 0.8 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 0 },
        { from: 0, to: 4 },
        { from: 4, to: 5 },
        { from: 1, to: 6 },
        { from: 6, to: 7 },
        { from: 3, to: 8 },
        { from: 8, to: 9 },
      ],
      story: 'The Winged Horse gallops across autumn evenings, born from myth and magic where impossible things take flight. His great square body anchors him to the earth even as his wings reach for infinity. He carried heroes and poets alike, teaching them that inspiration comes from the marriage of freedom and form. Tonight he offers you his gift: permission to dream beyond your boundaries. Mount his starlit back and fly through sleeping skies.'
    },

    {
      id: 'andromeda',
      name: 'The Chained Princess',
      difficulty: 'hard',
      stars: [
        { x: 0.5, y: 0.3 },
        { x: 0.45, y: 0.4 },
        { x: 0.4, y: 0.5 },
        { x: 0.35, y: 0.6 },
        { x: 0.55, y: 0.4 },
        { x: 0.6, y: 0.5 },
        { x: 0.65, y: 0.6 },
        { x: 0.5, y: 0.55 },
        { x: 0.5, y: 0.7 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 0, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 6 },
        { from: 2, to: 7 },
        { from: 7, to: 8 },
      ],
      story: 'The Princess drifts through autumn nights, no longer chained but eternally free, her arms outstretched in victory. She was once offered as sacrifice, but she was saved by courage and love. Now she carries within her stars an entire galaxy, proof that even when we feel smallest, we contain multitudes. Her liberation is your promise: what binds you now will not hold you forever. Freedom is already written in your stars.'
    },

    {
      id: 'perseus',
      name: 'The Hero',
      difficulty: 'hard',
      stars: [
        { x: 0.5, y: 0.3 },
        { x: 0.45, y: 0.4 },
        { x: 0.4, y: 0.5 },
        { x: 0.35, y: 0.6 },
        { x: 0.55, y: 0.4 },
        { x: 0.6, y: 0.5 },
        { x: 0.65, y: 0.55 },
        { x: 0.5, y: 0.55 },
        { x: 0.45, y: 0.65 },
        { x: 0.55, y: 0.65 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 0, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 6 },
        { from: 1, to: 7 },
        { from: 7, to: 8 },
        { from: 7, to: 9 },
      ],
      story: 'The Hero stands eternal in the northern sky, not boasting of battles won but quietly holding space for those who struggle. He learned that heroism is not the slaying of monsters but the kindness shown after the fight is done. His constellation blooms with gentle meteor showers each August, gifts of light for those below. He tells you: being brave does not mean being unafraid. It means moving forward anyway. Sleep, brave one. You are stronger than you know.'
    },

    {
      id: 'aquarius',
      name: 'The Water Bearer',
      difficulty: 'hard',
      stars: [
        { x: 0.4, y: 0.3 },
        { x: 0.45, y: 0.35 },
        { x: 0.5, y: 0.4 },
        { x: 0.55, y: 0.35 },
        { x: 0.6, y: 0.3 },
        { x: 0.5, y: 0.5 },
        { x: 0.45, y: 0.6 },
        { x: 0.5, y: 0.65 },
        { x: 0.55, y: 0.6 },
        { x: 0.5, y: 0.75 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 2, to: 5 },
        { from: 5, to: 6 },
        { from: 6, to: 7 },
        { from: 7, to: 8 },
        { from: 7, to: 9 },
      ],
      story: 'The Water Bearer pours celestial rivers across winter skies, an endless offering to the thirsty earth. He kneels in service, understanding that giving is not depletion but renewal. His waters are made of starlight and time, spilling generosity into the cosmic stream. He shares ancient knowledge: what you pour out returns to you transformed, blessed by its journey through the world. Rest now. Your kindness ripples further than you will ever see.'
    },

    {
      id: 'pisces',
      name: 'The Fish',
      difficulty: 'hard',
      stars: [
        { x: 0.3, y: 0.4 },
        { x: 0.35, y: 0.45 },
        { x: 0.4, y: 0.5 },
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.5 },
        { x: 0.65, y: 0.55 },
        { x: 0.7, y: 0.6 },
        { x: 0.35, y: 0.35 },
        { x: 0.3, y: 0.3 },
        { x: 0.65, y: 0.65 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 6 },
        { from: 1, to: 7 },
        { from: 7, to: 8 },
        { from: 5, to: 9 },
      ],
      story: 'Two Fish swim in opposite directions, bound by a silver cord of stars, forever connected yet eternally free. They represent the duality we all carry: the desire to stay and the urge to go, the need for roots and wings alike. Tied together, they have learned to move as one despite their different paths. Their lesson shimmers through the spring sky: contradiction is not conflict. You can be many things at once. Let that paradox bring you peace.'
    },

    {
      id: 'sagittarius',
      name: 'The Archer',
      difficulty: 'hard',
      stars: [
        { x: 0.45, y: 0.35 },
        { x: 0.5, y: 0.4 },
        { x: 0.55, y: 0.35 },
        { x: 0.5, y: 0.5 },
        { x: 0.4, y: 0.55 },
        { x: 0.6, y: 0.55 },
        { x: 0.45, y: 0.65 },
        { x: 0.55, y: 0.65 },
        { x: 0.35, y: 0.4 },
        { x: 0.3, y: 0.45 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 1, to: 3 },
        { from: 3, to: 4 },
        { from: 3, to: 5 },
        { from: 3, to: 6 },
        { from: 3, to: 7 },
        { from: 0, to: 8 },
        { from: 8, to: 9 },
      ],
      story: 'The Archer aims his arrow at the heart of the Milky Way, pointing toward the center of everything. Half-human, half-horse, he bridges two worlds with grace. He teaches the art of focus: not the tension of straining toward a goal, but the calm certainty of knowing your direction. His bow is drawn but never released, holding potential in perfect balance. Follow his aim into dreams. Your target will find you when the time is right.'
    },

    {
      id: 'ursa-major',
      name: 'The Great Bear',
      difficulty: 'hard',
      stars: [
        { x: 0.35, y: 0.4 },  // Dipper bowl
        { x: 0.4, y: 0.4 },
        { x: 0.45, y: 0.45 },
        { x: 0.4, y: 0.5 },
        { x: 0.5, y: 0.5 },   // Handle start
        { x: 0.55, y: 0.55 },
        { x: 0.6, y: 0.6 },
        { x: 0.3, y: 0.35 },  // Body
        { x: 0.25, y: 0.45 },
        { x: 0.3, y: 0.55 },
      ],
      connections: [
        { from: 0, to: 1 },
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 0 },
        { from: 1, to: 4 },
        { from: 4, to: 5 },
        { from: 5, to: 6 },
        { from: 0, to: 7 },
        { from: 7, to: 8 },
        { from: 8, to: 9 },
      ],
      story: 'The Great Bear lumbers through the northern sky, her famous dipper shape only a small part of her vast presence. She is mother, protector, guide—her stars have pointed travelers home for thousands of years. She circles the pole star endlessly, never setting, never resting, always watching over the sleeping world. Her great paws tread softly so as not to wake you. Sleep under her guard. You are safe. You are seen. You are held.'
    },
  ],
};
