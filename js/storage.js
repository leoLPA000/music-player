/* Persistent state via localStorage */
const K = {
  THEME:   'cupid-player-theme',
  VOLUME:  'cupid-volume',
  SERVICE: 'cupid-player-music-service',
};

export const storage = {
  getTheme:   ()  => localStorage.getItem(K.THEME)   || 'pink',
  setTheme:   (v) => localStorage.setItem(K.THEME, v),

  getVolume:  ()  => {
    const v = localStorage.getItem(K.VOLUME);
    return v !== null ? parseFloat(v) : 1;
  },
  setVolume:  (v) => localStorage.setItem(K.VOLUME, String(v)),
};
