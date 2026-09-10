// Cloudinary delivers whatever was uploaded unless the URL asks for better -
// a phone photo is often 3-5 MB, which is what makes lists feel slow.
// Inserting a transformation segment into the delivery URL lets Cloudinary
// resize and re-encode on the fly (and cache the result on its CDN):
//
//   .../image/upload/v123/abc.jpg
//   .../image/upload/f_auto,q_auto,w_800/v123/abc.jpg
//
// f_auto = best format for the client (WebP/AVIF), q_auto = automatic quality,
// w_*    = cap the width so we never ship a 4000px image into a 400px card.
//
// Non-Cloudinary URLs are returned untouched, so this is safe for any source.
export function optimizedImage(url, width = 800) {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("/image/upload/")) return url;
  // Don't double-apply if a transformation is already present.
  if (/\/image\/upload\/[^/]*(?:f_auto|q_auto|w_\d+)/.test(url)) return url;
  return url.replace(
    "/image/upload/",
    `/image/upload/f_auto,q_auto,w_${width},c_limit/`,
  );
}

// Convenience sizes for the places we show photos.
export const IMG = {
  thumb: (url) => optimizedImage(url, 200),
  card: (url) => optimizedImage(url, 800),
  full: (url) => optimizedImage(url, 1200),
};
