/**
 * TaaraNight Constellation Dataset
 *
 * Every star below is a real star. Its J2000 right ascension and declination
 * are transcribed from the IAU Catalog of Star Names (IAU-CSN, WGSN, 2022-04-04),
 * falling back to the HYG database v4.1 for the stars the IAU has not named.
 * The 0–1 positions the puzzle draws are *derived* from those coordinates by
 * `projectToBox` (see projection.ts) — north up, east left, true proportions —
 * so each shape is the shape you would find in the sky tonight.
 *
 * `star` is the IAU-approved proper name where one exists, and the Bayer or
 * Flamsteed designation where it does not. So: Aljanah, not Gienah (Gienah is
 * γ Corvi); Aldulfin, not the obsolete Deneb Dulfim; and plain "γ Cas", because
 * γ Cassiopeiae has no approved name at all.
 *
 * `difficulty` describes the shape's complexity, not the night's mode: a night
 * hands the same constellation to Easy, Medium and Hard alike.
 *
 * Stories are original bedtime myths written for a calming, sleep-friendly tone.
 */

import type {
  Connection,
  Constellation,
  ConstellationDataset,
  Difficulty,
} from './constellations';
import { projectToBox } from './projection';

/** A constellation as authored: real stars, real coordinates. */
interface SkyConstellation {
  id: string;
  name: string;
  difficulty: Difficulty;
  /** Real stars, in the order the `connections` indices refer to. */
  stars: { star: string; ra: number; dec: number }[];
  connections: Connection[];
  story: string;
}

/** Project the catalogue coordinates into the 0–1 box the puzzle plays in. */
function build(sky: SkyConstellation): Constellation {
  const points = projectToBox(sky.stars);
  return {
    id: sky.id,
    name: sky.name,
    difficulty: sky.difficulty,
    connections: sky.connections,
    story: sky.story,
    stars: sky.stars.map((s, i) => ({
      x: points[i]!.x,
      y: points[i]!.y,
      ra: s.ra,
      dec: s.dec,
      star: s.star,
    })),
  };
}

const SKY: SkyConstellation[] = [
  {
    id: 'ursa-minor',
    name: 'Little Bear',
    difficulty: 'medium',
    stars: [
      { star: 'Polaris', ra: 2.5303, dec: 89.2641 },
      { star: 'Yildun', ra: 17.5369, dec: 86.5865 },
      { star: 'ε UMi', ra: 16.7662, dec: 82.0373 },
      { star: 'ζ UMi', ra: 15.7343, dec: 77.7945 },
      { star: 'η UMi', ra: 16.2918, dec: 75.7553 },
      { star: 'Pherkad', ra: 15.3455, dec: 71.834 },
      { star: 'Kochab', ra: 14.8451, dec: 74.1555 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 3 },
    ],
    story:
      'The Little Bear wanders the northern sky, forever circling the still point of the heavens. Her brightest star never moves, a gentle beacon for those who feel lost. When you cannot find your way, she reminds you: sometimes standing still is the bravest journey. Close your eyes and let her constancy calm your restless thoughts.',
  },

  {
    id: 'cassiopeia',
    name: "The Queen's Throne",
    difficulty: 'easy',
    stars: [
      { star: 'Caph', ra: 0.153, dec: 59.1498 },
      { star: 'Schedar', ra: 0.6751, dec: 56.5373 },
      { star: 'γ Cas', ra: 0.9451, dec: 60.7167 },
      { star: 'Ruchbah', ra: 1.4303, dec: 60.2353 },
      { star: 'Segin', ra: 1.9066, dec: 63.6701 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
    story:
      'A queen sits upon her celestial throne, shaped like a gentle W across the midnight canvas. She once boasted of her beauty, but the stars taught her humility. Now she spins gracefully through the seasons, sharing her wisdom: true beauty lies in accepting our place in the vastness. Rest now, knowing you belong exactly where you are.',
  },

  {
    id: 'lyra',
    name: 'The Starlit Harp',
    difficulty: 'easy',
    stars: [
      { star: 'Vega', ra: 18.6156, dec: 38.7837 },
      { star: 'ε Lyr', ra: 18.7397, dec: 39.6127 },
      { star: 'ζ Lyr', ra: 18.7462, dec: 37.6051 },
      { star: 'δ Lyr', ra: 18.9084, dec: 36.8986 },
      { star: 'Sulafat', ra: 18.9824, dec: 32.6896 },
      { star: 'Sheliak', ra: 18.8347, dec: 33.3627 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 2, to: 5 },
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 3, to: 2 },
    ],
    story:
      'A harp made of starlight plays melodies only the night can hear. Its strings once belonged to a musician who loved so deeply that even silence became song. The stars remember his music and hum it softly to those who listen. As you drift to sleep, the harp plays just for you—a lullaby woven from moonbeams and memory.',
  },

  {
    id: 'corona-borealis',
    name: 'The Northern Crown',
    difficulty: 'medium',
    stars: [
      { star: 'θ CrB', ra: 15.5488, dec: 31.3591 },
      { star: 'Nusakan', ra: 15.4638, dec: 29.1057 },
      { star: 'Alphecca', ra: 15.5781, dec: 26.7147 },
      { star: 'γ CrB', ra: 15.7124, dec: 26.2956 },
      { star: 'δ CrB', ra: 15.8266, dec: 26.0684 },
      { star: 'ε CrB', ra: 15.9598, dec: 26.8779 },
      { star: 'ι CrB', ra: 16.024, dec: 29.8511 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
    ],
    story:
      'A crown of seven jewels rests in the northern heavens, placed there by a god who loved a mortal. The gift was meant to say: you are precious beyond measure. Each star in the crown whispers this truth to anyone who gazes up. Tonight, the crown glows for you, a reminder that you are worthy of wonder. Let this thought ease you into dreams.',
  },

  {
    id: 'delphinus',
    name: 'The Dolphin',
    difficulty: 'easy',
    stars: [
      { star: 'Sualocin', ra: 20.6606, dec: 15.9121 },
      { star: 'Rotanev', ra: 20.6258, dec: 14.5951 },
      { star: 'γ Del', ra: 20.7776, dec: 16.1243 },
      { star: 'δ Del', ra: 20.7243, dec: 15.0746 },
      { star: 'Aldulfin', ra: 20.5535, dec: 11.3033 },
    ],
    connections: [
      { from: 1, to: 0 },
      { from: 0, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 1 },
      { from: 1, to: 4 },
    ],
    story:
      'A small dolphin leaps through the cosmic ocean, carrying stories between the stars. She once saved a poet from drowning, and in gratitude, he gave her a home in the sky. Now she swims through the darkness, bringing messages of hope to weary travelers. Her gift to you tonight: even in the deepest waters, there is always a way to the surface.',
  },

  {
    id: 'orion',
    name: 'The Hunter',
    difficulty: 'medium',
    stars: [
      { star: 'Betelgeuse', ra: 5.9195, dec: 7.4071 },
      { star: 'Bellatrix', ra: 5.4189, dec: 6.3497 },
      { star: 'Mintaka', ra: 5.5334, dec: -0.2991 },
      { star: 'Alnilam', ra: 5.6036, dec: -1.2019 },
      { star: 'Alnitak', ra: 5.6793, dec: -1.9426 },
      { star: 'Saiph', ra: 5.7959, dec: -9.6696 },
      { star: 'Rigel', ra: 5.2423, dec: -8.2016 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 0, to: 4 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 2, to: 6 },
    ],
    story:
      'The Hunter strides across winter skies, his belt a perfect line of three bright stars. He chases not beasts but meaning, searching the cosmos for understanding. Long ago he learned that the greatest hunts are those within—the pursuit of peace, of purpose, of acceptance. His stars glow steady through the cold nights, patient companions for your own quiet quest. Rest, hunter. Tomorrow brings new trails.',
  },

  {
    id: 'cygnus',
    name: 'The Swan',
    difficulty: 'easy',
    stars: [
      { star: 'Deneb', ra: 20.6905, dec: 45.2803 },
      { star: 'Sadr', ra: 20.3705, dec: 40.2567 },
      { star: 'Albireo', ra: 19.512, dec: 27.9597 },
      { star: 'Fawaris', ra: 19.7496, dec: 45.1308 },
      { star: 'Aljanah', ra: 20.7702, dec: 33.9703 },
      { star: 'ζ Cyg', ra: 21.2156, dec: 30.2269 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 1, to: 4 },
      { from: 4, to: 5 },
    ],
    story:
      'A swan glides down the starry river of the Milky Way, wings outstretched in eternal flight. Legends say she carries the souls of stories not yet told, dreams waiting to be dreamed. Her neck stretches toward tomorrow while her wings embrace the now. She teaches a gentle lesson: grace is not the absence of struggle, but the choice to fly anyway. Spread your wings in sleep, and soar.',
  },

  {
    id: 'leo',
    name: 'The Lion',
    difficulty: 'hard',
    stars: [
      { star: 'Regulus', ra: 10.1395, dec: 11.9672 },
      { star: 'η Leo', ra: 10.1222, dec: 16.7627 },
      { star: 'Algieba', ra: 10.3329, dec: 19.8415 },
      { star: 'Adhafera', ra: 10.2782, dec: 23.4173 },
      { star: 'Rasalas', ra: 9.8794, dec: 26.007 },
      { star: 'ε Leo', ra: 9.7642, dec: 23.7743 },
      { star: 'Zosma', ra: 11.2351, dec: 20.5237 },
      { star: 'Chertan', ra: 11.2373, dec: 15.4296 },
      { star: 'Denebola', ra: 11.8177, dec: 14.5721 },
    ],
    connections: [
      { from: 5, to: 4 },
      { from: 4, to: 3 },
      { from: 3, to: 2 },
      { from: 2, to: 1 },
      { from: 1, to: 0 },
      { from: 0, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 6 },
      { from: 6, to: 2 },
    ],
    story:
      "The Lion rests among the spring stars, mighty heart beating slow and steady. Once fierce and fearsome, he learned that true strength is knowing when to be gentle. His brightest star, called the King, shines with quiet dignity. He guards the boundary between night and day, protecting the dreams of all who sleep beneath his watch. You are safe. You are strong. Let the Lion's courage soothe your worries.",
  },

  {
    id: 'scorpius',
    name: 'The Scorpion',
    difficulty: 'hard',
    stars: [
      { star: 'Acrab', ra: 16.0906, dec: -19.8055 },
      { star: 'Dschubba', ra: 16.0056, dec: -22.6217 },
      { star: 'Fang', ra: 15.9809, dec: -26.1141 },
      { star: 'Antares', ra: 16.4901, dec: -26.432 },
      { star: 'Paikauhale', ra: 16.598, dec: -28.216 },
      { star: 'Larawag', ra: 16.8361, dec: -34.2932 },
      { star: 'Xamidimura', ra: 16.8645, dec: -38.0474 },
      { star: 'ζ Sco', ra: 16.9097, dec: -42.3613 },
      { star: 'Sargas', ra: 17.622, dec: -42.9978 },
      { star: 'Shaula', ra: 17.5601, dec: -37.1038 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
    story:
      'The Scorpion curves through summer nights, tail arched not to strike but to embrace the horizon. Her red heart-star pulses with ancient warmth, a reminder that even creatures feared for their sting carry tenderness within. She dwells in the south, keeping balance with the Hunter in the north. Her wisdom: all things have their season, their purpose, their place. Curl into sleep like her graceful arc, knowing you too belong.',
  },

  {
    id: 'gemini',
    name: 'The Twins',
    difficulty: 'hard',
    stars: [
      { star: 'Castor', ra: 7.5766, dec: 31.8883 },
      { star: 'Pollux', ra: 7.7553, dec: 28.0262 },
      { star: 'τ Gem', ra: 7.1857, dec: 30.2452 },
      { star: 'Mebsuta', ra: 6.7322, dec: 25.1311 },
      { star: 'Tejat', ra: 6.3827, dec: 22.5136 },
      { star: 'Propus', ra: 6.248, dec: 22.5068 },
      { star: 'Wasat', ra: 7.3354, dec: 21.9823 },
      { star: 'Mekbuda', ra: 7.0685, dec: 20.5703 },
      { star: 'Alhena', ra: 6.6285, dec: 16.3993 },
      { star: 'λ Gem', ra: 7.3015, dec: 16.5404 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 1, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 6, to: 9 },
    ],
    story:
      'Two brothers stand side by side among the stars, bound not by blood alone but by choice. One mortal, one divine, they refused to be parted even by death. The gods honored their love by placing them together forever in the sky. They teach us that connection transcends circumstance, that companionship is a gift we give each other. You are never truly alone—somewhere, your constellation twin shines for you. Rest in that knowledge.',
  },

  {
    id: 'taurus',
    name: 'The Bull',
    difficulty: 'medium',
    stars: [
      { star: 'Aldebaran', ra: 4.5987, dec: 16.5093 },
      { star: 'Chamukuy', ra: 4.4777, dec: 15.8709 },
      { star: 'Prima Hyadum', ra: 4.3299, dec: 15.6276 },
      { star: 'Secunda Hyadum', ra: 4.3822, dec: 17.5425 },
      { star: 'Ain', ra: 4.4769, dec: 19.1804 },
      { star: 'Elnath', ra: 5.4382, dec: 28.6075 },
      { star: 'Tianguan', ra: 5.6274, dec: 21.1425 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 0, to: 6 },
    ],
    story:
      "The Bull charges gently through autumn skies, his eye a warm orange star that glows like an ember. He carries the coming spring on his back, patient and sure-footed through winter's darkness. Once wild with youth, he has learned the power of stillness, the strength found in steadiness. His message tonight: you do not need to rush. Move at your own pace. Trust your own rhythm. Let his slow, steady strength anchor your dreams.",
  },

  {
    id: 'draco',
    name: 'The Dragon',
    difficulty: 'hard',
    stars: [
      { star: 'Eltanin', ra: 17.9434, dec: 51.4889 },
      { star: 'Rastaban', ra: 17.5072, dec: 52.3014 },
      { star: 'ν Dra', ra: 17.5378, dec: 55.173 },
      { star: 'Grumium', ra: 17.8921, dec: 56.8726 },
      { star: 'Altais', ra: 19.2093, dec: 67.6615 },
      { star: 'ε Dra', ra: 19.8028, dec: 70.2679 },
      { star: 'Aldhibah', ra: 17.1464, dec: 65.7147 },
      { star: 'Athebyne', ra: 16.3999, dec: 61.5142 },
      { star: 'Edasich', ra: 15.4155, dec: 58.9661 },
      { star: 'Thuban', ra: 14.0732, dec: 64.3759 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 0 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
      { from: 8, to: 9 },
    ],
    story:
      'The Dragon winds between the two Bears, a serpentine guardian of the northern pole. She is ancient beyond memory, keeper of forgotten wisdom and lost constellations. Her coils hold the axis of the heavens, the turning point around which all stars dance. She whispers to the night: change is the only constant, and that is not something to fear. Curl into her protective spiral and let transformation come gently, in sleep.',
  },

  {
    id: 'pegasus',
    name: 'The Winged Horse',
    difficulty: 'hard',
    stars: [
      { star: 'Markab', ra: 23.0793, dec: 15.2053 },
      { star: 'Scheat', ra: 23.0629, dec: 28.0828 },
      { star: 'Algenib', ra: 0.2206, dec: 15.1836 },
      { star: 'Alpheratz', ra: 0.1398, dec: 29.0904 },
      { star: 'Homam', ra: 22.691, dec: 10.8314 },
      { star: 'Biham', ra: 22.17, dec: 6.1979 },
      { star: 'Enif', ra: 21.7364, dec: 9.875 },
      { star: 'Matar', ra: 22.7167, dec: 30.2212 },
      { star: 'Sadalbari', ra: 22.8334, dec: 24.6016 },
    ],
    connections: [
      { from: 3, to: 2 },
      { from: 2, to: 0 },
      { from: 0, to: 1 },
      { from: 1, to: 3 },
      { from: 0, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 1, to: 8 },
      { from: 8, to: 7 },
    ],
    story:
      'The Winged Horse gallops across autumn evenings, born from myth and magic where impossible things take flight. His great square body anchors him to the earth even as his wings reach for infinity. He carried heroes and poets alike, teaching them that inspiration comes from the marriage of freedom and form. Tonight he offers you his gift: permission to dream beyond your boundaries. Mount his starlit back and fly through sleeping skies.',
  },

  {
    id: 'andromeda',
    name: 'The Chained Princess',
    difficulty: 'medium',
    stars: [
      { star: 'Alpheratz', ra: 0.1398, dec: 29.0904 },
      { star: 'δ And', ra: 0.6555, dec: 30.861 },
      { star: 'Mirach', ra: 1.1622, dec: 35.6206 },
      { star: 'Almach', ra: 2.065, dec: 42.3297 },
      { star: 'π And', ra: 0.6147, dec: 33.7193 },
      { star: 'μ And', ra: 0.9459, dec: 38.4993 },
      { star: 'ν And', ra: 0.8302, dec: 41.0789 },
      { star: 'Nembus', ra: 1.6332, dec: 48.6282 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 1, to: 4 },
      { from: 2, to: 5 },
      { from: 5, to: 6 },
      { from: 3, to: 7 },
    ],
    story:
      'The Princess drifts through autumn nights, no longer chained but eternally free, her arms outstretched in victory. She was once offered as sacrifice, but she was saved by courage and love. Now she carries within her stars an entire galaxy, proof that even when we feel smallest, we contain multitudes. Her liberation is your promise: what binds you now will not hold you forever. Freedom is already written in your stars.',
  },

  {
    id: 'perseus',
    name: 'The Hero',
    difficulty: 'hard',
    stars: [
      { star: 'Mirfak', ra: 3.4054, dec: 49.8612 },
      { star: 'Algol', ra: 3.1361, dec: 40.9556 },
      { star: 'γ Per', ra: 3.0799, dec: 53.5064 },
      { star: 'δ Per', ra: 3.7154, dec: 47.7876 },
      { star: 'ε Per', ra: 3.9642, dec: 40.0102 },
      { star: 'ζ Per', ra: 3.9022, dec: 31.8836 },
      { star: 'Miram', ra: 2.8449, dec: 55.8955 },
      { star: 'ρ Per', ra: 3.0863, dec: 38.8403 },
      { star: 'Menkib', ra: 3.9828, dec: 35.791 },
    ],
    connections: [
      { from: 6, to: 2 },
      { from: 2, to: 0 },
      { from: 0, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 8 },
      { from: 8, to: 5 },
      { from: 0, to: 1 },
      { from: 1, to: 7 },
    ],
    story:
      'The Hero stands eternal in the northern sky, not boasting of battles won but quietly holding space for those who struggle. He learned that heroism is not the slaying of monsters but the kindness shown after the fight is done. His constellation blooms with gentle meteor showers each August, gifts of light for those below. He tells you: being brave does not mean being unafraid. It means moving forward anyway. Sleep, brave one. You are stronger than you know.',
  },

  {
    id: 'aquarius',
    name: 'The Water Bearer',
    difficulty: 'medium',
    stars: [
      { star: 'Sadalmelik', ra: 22.0964, dec: -0.3198 },
      { star: 'Sadalsuud', ra: 21.526, dec: -5.5712 },
      { star: 'Sadachbia', ra: 22.3609, dec: -1.3873 },
      { star: 'Ancha', ra: 22.2806, dec: -7.7833 },
      { star: 'λ Aqr', ra: 22.8769, dec: -7.5796 },
      { star: 'Skat', ra: 22.9108, dec: -15.8208 },
      { star: 'Albali', ra: 20.7946, dec: -9.4958 },
    ],
    connections: [
      { from: 6, to: 1 },
      { from: 1, to: 0 },
      { from: 0, to: 2 },
      { from: 0, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
    ],
    story:
      'The Water Bearer pours celestial rivers across winter skies, an endless offering to the thirsty earth. He kneels in service, understanding that giving is not depletion but renewal. His waters are made of starlight and time, spilling generosity into the cosmic stream. He shares ancient knowledge: what you pour out returns to you transformed, blessed by its journey through the world. Rest now. Your kindness ripples further than you will ever see.',
  },

  {
    id: 'pisces',
    name: 'The Fish',
    difficulty: 'hard',
    stars: [
      { star: 'Alrescha', ra: 2.0341, dec: 2.7637 },
      { star: 'Torcular', ra: 1.7566, dec: 9.1577 },
      { star: 'Alpherg', ra: 1.5247, dec: 15.3458 },
      { star: 'ε Psc', ra: 1.0491, dec: 7.8901 },
      { star: 'δ Psc', ra: 0.8114, dec: 7.5851 },
      { star: 'ω Psc', ra: 23.9885, dec: 6.8633 },
      { star: 'ι Psc', ra: 23.6658, dec: 5.6263 },
      { star: 'γ Psc', ra: 23.2861, dec: 3.2823 },
      { star: 'Fumalsamakah', ra: 23.0646, dec: 3.82 },
    ],
    connections: [
      { from: 2, to: 1 },
      { from: 1, to: 0 },
      { from: 0, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 8 },
    ],
    story:
      'Two Fish swim in opposite directions, bound by a silver cord of stars, forever connected yet eternally free. They represent the duality we all carry: the desire to stay and the urge to go, the need for roots and wings alike. Tied together, they have learned to move as one despite their different paths. Their lesson shimmers through the spring sky: contradiction is not conflict. You can be many things at once. Let that paradox bring you peace.',
  },

  {
    id: 'sagittarius',
    name: 'The Archer',
    difficulty: 'medium',
    stars: [
      { star: 'Alnasl', ra: 18.0968, dec: -30.4241 },
      { star: 'Kaus Media', ra: 18.3499, dec: -29.8281 },
      { star: 'Kaus Australis', ra: 18.4029, dec: -34.3846 },
      { star: 'Kaus Borealis', ra: 18.4662, dec: -25.4217 },
      { star: 'φ Sgr', ra: 18.7609, dec: -26.9908 },
      { star: 'Nunki', ra: 18.9211, dec: -26.2967 },
      { star: 'τ Sgr', ra: 19.1157, dec: -27.6704 },
      { star: 'Ascella', ra: 19.0435, dec: -29.8801 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
      { from: 6, to: 7 },
      { from: 7, to: 2 },
      { from: 7, to: 4 },
    ],
    story:
      'The Archer aims his arrow at the heart of the Milky Way, pointing toward the center of everything. Half-human, half-horse, he bridges two worlds with grace. He teaches the art of focus: not the tension of straining toward a goal, but the calm certainty of knowing your direction. His bow is drawn but never released, holding potential in perfect balance. Follow his aim into dreams. Your target will find you when the time is right.',
  },

  {
    id: 'ursa-major',
    name: 'The Great Bear',
    difficulty: 'medium',
    stars: [
      { star: 'Dubhe', ra: 11.0621, dec: 61.751 },
      { star: 'Merak', ra: 11.0307, dec: 56.3824 },
      { star: 'Phecda', ra: 11.8972, dec: 53.6948 },
      { star: 'Megrez', ra: 12.2571, dec: 57.0326 },
      { star: 'Alioth', ra: 12.9005, dec: 55.9598 },
      { star: 'Mizar', ra: 13.3988, dec: 54.9254 },
      { star: 'Alkaid', ra: 13.7923, dec: 49.3133 },
    ],
    connections: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 0 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
      { from: 5, to: 6 },
    ],
    story:
      'The Great Bear lumbers through the northern sky, her famous dipper shape only a small part of her vast presence. She is mother, protector, guide—her stars have pointed travelers home for thousands of years. She circles the pole star endlessly, never setting, never resting, always watching over the sleeping world. Her great paws tread softly so as not to wake you. Sleep under her guard. You are safe. You are seen. You are held.',
  },
];

export const CONSTELLATION_DATA: ConstellationDataset = {
  constellations: SKY.map(build),
};
