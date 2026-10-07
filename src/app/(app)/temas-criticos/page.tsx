import { createClient } from "@/lib/supabase/server";
import CriticalTopicsView from "@/components/temas-criticos/CriticalTopicsView";
import type { CriticalTopic, CriticalTopicTaskProposal } from "@/lib/types";

export default async function TemasCriticosPage() {
  const supabase = await createClient();

  const [topicsRes, taskProposalsRes, profileRes] = await Promise.all([
    supabase
      .from("critical_topics")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false }),
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
      initialTaskProposals={(taskProposalsRes.data as CriticalTopicTaskProposal[]) ?? []}
      profile={profileRes.data?.content ?? ""}
    />
  );
}
