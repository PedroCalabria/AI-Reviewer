/**
 * The seam between this application and wherever reviews actually come from.
 *
 * Everything above this interface — sync, triage, drafting, publishing — is
 * written against these three methods and knows nothing about Google. That is
 * what makes swapping the synthetic provider for the real one a configuration
 * change rather than a rewrite. See GoogleBusinessProfileProvider.ts for the
 * real endpoints and what is blocking us from calling them.
 */

export type ProviderLocation = {
  /** The provider's own identifier for this location. */
  externalId: string;
  name: string;
  address: string;
};

export type ProviderReview = {
  /** The provider's own identifier for this review. Unique per location. */
  externalId: string;
  authorName: string;
  /** 1 to 5. */
  rating: number;
  /** May be empty: a rating with no text is a normal thing to receive. */
  text: string;
  /** BCP-47 tag when the provider reports one. */
  language?: string;
  /** When the customer wrote it. */
  postedAt: Date;
  /** The provider's last-modified stamp. Drives the incremental watermark. */
  updatedAt: Date;
  /** A reply already on the profile, if the provider reports one. */
  existingReply?: string;
};

export type FetchReviewsOptions = {
  /**
   * Fetch only reviews modified strictly after this instant. The sync stores
   * the high-water mark per location, so a re-run costs one page, not a scan.
   */
  since?: Date;
  limit?: number;
};

export type PublishResult = {
  published: boolean;
  /** Stated plainly enough to go straight into the activity log. */
  detail: string;
};

export interface ReviewProvider {
  /** Which provider this is, for the activity log and the settings screen. */
  readonly name: string;

  /**
   * True when replies posted through this provider actually reach a customer.
   * The UI reads this so it never claims a reply went somewhere it did not.
   */
  readonly publishesForReal: boolean;

  listLocations(): Promise<ProviderLocation[]>;

  fetchReviews(
    locationExternalId: string,
    options?: FetchReviewsOptions,
  ): Promise<ProviderReview[]>;

  publishReply(
    locationExternalId: string,
    reviewExternalId: string,
    reply: string,
  ): Promise<PublishResult>;
}

/** Thrown by a provider method that exists but cannot run yet. */
export class NotImplementedError extends Error {
  constructor(method: string, reason: string) {
    super(`${method} is not available: ${reason}`);
    this.name = "NotImplementedError";
  }
}
