import { ReviewDetail } from "@/components/app/ReviewDetail";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Keyed so stepping to another review remounts with fresh local controls.
  return <ReviewDetail key={id} id={id} />;
}
