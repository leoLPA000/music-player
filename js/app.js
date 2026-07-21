import { Player }         from './player.js';
import { fetchCanciones } from './supabase.js';
import { storage }        from './storage.js';
import { formatTime, clamp } from './utils.js';

/* ──────────────────────────────────────────────────────
   ASSET PATHS (pink = A, blue = B)
────────────────────────────────────────────────────── */
const ASSETS = {
  pink: {
    frame:            'assets/pink/frame.png',
    frameNoBg:        'assets/pink/frame_no_background.png',
    recordPlayer:     'assets/pink/record_player.png',
    albumFrame:       'assets/pink/album_frame.png',
    plant:            'assets/pink/plant.png',
    progressBar:      'assets/pink/progress_bar.png',
    settings:         'assets/pink/settings.png',
    playButton:       'assets/pink/play_button.png',
    pauseButton:      'assets/pink/pause_button.png',
    backwardsButton:  'assets/pink/backwards_button.png',
    forwardsButton:   'assets/pink/forwards_button.png',
    minimizerButton:  'assets/pink/minimizer_button.png',
    windowButton:     'assets/pink/window_button.png',
    exitButton:       'assets/pink/exit_button.png',
    volumeButton:     'assets/pink/volume_button.png',
    muteButton:       'assets/pink/mute_button.png',
    volumeBarHigh:    'assets/pink/volume_bar_high.png',
    volumeBarLow:     'assets/pink/volume_bar_low.png',
    shuffleButton:    'assets/pink/shuffle_button.png',
    repeatButton:     'assets/pink/repeat_button.png',
    recordFrames: [
      'assets/animations/record-pink/frame-1.png',
      'assets/animations/record-pink/frame-2.png',
      'assets/animations/record-pink/frame-3.png',
      'assets/animations/record-pink/frame-4.png',
    ],
    needlePlay: [
      'assets/animations/pink/needle-playing/frame-1.png',
      'assets/animations/pink/needle-playing/frame-2.png',
      'assets/animations/pink/needle-playing/frame-3.png',
    ],
    needleChange: [
      'assets/animations/pink/needle-change/frame-1.png',
      'assets/animations/pink/needle-change/frame-2.png',
      'assets/animations/pink/needle-change/frame-3.png',
    ],
  },
  blue: {
    frame:            'assets/blue/frame.png',
    frameNoBg:        'assets/blue/frame_no_background.png',
    recordPlayer:     'assets/blue/record_player.png',
    albumFrame:       'assets/blue/album_frame.png',
    plant:            'assets/blue/plant.png',
    progressBar:      'assets/blue/progress_bar.png',
    settings:         'assets/blue/settings.png',
    playButton:       'assets/blue/play_button.png',
    pauseButton:      'assets/blue/pause_button.png',
    backwardsButton:  'assets/blue/backwards_button.png',
    forwardsButton:   'assets/blue/forwards_button.png',
    minimizerButton:  'assets/blue/minimizer_button.png',
    windowButton:     'assets/blue/window_button.png',
    exitButton:       'assets/blue/exit_button.png',
    volumeButton:     'assets/blue/volume_button.png',
    muteButton:       'assets/blue/mute_button.png',
    volumeBarHigh:    'assets/blue/volume_bar_high.png',
    volumeBarLow:     'assets/blue/volume_bar_low.png',
    shuffleButton:    'assets/blue/shuffle_button.png',
    repeatButton:     'assets/blue/repeat_button.png',
    recordFrames: [
      'assets/animations/record-blue/frame-1.png',
      'assets/animations/record-blue/frame-2.png',
      'assets/animations/record-blue/frame-3.png',
      'assets/animations/record-blue/frame-4.png',
    ],
    needlePlay: [
      'assets/animations/blue/needle-playing/frame-1.png',
      'assets/animations/blue/needle-playing/frame-2.png',
      'assets/animations/blue/needle-playing/frame-3.png',
    ],
    needleChange: [
      'assets/animations/blue/needle-change/frame-1.png',
      'assets/animations/blue/needle-change/frame-2.png',
      'assets/animations/blue/needle-change/frame-3.png',
    ],
  },
};

/* ──────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────── */
const state = {
  theme:     storage.getTheme(),     // 'pink' | 'blue'
  playMode:  'normal',               // 'normal' | 'shuffle' | 'repeat'
  // animation
  recordFrame:      0,
  needleFrame:      0,
  swapping:         false,
  needleLifted:     false,
  needleChangeFrame:0,
  currentThemeIdx:  0,               // toggles between pink/blue record frames during swap
  prevTrackTitle:   null,
  // progress bar
  dragging:         false,
  hoverProgress:    null,
  starHovered:      false,
  // volume
  volumeHovered:    false,
  volumeDragging:   false,
  // UI
  showSettings:     false,
  tracks:           [],
  loadingTracks:    false,
  settingsError:    null,
};

/* ──────────────────────────────────────────────────────
   DOM REFS — cached once after DOMContentLoaded
────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const Q = (sel, ctx = document) => ctx.querySelector(sel);

let dom = {};

/* ──────────────────────────────────────────────────────
   PLAYER INSTANCE
────────────────────────────────────────────────────── */
const player = new Player();

/* ──────────────────────────────────────────────────────
   ANIMATION LOOPS
────────────────────────────────────────────────────── */
let spinInterval  = null;

function startSpin() {
  if (spinInterval) return;
  spinInterval = setInterval(() => {
    if (state.swapping) return;
    state.recordFrame = (state.recordFrame + 1) % 4;
    state.needleFrame = (state.needleFrame + 1) % 3;
    renderRecord();
    renderNeedle();
  }, 400);
}

function stopSpin() {
  clearInterval(spinInterval);
  spinInterval = null;
}

/* Needle-lift → record-swap → needle-lower sequence */
function triggerTrackChange() {
  if (state.swapping || state.needleLifted) return;
  state.needleLifted = true;
  state.needleChangeFrame = 0;
  renderNeedle();

  setTimeout(() => { state.needleChangeFrame = 1; renderNeedle(); }, 200);

  setTimeout(() => {
    state.swapping = true;
    renderRecord();
  }, 400);

  setTimeout(() => {
    state.currentThemeIdx = state.currentThemeIdx === 0 ? 1 : 0;
    state.recordFrame = 0;
    state.swapping = false;
    renderRecord();
  }, 1000);

  setTimeout(() => {
    state.needleChangeFrame = 0;
    state.needleLifted = false;
    state.needleFrame  = 0;
    renderNeedle();
  }, 1100);
}

/* ──────────────────────────────────────────────────────
   RENDER HELPERS
────────────────────────────────────────────────────── */
function themeAssets() {
  return ASSETS[state.theme];
}

/* Which two record-frame sets to show (swap between themes A/B) */
function recordSets() {
  const themes = ['pink', 'blue'];
  const cur  = themes[state.currentThemeIdx % 2];
  const next = themes[(state.currentThemeIdx + 1) % 2];
  return { cur: ASSETS[cur].recordFrames, next: ASSETS[next].recordFrames };
}

function renderTheme() {
  const player = Q('.player');
  if (!player) return;
  player.classList.toggle('theme-blue', state.theme === 'blue');

  const a = themeAssets();
  // Static themed layers
  dom.imgFrame.src    = a.frame;
  dom.imgFrameNoBg.src = a.frameNoBg;
  dom.imgRecordPlayer.src = a.recordPlayer;
  dom.imgAlbumFrame.src = a.albumFrame;
  dom.imgPlant.src    = a.plant;
  dom.imgProgressBar.src = a.progressBar;
  dom.imgSettings.src = a.settings;
  dom.imgBackwards.src = a.backwardsButton;
  dom.imgForwards.src  = a.forwardsButton;
  dom.imgMinimizer.src = a.minimizerButton;
  dom.imgWindow.src    = a.windowButton;
  dom.imgExit.src      = a.exitButton;
  renderPlayButton();
  renderVolumeButton();
  renderPlayModeButton();
}

function renderPlayButton() {
  const a = themeAssets();
  dom.imgPlay.src = player.isPlaying ? a.pauseButton : a.playButton;
}

function renderVolumeButton() {
  const a = themeAssets();
  dom.imgVolume.src = player.muted ? a.muteButton : a.volumeButton;
}

function renderPlayModeButton() {
  const a = themeAssets();
  dom.imgPlayMode.src = state.playMode === 'repeat' ? a.repeatButton : a.shuffleButton;
  dom.imgPlayMode.style.opacity = state.playMode === 'normal' ? '0.4' : '0.8';
}

function renderRecord() {
  const { cur, next } = recordSets();
  dom.imgRecord.src = cur[state.recordFrame];
  dom.imgRecord.classList.toggle('record-slide-out', state.swapping);

  if (state.swapping) {
    dom.imgRecordIn.src = next[0];
    dom.imgRecordIn.style.display = '';
    dom.imgRecordIn.classList.add('record-slide-in');
  } else {
    dom.imgRecordIn.style.display = 'none';
    dom.imgRecordIn.classList.remove('record-slide-in');
  }
}

function renderNeedle() {
  const a = themeAssets();
  dom.imgNeedle.src = state.needleLifted
    ? a.needleChange[state.needleChangeFrame]
    : a.needlePlay[state.needleFrame];
}

function renderNowPlaying(track) {
  if (!track) {
    dom.trackTitle.textContent  = '...';
    dom.trackArtist.textContent = 'de —';
    dom.albumMask.style.display = 'none';
    return;
  }
  updateMarquee(track.title);
  dom.trackArtist.textContent = `de ${track.artist}`;

  if (track.art) {
    dom.albumArt.src = track.art;
    dom.albumMask.style.display = '';
  } else {
    dom.albumMask.style.display = 'none';
  }
}

/* Marquee logic — scroll only when text overflows */
function updateMarquee(text) {
  dom.trackTitle.innerHTML = '';
  const measure = document.createElement('span');
  measure.className = 'marquee-measure';
  measure.textContent = text;
  dom.trackTitle.appendChild(measure);

  requestAnimationFrame(() => {
    const overflows = measure.offsetWidth > dom.trackTitle.clientWidth;
    measure.remove();
    if (overflows) {
      const span = document.createElement('span');
      span.className = 'marquee-scroll';
      span.textContent = text;
      const gap = document.createElement('span');
      gap.className = 'marquee-gap';
      gap.textContent = text;
      span.appendChild(gap);
      dom.trackTitle.appendChild(span);
    } else {
      dom.trackTitle.textContent = text;
    }
  });
}

function renderProgress(progress, currentTime, duration) {
  const pct = state.hoverProgress ?? progress;

  // Sparkle fill — bar spans image x=132..371 (measured from the PNG).
  // inset % are relative to the 526px rendered layer; the 512→526 stretch
  // cancels when expressed as fractions of 512, so we can use image coords directly.
  const sparkleX = 132 + pct * 239 + 10; // +10 so star always sits inside the lit region
  dom.imgProgressStars.style.clipPath =
    `inset(0 ${Math.max(0, (1 - sparkleX / 512) * 100).toFixed(2)}% 0 0)`;

  // Star indicator — must use var(--vw) not vw so it scales with the zoom-based layout.
  // Star graphic center sits at image x=140 → player x≈33.8 with no transform.
  // Seek bar spans player x=30..271 (from CSS left/width of #seek-bar).
  const STAR_DEFAULT = 33.8;          // player-px of star centre at translateX=0
  const starPlayerX  = 30 + pct * 241; // target player-px (30 = bar start, 271 = bar end)
  const translateFrac = (starPlayerX - STAR_DEFAULT) / 306; // fraction of --vw
  dom.imgStar.style.transform =
    `translateX(calc(${translateFrac.toFixed(6)} * var(--vw, 306px)))`;
  dom.imgStar.src = state.starHovered
    ? 'assets/star_selected.png'
    : 'assets/star.png';

  // time labels
  dom.timeLeft.textContent     = formatTime(currentTime);
  dom.timeRight.textContent    = formatTime(duration - currentTime);
}

function renderVolumeBar(volume, muted) {
  if (!(state.volumeHovered || state.volumeDragging)) return;
  const effective = muted ? 0 : volume;
  // clipPath from top: proportion of bar that is "empty"
  dom.imgVolumeBarHigh.style.clipPath =
    `inset(${(1 - effective) * 100}% 0 0 0)`;
}

function renderSettings() {
  dom.settingsPanel.style.display = state.showSettings ? '' : 'none';

  // Theme buttons
  dom.btnThemePink.classList.toggle('active', state.theme === 'pink');
  dom.btnThemeBlue.classList.toggle('active', state.theme === 'blue');

  // Play mode buttons
  dom.btnModeNormal.classList.toggle('active',  state.playMode === 'normal');
  dom.btnModeShuffle.classList.toggle('active', state.playMode === 'shuffle');
  dom.btnModeRepeat.classList.toggle('active',  state.playMode === 'repeat');

  // Error
  dom.settingsError.textContent = state.settingsError || '';
  dom.settingsError.style.display = state.settingsError ? '' : 'none';

  // Loading indicator
  dom.settingsLoading.style.display = state.loadingTracks ? '' : 'none';
  dom.playlistList.style.display    = state.loadingTracks ? 'none' : '';

  // Playlist items
  renderPlaylistList();
}

function renderPlaylistList() {
  dom.playlistList.innerHTML = '';
  if (!state.tracks.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-label';
    empty.textContent = 'sin canciones';
    dom.playlistList.appendChild(empty);
    return;
  }

  state.tracks.forEach((t, i) => {
    const btn = document.createElement('button');
    btn.className = 'settings-playlist-item' +
      (i === player.index ? ' active' : '');
    btn.textContent = t.title;
    btn.title = `${t.title} — ${t.artist}`;
    btn.addEventListener('click', () => {
      player.jumpTo(i);
      if (!player.isPlaying) player.play();
    });
    dom.playlistList.appendChild(btn);
  });
}

function renderVolumeZone() {
  const expanded = state.volumeHovered || state.volumeDragging;
  dom.volumeZone.classList.toggle('expanded', expanded);
  dom.imgVolumeBarLow.style.display  = expanded ? '' : 'none';
  dom.imgVolumeBarHigh.style.display = expanded ? '' : 'none';
}

/* ──────────────────────────────────────────────────────
   PLAYER EVENT HANDLERS
────────────────────────────────────────────────────── */
window.addEventListener('cupid:playstate', ({ detail: { isPlaying } }) => {
  if (isPlaying) startSpin(); else stopSpin();
  renderPlayButton();
});

window.addEventListener('cupid:trackchange', ({ detail: { track } }) => {
  if (state.prevTrackTitle !== null &&
      state.prevTrackTitle !== track.title) {
    triggerTrackChange();
  }
  state.prevTrackTitle = track.title;
  renderNowPlaying(track);
  renderPlaylistList();
});

window.addEventListener('cupid:timeupdate', ({ detail: { currentTime, duration, progress } }) => {
  if (!state.dragging) renderProgress(progress, currentTime, duration);
});

window.addEventListener('cupid:volume', ({ detail: { volume, muted } }) => {
  renderVolumeButton();
  renderVolumeBar(volume, muted);
});

/* ──────────────────────────────────────────────────────
   LOAD SONGS
────────────────────────────────────────────────────── */
async function loadSongs() {
  state.loadingTracks  = true;
  state.settingsError  = null;
  renderSettings();

  try {
    const tracks = await fetchCanciones();
    state.tracks = tracks;
    player.load(tracks, 0);
    renderNowPlaying(tracks[0] ?? null);
  } catch (err) {
    state.settingsError = err.message;
    console.error(err);
  } finally {
    state.loadingTracks = false;
    renderSettings();
  }
}

/* ──────────────────────────────────────────────────────
   SEEK BAR — drag handling
────────────────────────────────────────────────────── */
function initSeekBar() {
  dom.seekBar.addEventListener('mouseenter', () => {
    state.starHovered = true;
  });
  dom.seekBar.addEventListener('mouseleave', () => {
    if (!state.dragging) { state.starHovered = false; state.hoverProgress = null; }
  });
  dom.seekBar.addEventListener('mousedown', (e) => {
    e.preventDefault();
    state.dragging = true;
    updateSeekFromEvent(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;
    updateSeekFromEvent(e);
  });
  window.addEventListener('mouseup', () => {
    if (!state.dragging) return;
    if (state.hoverProgress !== null) player.seek(state.hoverProgress);
    state.dragging = false;
    state.starHovered = false;
    state.hoverProgress = null;
  });

  // Touch support
  dom.seekBar.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.dragging = true;
    updateSeekFromTouch(e);
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!state.dragging) return;
    updateSeekFromTouch(e);
  });
  window.addEventListener('touchend', () => {
    if (!state.dragging) return;
    if (state.hoverProgress !== null) player.seek(state.hoverProgress);
    state.dragging = false;
    state.hoverProgress = null;
  });
}

function updateSeekFromEvent(e) {
  const rect = dom.seekBar.getBoundingClientRect();
  const pct  = clamp((e.clientX - rect.left) / rect.width);
  state.hoverProgress = pct;
  const dur = player.audio.duration;
  renderProgress(pct, pct * (dur || 0), dur || 0);
}
function updateSeekFromTouch(e) {
  const touch = e.touches[0];
  const rect  = dom.seekBar.getBoundingClientRect();
  const pct   = clamp((touch.clientX - rect.left) / rect.width);
  state.hoverProgress = pct;
  const dur = player.audio.duration;
  renderProgress(pct, pct * (dur || 0), dur || 0);
}

/* ──────────────────────────────────────────────────────
   VOLUME BAR — drag handling
────────────────────────────────────────────────────── */
function initVolumeBar() {
  dom.volumeZone.addEventListener('mouseenter', () => {
    state.volumeHovered = true;
    renderVolumeZone();
    renderVolumeBar(player.volume, player.muted);
  });
  dom.volumeZone.addEventListener('mouseleave', () => {
    if (!state.volumeDragging) {
      state.volumeHovered = false;
      renderVolumeZone();
    }
  });

  dom.btnVolumeIcon.addEventListener('click', () => {
    player.toggleMute();
    renderVolumeBar(player.volume, player.muted);
  });

  dom.volumeBarArea.addEventListener('mousedown', (e) => {
    e.preventDefault();
    state.volumeDragging = true;
    updateVolumeFromEvent(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (!state.volumeDragging) return;
    updateVolumeFromEvent(e);
  });
  window.addEventListener('mouseup', () => {
    if (!state.volumeDragging) return;
    state.volumeDragging = false;
    state.volumeHovered  = false;
    renderVolumeZone();
  });
}

function updateVolumeFromEvent(e) {
  const rect = dom.volumeBarArea.getBoundingClientRect();
  const pct  = clamp(1 - (e.clientY - rect.top) / rect.height);
  player.setVolume(pct);
  renderVolumeBar(player.volume, player.muted);
}

/* ──────────────────────────────────────────────────────
   SETTINGS PANEL CLOSE ON OUTSIDE CLICK
────────────────────────────────────────────────────── */
function initSettingsClose() {
  document.addEventListener('mousedown', (e) => {
    if (!state.showSettings) return;
    if (dom.settingsPanel.contains(e.target)) return;
    if (dom.btnSettings.contains(e.target)) return;
    state.showSettings = false;
    renderSettings();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.showSettings) {
      state.showSettings = false;
      renderSettings();
    }
  });
}

/* ──────────────────────────────────────────────────────
   SEARCH FILTER
────────────────────────────────────────────────────── */
function initSearch() {
  dom.searchInput.addEventListener('input', () => {
    const q = dom.searchInput.value.toLowerCase().trim();
    const items = dom.playlistList.querySelectorAll('.settings-playlist-item');
    items.forEach((item) => {
      item.style.display =
        !q || item.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

/* ──────────────────────────────────────────────────────
   KEYBOARD SHORTCUTS
────────────────────────────────────────────────────── */
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space':     e.preventDefault(); player.togglePlay(); break;
      case 'ArrowRight':e.preventDefault(); player.next(); break;
      case 'ArrowLeft': e.preventDefault(); player.prev(); break;
      case 'ArrowUp':
        e.preventDefault();
        player.setVolume(clamp(player.volume + 0.05));
        renderVolumeBar(player.volume, player.muted);
        break;
      case 'ArrowDown':
        e.preventDefault();
        player.setVolume(clamp(player.volume - 0.05));
        renderVolumeBar(player.volume, player.muted);
        break;
      case 'KeyM':
        player.toggleMute();
        renderVolumeBar(player.volume, player.muted);
        break;
    }
  });
}

/* ──────────────────────────────────────────────────────
   WIRE UP STATIC BUTTONS
────────────────────────────────────────────────────── */
function wireButtons() {
  /* Playback */
  dom.btnPrev.addEventListener('click', () => player.prev());
  dom.btnPlay.addEventListener('click', () => player.togglePlay());
  dom.btnNext.addEventListener('click', () => player.next());

  /* Play mode cycle */
  dom.btnPlayMode.addEventListener('click', () => {
    state.playMode = state.playMode === 'normal'  ? 'shuffle'
                   : state.playMode === 'shuffle' ? 'repeat'
                   : 'normal';
    player.playMode = state.playMode;
    renderPlayModeButton();
    renderSettings();
  });

  /* Settings toggle */
  dom.btnSettings.addEventListener('click', () => {
    state.showSettings = !state.showSettings;
    renderSettings();
  });

  /* Window controls (no-op in browser, kept for visual parity) */
  dom.btnMinimize.addEventListener('click', () => window.blur?.());
  dom.btnWindow.addEventListener('click',   () => {});
  dom.btnExit.addEventListener('click',    () => {});

  /* Theme */
  dom.btnThemePink.addEventListener('click', () => setTheme('pink'));
  dom.btnThemeBlue.addEventListener('click', () => setTheme('blue'));

  /* Play mode in settings */
  dom.btnModeNormal.addEventListener('click',  () => setPlayMode('normal'));
  dom.btnModeShuffle.addEventListener('click', () => setPlayMode('shuffle'));
  dom.btnModeRepeat.addEventListener('click',  () => setPlayMode('repeat'));

  /* Reload songs */
  dom.btnReload.addEventListener('click', () => loadSongs());
}

function setTheme(t) {
  state.theme = t;
  storage.setTheme(t);
  renderTheme();
  renderSettings();
}

function setPlayMode(m) {
  state.playMode  = m;
  player.playMode = m;
  renderPlayModeButton();
  renderSettings();
}

/* ──────────────────────────────────────────────────────
   RESPONSIVE SIZE  (fluid, works on any screen/orientation)
   Player ratio: 306 wide × 497 tall.
   --player-vw = max width so height fits inside the viewport.
────────────────────────────────────────────────────── */
function updateSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const BASE_W = 306;
  const BASE_H = 497;
  const MARGIN  = 0.94;
  const zoomByW = (vw * MARGIN) / BASE_W;
  const zoomByH = (vh * MARGIN) / BASE_H;
  const zoom = Math.min(zoomByW, zoomByH);
  document.documentElement.style.setProperty('--player-zoom', zoom.toFixed(4));
}
/* Expose for testing / external triggers */
window.__cupidResize = updateSize;

/* ──────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  /* Size the player before anything renders */
  updateSize();
  /* Cache DOM references */
  dom = {
    imgFrame:          $('img-frame'),
    imgFrameNoBg:      $('img-frame-nobg'),
    imgRecordPlayer:   $('img-record-player'),
    imgRecord:         $('img-record'),
    imgRecordIn:       $('img-record-in'),
    imgNeedle:         $('img-needle'),
    imgAlbumFrame:     $('img-album-frame'),
    imgPlant:          $('img-plant'),
    imgProgressBar:    $('img-progress-bar'),
    imgProgressStars:  $('img-progress-stars'),
    imgStar:           $('img-star'),
    imgPlay:           $('img-play'),
    imgBackwards:      $('img-backwards'),
    imgForwards:       $('img-forwards'),
    imgVolume:         $('img-volume'),
    imgVolumeBarLow:   $('img-volume-bar-low'),
    imgVolumeBarHigh:  $('img-volume-bar-high'),
    imgPlayMode:       $('img-play-mode'),
    imgMinimizer:      $('img-minimizer'),
    imgWindow:         $('img-window'),
    imgExit:           $('img-exit'),
    imgSettings:       $('img-settings'),

    trackTitle:        $('track-title'),
    trackArtist:       $('track-artist'),
    albumMask:         $('album-mask'),
    albumArt:          $('album-art'),
    timeLeft:          $('time-left'),
    timeRight:         $('time-right'),

    seekBar:           $('seek-bar'),
    btnPrev:           $('btn-prev'),
    btnPlay:           $('btn-play'),
    btnNext:           $('btn-next'),
    btnPlayMode:       $('btn-play-mode'),
    btnSettings:       $('btn-settings'),
    btnMinimize:       $('btn-minimize'),
    btnWindow:         $('btn-window'),
    btnExit:           $('btn-exit'),
    btnVolumeIcon:     $('btn-volume-icon'),
    volumeZone:        $('volume-zone'),
    volumeBarArea:     $('volume-bar-area'),

    settingsPanel:     $('settings-panel'),
    btnThemePink:      $('btn-theme-pink'),
    btnThemeBlue:      $('btn-theme-blue'),
    btnModeNormal:     $('btn-mode-normal'),
    btnModeShuffle:    $('btn-mode-shuffle'),
    btnModeRepeat:     $('btn-mode-repeat'),
    btnReload:         $('btn-reload'),
    settingsError:     $('settings-error'),
    settingsLoading:   $('settings-loading'),
    playlistList:      $('playlist-list'),
    searchInput:       $('search-input'),
  };

  /* Apply saved theme */
  renderTheme();
  renderNowPlaying(null);
  renderProgress(0, 0, 0);
  renderSettings();

  /* Wire interactions */
  wireButtons();
  initSeekBar();
  initVolumeBar();
  initSettingsClose();
  initSearch();
  initKeyboard();

  /* Fetch songs from Supabase */
  loadSongs();

  /* Resize / orientation — recalculate player size */
  window.addEventListener('resize', updateSize);
  window.addEventListener('orientationchange', () => {
    /* Small delay so the browser has committed the new dimensions */
    setTimeout(updateSize, 150);
  });

  /* iOS Safari: address bar appears/disappears — visualViewport handles it */
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateSize);
  }
});
