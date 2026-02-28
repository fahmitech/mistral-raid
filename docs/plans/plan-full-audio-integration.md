# 🎯 GLOBAL AUDIO INTEGRATION — MISTRAL RAID (STABLE VERSION)

Now that Vite is correctly configured:

- root = client
- publicDir = public
- Audio URL works at: /audio/...

We will integrate a full, stable Phaser audio system.

------------------------------------------------------------
OBJECTIVES
------------------------------------------------------------

• Load all audio from /public/audio
• Prevent decoding errors
• Prevent duplicate music
• Unlock audio on first click
• Handle scene transitions
• Stable for hackathon demo
• No runtime crash
• No unhandled promise errors

------------------------------------------------------------
STEP 1 — CREATE GLOBAL AUDIO MANAGER
------------------------------------------------------------

Create file:

client/src/systems/AudioManager.ts

Implement:

- Singleton pattern
- Current music reference
- playMusic(key)
- playSFX(key)
- stopMusic()
- stopAll()

Behavior:

• Only one music track at a time
• SFX can overlap
• Safe play with try/catch
• Check cache before play

------------------------------------------------------------
STEP 2 — LOAD ALL AUDIO IN BOOTSCENE
------------------------------------------------------------

In BootScene preload():

Load ALL files with absolute path:

this.load.audio('menu_theme', '/audio/music/menu_theme2.mp3');
this.load.audio('dungeon_ambient', '/audio/ambient/dungeon_ambient.mp3');
this.load.audio('combat_music', '/audio/combat/combat_music.mp3');
this.load.audio('boss_music', '/audio/boss/boss_music.mp3');
this.load.audio('victory_music', '/audio/music/victory_music.mp3');
this.load.audio('game_over_music', '/audio/music/game_over.mp3');

this.load.audio('sword_attack', '/audio/combat/sword_attack.mp3');
this.load.audio('enemy_hit', '/audio/enemies/enemy_hit.mp3');
this.load.audio('enemy_die', '/audio/enemies/enemy_die.mp3');
this.load.audio('dash', '/audio/movement/dash.mp3');
this.load.audio('shield', '/audio/movement/shield_activate.mp3');
this.load.audio('footstep', '/audio/movement/footstep.mp3');
this.load.audio('ui_click', '/audio/ui/menu_click.mp3');

Add load error listener:

this.load.on('loaderror', (file) => {
    console.error('Audio load error:', file);
});

------------------------------------------------------------
STEP 3 — UNLOCK AUDIO ON FIRST USER INPUT
------------------------------------------------------------

In MenuScene create():

this.input.once('pointerdown', () => {
    if (this.sound.locked) {
        this.sound.unlock();
    }
    AudioManager.playMusic(this, 'menu_theme');
});

------------------------------------------------------------
STEP 4 — SCENE MUSIC LOGIC
------------------------------------------------------------

MenuScene:
Play menu_theme

LevelScene start:
AudioManager.playMusic(this, 'dungeon_ambient');

When combat begins:
AudioManager.playMusic(this, 'combat_music');

When boss appears:
AudioManager.playMusic(this, 'boss_music');

VictoryScene:
AudioManager.playMusic(this, 'victory_music');

GameOverScene:
AudioManager.playMusic(this, 'game_over_music');

------------------------------------------------------------
STEP 5 — SFX INTEGRATION
------------------------------------------------------------

On player attack:
AudioManager.playSFX(this, 'sword_attack');

On enemy hit:
AudioManager.playSFX(this, 'enemy_hit');

On enemy death:
AudioManager.playSFX(this, 'enemy_die');

On dash:
AudioManager.playSFX(this, 'dash');

On shield:
AudioManager.playSFX(this, 'shield');

On UI button:
AudioManager.playSFX(this, 'ui_click');

------------------------------------------------------------
STEP 6 — FOOTSTEP LOOP CONTROL
------------------------------------------------------------

Implement throttled step sound:

If player velocity > 0
Play footstep every 250ms

Stop when velocity == 0

------------------------------------------------------------
STEP 7 — SAFE PLAY IMPLEMENTATION
------------------------------------------------------------

Inside AudioManager:

Before playing:
- Check this.cache.audio.exists(key)
- Wrap play() in try/catch
- Log errors but do not crash

------------------------------------------------------------
STEP 8 — CLEAN START
------------------------------------------------------------

In main.ts ensure:

audio: {
   disableWebAudio: false
}

Use default Phaser WebAudio now that files are valid.

------------------------------------------------------------
EXPECTED RESULT
------------------------------------------------------------

• Game launches clean
• Audio loads without decoding error
• Music plays after first click
• Only one music at a time
• SFX works during gameplay
• No console red errors
• Stable hackathon demo ready

Do not refactor gameplay logic.
Only implement audio architecture cleanly.
Ensure TypeScript compiles.
Ensure no runtime crashes.