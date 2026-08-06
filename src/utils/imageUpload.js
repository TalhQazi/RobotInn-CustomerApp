/**
 * imageUpload.js — receipt/image handling for RobotInn Customer App
 *
 * Why this exists
 * ---------------
 * A Firestore document is hard-capped at 1 MiB, and Base64 inflates binary by
 * ~33%. Embedding a receipt as a `data:` URI therefore risks both a rejected
 * write and — more painfully — an out-of-memory crash on the client, because
 * React Native decodes the FULL bitmap before scaling it into an <Image>. A
 * 1280x1700 JPEG costs ~8.7 MB of RGBA once decoded, no matter how small the
 * view is.
 *
 * The rule this module enforces:
 *   - Binary belongs in Cloud Storage.
 *   - Firestore stores only the resulting https URL string.
 *
 * `uploadReceiptImage()` is the function to call. Base64 embedding exists only
 * as an explicit, opt-in last resort for when Storage is unreachable.
 */

import storage from '@react-native-firebase/storage';
import { Image } from 'react-native';
import ImageEditor from '@react-native-community/image-editor';

/** Firestore's hard per-document ceiling. */
export const FIRESTORE_DOC_LIMIT = 1024 * 1024;

/**
 * Budget for an embedded data URI, in characters (~= bytes for Base64 ASCII).
 * Deliberately well under FIRESTORE_DOC_LIMIT so the rest of the document —
 * items, addresses, status history — still fits.
 */
export const DATA_URI_BUDGET = 700 * 1024;

/**
 * The budget compression actually aims for.
 *
 * Fitting under Firestore's limit is not sufficient on its own: an <Image> fed a
 * large `data:` URI decodes the entire bitmap into memory, which is what makes
 * the order screen die. `isHeavyDataUri()` refuses to render anything above
 * HEAVY_DATA_URI_LIMIT, so if we merely aimed at DATA_URI_BUDGET we would
 * happily store receipts that then show as "Preview unavailable".
 *
 * Targeting comfortably below the render guard means embedded receipts both
 * persist and display.
 */
export const HEAVY_DATA_URI_LIMIT = 200 * 1024;
export const EMBED_TARGET_BUDGET = 180 * 1024;

/**
 * Compression ladder, widest/highest quality first. The first rung that fits
 * wins, so a small receipt keeps its detail and only genuinely large ones get
 * degraded. The tail is deliberately aggressive — a legible low-res receipt
 * beats a crash or a failed write.
 */
export const COMPRESSION_LADDER = [
  { maxDim: 1280, quality: 0.6 },
  { maxDim: 1024, quality: 0.5 },
  { maxDim: 800, quality: 0.4 },
  { maxDim: 640, quality: 0.3 },
  { maxDim: 480, quality: 0.25 },
  { maxDim: 400, quality: 0.2 },
  { maxDim: 320, quality: 0.18 },
  { maxDim: 240, quality: 0.15 },
];

/** Floor for the adaptive pass — below this a receipt is no longer readable. */
const MIN_DIMENSION = 160;
const MIN_QUALITY = 0.1;

/** Normalises a bare filesystem path into a URI the native modules accept. */
export const toFileUri = uri => {
  if (!uri) return '';
  if (uri.startsWith('/') && !uri.startsWith('file://')) return `file://${uri}`;
  return uri;
};

/** Promise wrapper around the callback-style Image.getSize. */
export const getImageSize = uri =>
  new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );

/**
 * Resizes and re-encodes an image once, at the given rung.
 *
 * @returns {Promise<{uri: string, base64?: string, width: number, height: number, size: number}>}
 */
export const compressImage = async (uri, { maxDim, quality, includeBase64 = false }) => {
  const cleanUri = toFileUri(uri);
  const { width, height } = await getImageSize(cleanUri);
  const scale = Math.min(1, maxDim / Math.max(width, height));

  const result = await ImageEditor.cropImage(cleanUri, {
    offset: { x: 0, y: 0 },
    size: { width, height },
    displaySize: {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    },
    resizeMode: 'contain',
    quality,
    format: 'jpeg',
    includeBase64,
  });

  return result;
};

/**
 * Walks the ladder until the encoded image fits `budgetChars`.
 * Throws if even the smallest rung overflows — better a clear error than a
 * write Firestore will reject or an image the client cannot decode.
 *
 * @returns {Promise<{dataUri: string, rung: object, chars: number}>}
 */
export const compressToDataUri = async (uri, budgetChars = EMBED_TARGET_BUDGET) => {
  // Pass 1 — walk the fixed ladder, keeping as much detail as the budget allows.
  for (const rung of COMPRESSION_LADDER) {
    const result = await compressImage(uri, { ...rung, includeBase64: true });
    const dataUri = `data:image/jpeg;base64,${result.base64}`;

    console.log(
      `[IMG] ladder ${rung.maxDim}px q${rung.quality} -> ${dataUri.length} chars (budget ${budgetChars})`,
    );

    if (dataUri.length <= budgetChars) {
      return { dataUri, rung, chars: dataUri.length };
    }
  }

  // Pass 2 — nothing on the ladder fit (an unusually large or noisy photo), so
  // keep shrinking geometrically until it does. Bounded so this can never spin.
  let dim = COMPRESSION_LADDER[COMPRESSION_LADDER.length - 1].maxDim;
  let quality = COMPRESSION_LADDER[COMPRESSION_LADDER.length - 1].quality;
  let last = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    dim = Math.max(MIN_DIMENSION, Math.round(dim * 0.75));
    quality = Math.max(MIN_QUALITY, Number((quality * 0.8).toFixed(2)));

    const result = await compressImage(uri, {
      maxDim: dim,
      quality,
      includeBase64: true,
    });
    const dataUri = `data:image/jpeg;base64,${result.base64}`;
    last = { dataUri, rung: { maxDim: dim, quality }, chars: dataUri.length };

    console.log(
      `[IMG] adaptive ${dim}px q${quality} -> ${dataUri.length} chars (budget ${budgetChars})`,
    );

    if (dataUri.length <= budgetChars) return last;
    if (dim <= MIN_DIMENSION && quality <= MIN_QUALITY) break;
  }

  // Last resort: accept the smallest render provided it is still safely inside
  // Firestore's hard limit. Storing a receipt that renders as a placeholder is
  // strictly better than losing the bill submission entirely.
  if (last && last.chars <= DATA_URI_BUDGET) {
    console.warn(
      `[IMG] could not reach ${budgetChars}; storing ${last.chars} chars (under the ${DATA_URI_BUDGET} hard cap). It may render as a placeholder.`,
    );
    return last;
  }

  throw new Error(
    `Image cannot be embedded: smallest render is ${last ? last.chars : 'unknown'} chars, ` +
      `over the ${DATA_URI_BUDGET} Firestore ceiling.`,
  );
};

/**
 * THE RECOMMENDED PATH.
 *
 * Compresses once for bandwidth, uploads to Cloud Storage, and returns the https
 * download URL — a short string, safe to persist in Firestore, and streamed and
 * cached by the image layer rather than held in the document.
 *
 * Storage path is kept to a single segment under the prefix so a rule written as
 * `match /receipts/{fileName}` matches it. Use `{allPaths=**}` if you prefer
 * nesting.
 *
 * @param {string} localUri     file:// URI from the picker/camera
 * @param {object} [options]
 * @param {string} [options.prefix='receipts']  Storage folder
 * @param {string} [options.id]                 correlation id (order id)
 * @param {boolean} [options.embedOnFailure=false]  opt-in Base64 fallback
 * @returns {Promise<{url: string, embedded: boolean, bytes: number}>}
 */
export const uploadReceiptImage = async (localUri, options = {}) => {
  const { prefix = 'receipts', id = 'receipt', embedOnFailure = false } = options;

  const cleanUri = toFileUri(localUri);
  if (!cleanUri) throw new Error('uploadReceiptImage: no image URI supplied');

  // Compress before upload regardless — smaller uploads are faster and cheaper,
  // and the stored asset stays a sensible size for later viewing.
  const [best] = COMPRESSION_LADDER;
  const compressed = await compressImage(cleanUri, { ...best, includeBase64: false });
  const uploadUri = toFileUri(compressed.uri || compressed.path);

  const fileName = `${id}_${Date.now()}.jpg`;
  const storagePath = `${prefix}/${fileName}`;

  try {
    const ref = storage().ref(storagePath);
    await ref.putFile(uploadUri, { contentType: 'image/jpeg' });
    const url = await ref.getDownloadURL();
    return { url, embedded: false, bytes: compressed.size || 0 };
  } catch (err) {
    if (!embedOnFailure) {
      // Surface the real cause. storage/object-not-found here almost always means
      // the project has no Cloud Storage bucket provisioned, not a bad path.
      throw err;
    }
    const { dataUri, chars } = await compressToDataUri(cleanUri);
    return { url: dataUri, embedded: true, bytes: chars };
  }
};

/**
 * Guard for the render side. An <Image> fed a large `data:` URI decodes the
 * whole bitmap into memory and is the usual cause of "keeps stopping" on the
 * order details screen. Use this to decide whether to render a thumbnail or a
 * lightweight fallback.
 */
export const isHeavyDataUri = (uri, maxChars = HEAVY_DATA_URI_LIMIT) =>
  typeof uri === 'string' && uri.startsWith('data:') && uri.length > maxChars;
