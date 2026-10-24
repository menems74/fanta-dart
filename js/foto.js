// Foto del profilo: si ritaglia quadrata al centro e si rimpicciolisce a 192x192 JPEG (10-20 KB),
// cosi' sta comodamente nella scheda del giocatore su Firestore.
const LATO = 192;
export const MAX_FOTO = 60000; // caratteri del data URL accettati dalle regole

/** Da un file immagine (galleria o fotocamera) a un data URL JPEG quadrato. */
export async function preparaFoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Scegli un\'immagine');
  // createImageBitmap tiene conto dell'orientamento salvato dalla fotocamera
  const img = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const lato = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = LATO;
  canvas.height = LATO;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.width - lato) / 2, (img.height - lato) / 2, lato, lato, 0, 0, LATO, LATO);
  img.close?.();
  for (const q of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length < MAX_FOTO) return url;
  }
  throw new Error('Immagine troppo pesante');
}
