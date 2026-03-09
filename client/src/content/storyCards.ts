export type StoryCardType = 'levelIntro' | 'bossIntro' | 'discovery' | 'aftermath';

export interface StoryCardPayload {
  id: StoryCardId;
  type: StoryCardType;
  title: string;
  subtitle?: string;
  sting?: string;
  body?: string;
}

export type StoryCardId =
  | 'level1_threshold'
  | 'level2_hospice'
  | 'level3_forge'
  | 'level4_rift'
  | 'sanctum_home'
  | 'boss_aldric'
  | 'boss_vael'
  | 'boss_cobb'
  | 'boss_witness'
  | 'boss_elias'
  | 'discovery_locket'
  | 'discovery_her_name'
  | 'discovery_three_figures'
  | 'discovery_home_below'
  | 'discovery_recognition'
  | 'aftermath_aldric'
  | 'aftermath_vael'
  | 'aftermath_cobb'
  | 'aftermath_mael'
  | 'aftermath_watcher';

const CARDS: Record<StoryCardId, StoryCardPayload> = {
  level1_threshold: {
    id: 'level1_threshold',
    type: 'levelIntro',
    title: 'THE THRESHOLD',
    subtitle: 'Old Quarantine Gate',
    sting:
      'The soldiers left in a hurry. Something below them had changed.\n' +
      'The guard posts are still set for inspection, still arranged as though duty might resume in the morning. It will not.\n' +
      'This was the last place where the dungeon still belonged to the surface.\n' +
      'Beyond the gate, it belongs to him.',
  },
  level2_hospice: {
    id: 'level2_hospice',
    type: 'levelIntro',
    title: 'THE HOSPICE',
    subtitle: 'Sister Vael’s Ward',
    sting:
      'She tried to keep them as patients. He had already begun to treat them as proof.\n' +
      'Beds, ledgers, labeled shelves — the shape of care remains, even here.\n' +
      'Sister Vael believed the work could still be turned toward life.\n' +
      'She was right about the method. Wrong about the man.',
  },
  level3_forge: {
    id: 'level3_forge',
    type: 'levelIntro',
    title: 'THE FORGE HALLS',
    subtitle: 'The Workshop',
    sting:
      'He rebuilt the shape of home where home could no longer exist.\n' +
      'A forge table. Two chairs. A child’s drawing preserved past its own life.\n' +
      'Nothing here is arranged by accident.\n' +
      'That is what makes it unbearable.',
  },
  level4_rift: {
    id: 'level4_rift',
    type: 'levelIntro',
    title: 'THE RIFT CHAMBERS',
    subtitle: 'The Lower Cells',
    sting:
      'This is where he ran out of names.\n' +
      'The records continue. The subjects continue. The suffering continues.\n' +
      'What was hidden above becomes orderly here — measured, contained, observed.\n' +
      'This is the deepest point of the work and the lowest point of the man.',
  },
  sanctum_home: {
    id: 'sanctum_home',
    type: 'levelIntro',
    title: 'THE SANCTUM',
    subtitle: 'The Home Below',
    sting:
      'He shaped the room like memory and called the result mercy.\n' +
      'Warm light. A table set for people who cannot return to it.\n' +
      'Everything here has been arranged to resemble what he lost.\n' +
      'Now he waits to learn whether you can do what he could not.',
  },
  boss_aldric: {
    id: 'boss_aldric',
    type: 'bossIntro',
    title: 'ALDRIC',
    subtitle: 'The Gatekeeper',
    sting:
      'He followed Elias into The Depths rather than return empty-handed.\n' +
      'Duty demanded answers for the lights burning at forbidden hours.\n' +
      'Elias needed a subject with combat conditioning. Aldric was thorough.\n' +
      'He is still arresting someone. He no longer knows who.',
  },
  boss_vael: {
    id: 'boss_vael',
    type: 'bossIntro',
    title: 'SISTER VAEL',
    subtitle: 'The Collector',
    sting:
      'Six years after Elias arrived, she entered voluntarily.\n' +
      'A plague doctor who believed he held the cure and meant to bring it back with her.\n' +
      'She kept track of the names. Someone had to.\n' +
      'Now the ward keeps track of her.',
  },
  boss_cobb: {
    id: 'boss_cobb',
    type: 'bossIntro',
    title: 'COBB',
    subtitle: 'The Forgemaster',
    sting:
      'Elias’s oldest friend. Eleven years of adjacent forges and stories carried home at dusk.\n' +
      'He came here to bring him back. He carried a locket made from those stories.\n' +
      'Elias saw not a friend, but a subject suitable for the work.\n' +
      'Hammer-hands still search the face they came to save.',
  },
  boss_witness: {
    id: 'boss_witness',
    type: 'bossIntro',
    title: 'THE WITNESS',
    subtitle: 'The Witness',
    sting:
      'She remained aware.\n' +
      'That is the horror before all other horrors here.\n' +
      'Thirty-one years of experiments, failures, voices, and doors that never opened — all of it kept intact behind her eyes.\n' +
      'She remembers what he did because someone had to.',
  },
  boss_elias: {
    id: 'boss_elias',
    type: 'bossIntro',
    title: 'ELIAS THORNE',
    subtitle: 'The Watcher',
    sting:
      'Thirty years building behavioral models of humans under pressure.\n' +
      'Perfect prediction. Useless for restoration.\n' +
      'He learned everything about how humans break except how to stop.\n' +
      'Now he measures whether you will make his choice — or refuse it.',
  },
  discovery_locket: {
    id: 'discovery_locket',
    type: 'discovery',
    title: 'THE LOCKET',
    sting: 'Someone carried their faces this far and never got to give them back.',
  },
  discovery_her_name: {
    id: 'discovery_her_name',
    type: 'discovery',
    title: 'HER NAME',
    sting: 'Not Subject 38. Mael.',
  },
  discovery_three_figures: {
    id: 'discovery_three_figures',
    type: 'discovery',
    title: 'THREE FIGURES AND A SUN',
    sting: 'He traced it so many times the paper became a wound.',
  },
  discovery_home_below: {
    id: 'discovery_home_below',
    type: 'discovery',
    title: 'THE HOME BELOW',
    sting: 'They are the shape of love without the person inside it.',
  },
  discovery_recognition: {
    id: 'discovery_recognition',
    type: 'discovery',
    title: 'RECOGNITION',
    sting: 'That’s not her.',
  },
  aftermath_aldric: {
    id: 'aftermath_aldric',
    type: 'aftermath',
    title: 'AFTER ALDRIC',
    sting: 'He did not come here as a monster. He came here as a father who expected to return.',
  },
  aftermath_vael: {
    id: 'aftermath_vael',
    type: 'aftermath',
    title: 'AFTER VAEL',
    sting: 'She left the truth where anyone honest enough to look could find it.',
  },
  aftermath_cobb: {
    id: 'aftermath_cobb',
    type: 'aftermath',
    title: 'AFTER COBB',
    sting: 'He listened for years and still came back.',
  },
  aftermath_mael: {
    id: 'aftermath_mael',
    type: 'aftermath',
    title: 'HER NAME WAS MAEL',
    sting: 'You know it now. Carry it like it matters.',
  },
  aftermath_watcher: {
    id: 'aftermath_watcher',
    type: 'aftermath',
    title: 'WHAT HE FINALLY UNDERSTOOD',
    sting: 'I thought holding on was love. I didn’t understand, until too late, what I was holding you inside.',
  },
};

export const getStoryCard = (id: StoryCardId): StoryCardPayload | undefined => CARDS[id];

export const listStoryCards = (): StoryCardPayload[] => Object.values(CARDS);
