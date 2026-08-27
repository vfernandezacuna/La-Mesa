import { createClient } from "@/lib/supabase/server";
import CalendarioView from "@/components/calendario/CalendarioView";
import type { Task } from "@/lib/types";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").select("*").eq("done", false);

  return <CalendarioView tasks={(data as Task[]) ?? []} initialDate={date} />;
}
