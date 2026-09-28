import { createClient } from "@/lib/supabase/server";
import CriticalTopicsView from "@/components/temas-criticos/CriticalTopicsView";
import type { CriticalTopic } from "@/lib/types";

export default async function TemasCriticosPage() {
  const supabase = await createClient();

  const [topicsRes, profileRes] = await Promise.all([
    supabase
      .from("critical_topics")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false }),
    supabase.from("profile").select("content").maybeSingle(),
  ]);

  return (
    <CriticalTopicsView
      initialTopics={(topicsRes.data as CriticalTopic[]) ?? []}
      profile={profileRes.data?.content ?? ""}
    />
  );
}
