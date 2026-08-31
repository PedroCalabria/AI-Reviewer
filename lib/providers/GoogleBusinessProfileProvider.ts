import {
  NotImplementedError,
  type FetchReviewsOptions,
  type ProviderLocation,
  type ProviderReview,
  type PublishResult,
  type ReviewProvider,
} from "./ReviewProvider";

/**
 * The real provider, scaffolded.
 *
 * ---------------------------------------------------------------------------
 * Why every method throws
 * ---------------------------------------------------------------------------
 * The Google Business Profile APIs are not open. Using them requires all of:
 *
 *   1. A verified Google Business Profile that you own or manage.
 *   2. An approved access request for the Business Profile API group, submitted
 *      through Google's standard access form. Approval is manual and is granted
 *      per Google Cloud project.
 *   3. The `https://www.googleapis.com/auth/business.manage` OAuth scope, which
 *      is a restricted scope: an app requesting it from users outside its own
 *      organisation needs to pass Google's OAuth verification, and restricted
 *      scopes attract a security assessment.
 *
 * We have none of those. So the application runs on FakeReviewProvider and this
 * class stands as the thing that gets switched on, not rewritten, when access
 * arrives. Each method below carries the endpoint it will call and its known
 * constraints, so implementing it is filling in a request rather than working
 * out an integration.
 *
 * ---------------------------------------------------------------------------
 * The APIs involved
 * ---------------------------------------------------------------------------
 * Reviews live on the older My Business API surface, not the newer split-out
 * v1 services. Accounts and locations come from the newer ones:
 *
 *   Account Management API   https://mybusinessaccountmanagement.googleapis.com
 *     GET  /v1/accounts
 *   Business Information API https://mybusinessbusinessinformation.googleapis.com
 *     GET  /v1/accounts/{accountId}/locations?readMask=name,title,storefrontAddress
 *   My Business API v4       https://mybusiness.googleapis.com
 *     GET  /v4/accounts/{accountId}/locations/{locationId}/reviews
 *     PUT  /v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
 *     DELETE  …/reply         (to remove a reply)
 *
 * Rate limits are per project and are set when access is granted; the published
 * default is on the order of a few hundred requests per minute, with a daily
 * cap. The serialized queue and watermark this app already uses are sized well
 * inside that, so no change is needed on that front.
 *
 * ---------------------------------------------------------------------------
 * Shape differences to handle when implementing
 * ---------------------------------------------------------------------------
 *   * `starRating` is an enum — "ONE" … "FIVE" — not an integer.
 *   * `reviewer.displayName` is absent on anonymous reviews.
 *   * `comment` is absent when the customer left a rating only.
 *   * Reviews are returned newest-first and paginated with `nextPageToken`;
 *     there is no server-side "modified since" filter, so the watermark is
 *     applied client-side by reading pages until `updateTime` falls below it.
 *   * `reviewReply` is present when a reply already exists, and PUTting to the
 *     reply endpoint overwrites it rather than failing.
 */

const NEEDS_ACCESS =
  "the Google Business Profile API requires an approved access request and a verified business profile, which this project does not have";

export class GoogleBusinessProfileProvider implements ReviewProvider {
  readonly name = "Google Business Profile";
  readonly publishesForReal = true;

  constructor(
    /** OAuth access token with the business.manage scope. */
    private readonly accessToken: string,
    /** e.g. "accounts/106843291746251". */
    private readonly accountName: string,
  ) {
    void this.accessToken;
    void this.accountName;
  }

  async listLocations(): Promise<ProviderLocation[]> {
    // GET https://mybusinessbusinessinformation.googleapis.com/v1/{accountName}/locations
    //   ?readMask=name,title,storefrontAddress
    //   &pageSize=100
    // Authorization: Bearer {accessToken}
    //
    // Map each result to ProviderLocation:
    //   externalId: location.name            // "locations/1142938…"
    //   name:       location.title
    //   address:    location.storefrontAddress.addressLines.join(", ")
    throw new NotImplementedError("listLocations", NEEDS_ACCESS);
  }

  async fetchReviews(
    locationExternalId: string,
    options: FetchReviewsOptions = {},
  ): Promise<ProviderReview[]> {
    void locationExternalId;
    void options;

    // GET https://mybusiness.googleapis.com/v4/{accountName}/{locationExternalId}/reviews
    //   ?pageSize=50
    //   &orderBy=updateTime desc
    //   &pageToken={nextPageToken}
    // Authorization: Bearer {accessToken}
    //
    // Page until either there is no nextPageToken or a review's updateTime is
    // at or before options.since — the API has no "modified since" parameter,
    // so the watermark is applied here.
    //
    // Map each review to ProviderReview:
    //   externalId:  review.reviewId
    //   authorName:  review.reviewer.displayName ?? "Anonymous"
    //   rating:      STAR_RATINGS[review.starRating]   // "FOUR" -> 4
    //   text:        review.comment ?? ""
    //   postedAt:    new Date(review.createTime)
    //   updatedAt:   new Date(review.updateTime)
    //   existingReply: review.reviewReply?.comment
    //
    // Note: a review the customer edited comes back with a new updateTime and
    // the same reviewId, which is exactly what the (location, externalId)
    // unique constraint upstream is built to absorb.
    throw new NotImplementedError("fetchReviews", NEEDS_ACCESS);
  }

  async publishReply(
    locationExternalId: string,
    reviewExternalId: string,
    reply: string,
  ): Promise<PublishResult> {
    void locationExternalId;
    void reviewExternalId;
    void reply;

    // PUT https://mybusiness.googleapis.com/v4/{accountName}/{locationExternalId}/reviews/{reviewExternalId}/reply
    // Authorization: Bearer {accessToken}
    // Content-Type: application/json
    // { "comment": reply }
    //
    // Returns the stored ReviewReply. PUT is an upsert: it overwrites an
    // existing reply rather than failing, so republishing an edited reply is
    // the same call.
    //
    // Replies are capped at 4096 characters, and Google may reject content that
    // breaches its own review policies with a 400 — surface that message
    // verbatim into the activity log rather than flattening it to "failed".
    throw new NotImplementedError("publishReply", NEEDS_ACCESS);
  }
}

/** "FOUR" -> 4. Kept here so the mapping lives beside the endpoint notes. */
export const STAR_RATINGS: Record<string, number> = {
  STAR_RATING_UNSPECIFIED: 0,
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};
