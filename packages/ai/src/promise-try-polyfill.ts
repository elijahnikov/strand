// pdfjs-dist (pulled in by unpdf) calls Promise.try, which isn't available in
// the Convex Node runtime. Import this module before anything that reaches
// pdfjs so the global is patched before pdfjs evaluates.
type PromiseTry = <T, A extends readonly unknown[]>(
  fn: (...args: A) => T | PromiseLike<T>,
  ...args: A
) => Promise<T>;

interface PromiseWithTry extends PromiseConstructor {
  try?: PromiseTry;
}

const P = Promise as PromiseWithTry;
if (typeof P.try !== "function") {
  P.try = ((fn, ...args) => {
    try {
      return Promise.resolve(fn(...args));
    } catch (err) {
      return Promise.reject(err);
    }
  }) as PromiseTry;
}
