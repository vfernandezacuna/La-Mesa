import { createClient } from "@/lib/supabase/server";
import CriticalTopicsView from "@/components/temas-criticos/CriticalTopicsView";
import type {
  CriticalTopic,
  CriticalTopicItem,
  CriticalTopicItemSnapshot,
  CriticalTopicTaskProposal,
} from "@/lib/types";

export default async function TemasCriticosPage() {
  const supabase = await createClient();

  const [topicsRes, itemsRes, snapshotsRes, taskProposalsRes, profileRes] = await Promise.all([
    supabase
      .from("critical_topics")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase.from("critical_topic_items").select("*").order("sort_order", { ascending: true }),
    supabase.from("critical_topic_item_snapshots").select("*").order("created_at", { ascending: true }),
    supabase
      .from("critical_topic_task_proposals")
      .select("*")
      .eq("status", "pendiente")
      .order("created_at", { ascending: true }),
    supabase.from("profile").select("content").maybeSingle(),
  ]);

  return (
    <CriticalTopicsView
      initialTopics={(topicsRes.data as CriticalTopic[]) ?? []}
      initialItems={(itemsRes.data as CriticalTopicItem[]) ?? []}
      initialSnapshots={(snapshotsRes.data as CriticalTopicItemSnapshot[]) ?? []}
      initialTaskProposals={(taskProposalsRes.data as CriticalTopicTaskProposal[]) ?? []}
      profile={profileRes.data?.content ?? ""}
    />
  );
}
