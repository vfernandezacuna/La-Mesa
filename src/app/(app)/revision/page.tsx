import { createClient } from "@/lib/supabase/server";
import RevisionView from "@/components/revision/RevisionView";
import type { Task, WeeklyReview } from "@/lib/types";

export default async function RevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ prio?: string }>;
}) {
  const { prio } = await searchParams;
  const supabase = await createClient();

  const [tasksRes, reviewsRes, profileRes] = await Promise.all([
    supabase.from("tasks").select("*"),
    supabase.from("weekly_reviews").select("*").order("week_key", { ascending: true }),
    supabase.from("profile").select("content").maybeSingle(),
  ]);

  return (
    <RevisionView
      initialTasks={(tasksRes.data as Task[]) ?? []}
      initialReviews={(reviewsRes.data as WeeklyReview[]) ?? []}
      profile={profileRes.data?.content ?? ""}
      prioPrefill={prio}
    />
  );
}
