// Tiene lo schermo acceso mentre ci si allena (Screen Wake Lock). Se il telefono non lo supporta non succede nulla.
// Il blocco si perde quando l'app va in secondo piano: lo richiediamo di nuovo al ritorno.
export function keepAwake(onChange = () => {}) {
  let lock = null;
  let pending = false;
  let stopped = false;

  const acquire = async () => {
    if (stopped || lock || pending || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    pending = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      onChange(true);
      lock.addEventListener('release', () => { lock = null; if (!stopped) onChange(false); });
    } catch {
      onChange(false);
    } finally {
      pending = false;
    }
  };
  const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };

  document.addEventListener('visibilitychange', onVisible);
  acquire();

  return {
    /** Riprova (utile al primo tocco: alcuni telefoni lo concedono solo dopo un'interazione). */
    retry: acquire,
    release() {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
      lock = null;
    },
  };
}
