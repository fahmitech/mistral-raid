export type LoreEntryId =
  | 'day3_note'
  | 'vael_page34'
  | 'forge_year22'
  | 'cobb_locket'
  | 'mael_name'
  | 'level1_key_hint'
  | 'level2_key_hint'
  | 'level3_key_hint'
  | 'level4_key_hint';

export interface LoreEntry {
  id: LoreEntryId;
  title: string;
  body: string;
  source?: string;
  level?: number;
  type?: 'journal' | 'letter' | 'research' | 'reveal';
  oneTime?: boolean;
}

const ENTRIES: Record<LoreEntryId, LoreEntry> = {
  day3_note: {
    id: 'day3_note',
    title: 'Day 3',
    body:
      'I finished the formula. It works. The correction was in the weight ratio. It was obvious once I stopped trying to be hopeful and looked at the numbers like they were numbers. She would have been fine. Three days. I was three days late and the world has continued to move as if that is survivable.',
    source: 'Unmarked Scrap',
    level: 1,
    type: 'journal',
    oneTime: false,
  },
  vael_page34: {
    id: 'vael_page34',
    title: 'Page 34',
    body:
      'Subject 7 shows full memory retention at 72 hours. Emotional response intact. She asked for water. This could work. I need to show E— he is not listening anymore. He stopped listening when I told him the synthesis only works forward. That we cannot reach back. He knows this. He has always known this. I think that is the problem. I think knowing something and living as if it is true are different operations, and I think he has perfected one of them.',
    source: 'Treatment Ward Log',
    level: 2,
    type: 'research',
    oneTime: false,
  },
  forge_year22: {
    id: 'forge_year22',
    title: 'Year 22',
    body:
      'Elara said my name today. Inflection correct. I sat with her for an hour. I did not speak because I did not trust my voice. Progress stable. Same as last month. Same as the month before. I do not know if stable is good anymore. I think I used to know. I think I have been here too long.',
    source: 'Forge Ledger Fragment',
    level: 3,
    type: 'journal',
    oneTime: false,
  },
  cobb_locket: {
    id: 'cobb_locket',
    title: 'The Locket',
    body:
      "Inside are two portraits painted from memory that was not the painter’s. Mira’s nose is slightly wrong. Elara’s hair is longer than it should be. But the care is unmistakable. Someone listened for years to another man speak about the people he loved, and from those stories tried, with all the tenderness available to him, to imagine their faces. He carried this all the way to the bottom of the world. He never got to give it back.",
    source: 'Cobb’s Keepsake',
    level: 3,
    type: 'reveal',
    oneTime: true,
  },
  mael_name: {
    id: 'mael_name',
    title: 'Her Name',
    body:
      'Her name was Mael. Not Subject 38. Not the witness. Not the screaming thing in the room below the fracture. Mael. He knew how to record pulse rate, memory retention, vocal deterioration, eye tracking, threshold response. He knew how to count thirty-one years in outcomes and observations. He did not write her name. You know it now. Carry it like it matters.',
    source: 'Witness Etching',
    level: 4,
    type: 'reveal',
    oneTime: true,
  },
  level1_key_hint: {
    id: 'level1_key_hint',
    title: 'Scratched Note',
    body:
      'The key to the iron gate is hidden where the old watchman fell. Look behind the cracked pillar in the north alcove. I could not bring myself to retrieve it. Forgive me.',
    source: 'Scratched Note',
    level: 1,
    type: 'letter',
    oneTime: false,
  },
  level2_key_hint: {
    id: 'level2_key_hint',
    title: "Vael's Marginalia",
    body:
      'The gate key is in the flooded crypt below the ward. I dropped it when the screams began. It lies with the drowned orderly. May the water keep it from those who would misuse it.',
    source: "Vael's Marginalia",
    level: 2,
    type: 'letter',
    oneTime: false,
  },
  level3_key_hint: {
    id: 'level3_key_hint',
    title: 'Forge Worker’s Last Words',
    body:
      'The master key is where the bellows failed — under the collapsed beam in the east forge. I meant to retrieve it for Elara. Now it waits for someone braver.',
    source: 'Forge Worker’s Last Words',
    level: 3,
    type: 'letter',
    oneTime: false,
  },
  level4_key_hint: {
    id: 'level4_key_hint',
    title: "Mael's Etching",
    body:
      'The final gate key rests in the rift where I first heard her name again. Behind the shattered obelisk. Take it. End this.',
    source: "Mael's Etching",
    level: 4,
    type: 'letter',
    oneTime: false,
  },
};

export const getLoreEntry = (id: LoreEntryId): LoreEntry | undefined => ENTRIES[id];

export const listLoreEntries = (): LoreEntry[] => Object.values(ENTRIES);
