const DEFAULT_MS = 6000;

export function withFirestoreTimeout<T>(
  promise: Promise<T>,
  ms = DEFAULT_MS
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('Firestore request timed out')), ms);
    }),
  ]);
}
