import { buildFixtureReviews, FIXTURE_LOCATIONS } from "./fixtures";
import type {
  FetchReviewsOptions,
  ProviderLocation,
  ProviderReview,
  PublishResult,
  ReviewProvider,
} from "./ReviewProvider";

/**
 * The provider the application actually runs on today.
 *
 * It serves a fixed synthetic corpus. It is not a mock in the testing sense —
 * it is a real implementation of the interface whose backing store happens to
 * be a file instead of Google's API, and the sync path above it is the same
 * code that will drive the real provider.
 *
 * The one thing it will not do is pretend. `publishReply` marks the review
 * published and says, in the activity log, that nothing left this machine.
 */
export class FakeReviewProvider implements ReviewProvider {
  readonly name = "Synthetic review data";

  /** Nothing published through here reaches a customer, and we say so. */
  readonly publishesForReal = false;

  private readonly reviews: Map<string, ProviderReview[]>;

  constructor(now: Date = new Date()) {
    this.reviews = buildFixtureReviews(now);
  }

  async listLocations(): Promise<ProviderLocation[]> {
    return FIXTURE_LOCATIONS;
  }

  async fetchReviews(
    locationExternalId: string,
    options: FetchReviewsOptions = {},
  ): Promise<ProviderReview[]> {
    const all = this.reviews.get(locationExternalId) ?? [];

    // Honour the watermark the way the real API does, so the sync's incremental
    // path is exercised here rather than only in production.
    const since = options.since;
    const filtered = since
      ? all.filter((review) => review.updatedAt.getTime() > since.getTime())
      : all;

    return options.limit ? filtered.slice(0, options.limit) : filtered;
  }

  async publishReply(
    locationExternalId: string,
    reviewExternalId: string,
    reply: string,
  ): Promise<PublishResult> {
    const review = (this.reviews.get(locationExternalId) ?? []).find(
      (r) => r.externalId === reviewExternalId,
    );

    if (!review) {
      return {
        published: false,
        detail: `No review ${reviewExternalId} at ${locationExternalId}.`,
      };
    }

    review.existingReply = reply;

    return {
      published: true,
      detail:
        "Recorded locally. No reply was sent to Google — this profile is synthetic.",
    };
  }
}
