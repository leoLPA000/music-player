import { clamp, randomOther } from './utils.js';
import { storage } from './storage.js';

/**
 * HTML5 Audio player.
 * Fires custom events on `window`:
 *   cupid:timeupdate  → { currentTime, duration, progress }
 *   cupid:trackchange → { track, index }
 *   cupid:playstate   → { isPlaying }
 *   cupid:ended       → {}
 */
export class Player {
  constructor() {
    this.audio      = new Audio();
    this.tracks     = [];
    this.index      = 0;
    this.playMode   = 'normal'; // 'normal' | 'shuffle' | 'repeat'
    this._volume    = storage.getVolume();
    this._muted     = false;

    this.audio.volume  = this._volume;
    this.audio.preload = 'metadata';

    this._bindEvents();
  }

  /* ── Public API ─────────────────────────────────────── */

  get track()     { return this.tracks[this.index] ?? null; }
  get isPlaying() { return !this.audio.paused; }
  get volume()    { return this._volume; }
  get muted()     { return this._muted; }

  load(tracks, startIndex = 0) {
    this.tracks = tracks;
    this.index  = startIndex;
    this._loadTrack();
  }

  play() {
    if (!this.track) return;
    this.audio.play().catch(() => {});
    this._emit('cupid:playstate', { isPlaying: true });
  }

  pause() {
    this.audio.pause();
    this._emit('cupid:playstate', { isPlaying: false });
  }

  togglePlay() {
    if (this.isPlaying) this.pause(); else this.play();
  }

  next() {
    if (!this.tracks.length) return;
    if (this.playMode === 'shuffle') {
      this.index = randomOther(this.index, this.tracks.length);
    } else {
      this.index = (this.index + 1) % this.tracks.length;
    }
    this._loadTrack(true);
  }

  prev() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }
    if (!this.tracks.length) return;
    this.index = (this.index - 1 + this.tracks.length) % this.tracks.length;
    this._loadTrack(true);
  }

  seek(fraction) {
    if (this.audio.duration) {
      this.audio.currentTime = clamp(fraction) * this.audio.duration;
    }
  }

  setVolume(v) {
    this._volume = clamp(v);
    this.audio.volume = this._muted ? 0 : this._volume;
    storage.setVolume(this._volume);
    if (this._volume > 0) this._muted = false;
    this._emit('cupid:volume', { volume: this._volume, muted: this._muted });
  }

  toggleMute() {
    this._muted = !this._muted;
    this.audio.volume = this._muted ? 0 : this._volume;
    this._emit('cupid:volume', { volume: this._volume, muted: this._muted });
  }

  jumpTo(index) {
    if (index < 0 || index >= this.tracks.length) return;
    this.index = index;
    this._loadTrack(true);
  }

  /* ── Internal ───────────────────────────────────────── */

  _loadTrack(autoplay = false) {
    const t = this.track;
    if (!t) return;
    this.audio.src = t.url;
    this.audio.load();
    this._emit('cupid:trackchange', { track: t, index: this.index });
    if (autoplay || this.isPlaying) {
      this.audio.play().catch(() => {});
      this._emit('cupid:playstate', { isPlaying: true });
    }
  }

  _bindEvents() {
    this.audio.addEventListener('timeupdate', () => {
      const ct = this.audio.currentTime;
      const d  = this.audio.duration || 0;
      this._emit('cupid:timeupdate', {
        currentTime: ct,
        duration:    d,
        progress:    d ? ct / d : 0,
      });
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this._emit('cupid:timeupdate', {
        currentTime: 0,
        duration:    this.audio.duration,
        progress:    0,
      });
    });

    this.audio.addEventListener('ended', () => {
      this._emit('cupid:ended', {});
      if (this.playMode === 'repeat') {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
        return;
      }
      this.next();
    });

    this.audio.addEventListener('play',  () => this._emit('cupid:playstate', { isPlaying: true }));
    this.audio.addEventListener('pause', () => this._emit('cupid:playstate', { isPlaying: false }));
  }

  _emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}
