// Afbeeldings-helpers voor de browser.
//
// Afbeeldingen worden opgeslagen als gecomprimeerde JPEG data-URL, zodat ze
// binnen de Upstash-limiet (~1 MB per waarde) passen. Foto's die het model moet
// lezen — een kassabon met kleine letters — gaan met een hogere maxDim mee.
//
// Staat hier en niet in een component omdat inmiddels drie schermen hem nodig
// hebben: recepten, kassabonnen en productfoto's. Drie kopieën van een
// schaalfunctie lopen gegarandeerd uit elkaar.

export const MAX_DIM = 1000; // langste zijde in px na compressie

export function fileNaarDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/** Schaalt en comprimeert een data-URL naar een JPEG data-URL. */
export function comprimeerAfbeelding(
  bron: string, kwaliteit = 0.82, maxDim = MAX_DIM
): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
      else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return rej(new Error("geen canvas"));
      ctx.drawImage(img, 0, 0, width, height);
      res(canvas.toDataURL("image/jpeg", kwaliteit));
    };
    img.onerror = rej;
    img.src = bron;
  });
}
