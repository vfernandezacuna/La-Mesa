import { createClient } from "@/lib/supabase/server";
import AprendizajeView from "@/components/aprendizaje/AprendizajeView";
import type { LearningLogEntry } from "@/lib/types";

export default async function AprendizajePage() {
  const supabase = await createClient();

  const { data } = await supabase.from("learning_log").select("*").order("created_at", { ascending: true });

  return <AprendizajeView initialEntries={(data as LearningLogEntry[]) ?? []} />;
}
