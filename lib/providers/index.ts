import { FakeReviewProvider } from "./FakeReviewProvider";
import { GoogleBusinessProfileProvider } from "./GoogleBusinessProfileProvider";
import type { ReviewProvider } from "./ReviewProvider";

export * from "./ReviewProvider";
export { FakeReviewProvider } from "./FakeReviewProvider";
export { GoogleBusinessProfileProvider } from "./GoogleBusinessProfileProvider";
export { FIXTURE_LOCATIONS, FIXTURE_REVIEW_COUNT } from "./fixtures";

/**
 * Which provider the app runs on, decided once, here.
 *
 * REVIEW_PROVIDER=fake (the default) serves the synthetic corpus.
 * REVIEW_PROVIDER=google switches to the real one — which will throw until the
 * access described in GoogleBusinessProfileProvider.ts is granted. That is
 * deliberate: it fails loudly at the call site with the reason, rather than
 * quietly falling back to fake data and looking like it worked.
 */
export type ProviderKind = "fake" | "google";

export function configuredProviderKind(): ProviderKind {
  return process.env.REVIEW_PROVIDER === "google" ? "google" : "fake";
}

let fakeSingleton: FakeReviewProvider | null = null;

export function getReviewProvider(auth?: {
  accessToken: string;
  accountName: string;
}): ReviewProvider {
  if (configuredProviderKind() === "google") {
    if (!auth) {
      throw new Error(
        "REVIEW_PROVIDER=google needs a Google access token and account name. See the README section on swapping in the real provider.",
      );
    }
    return new GoogleBusinessProfileProvider(auth.accessToken, auth.accountName);
  }

  // One instance per process, so a reply published in one request is visible to
  // the next — the same continuity a real backend would give us.
  if (!fakeSingleton) fakeSingleton = new FakeReviewProvider();
  return fakeSingleton;
}
