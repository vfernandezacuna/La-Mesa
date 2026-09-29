import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCarteraEntries, type CarteraContextEntry } from "./context";
import type {
  InvestmentAccount,
  InvestmentAccountPosition,
  InvestmentsFutalemu,
  InvestmentsFutalemuPosition,
} from "./types";

// Trae Futalemu + todas las cuentas de inversión nombradas (Cartera
// Personal, futuras) y las arma como contexto para la IA. Usado por
// Consejo y Patrimonio, que solo necesitan el texto — Inversiones fetchea
// los datos crudos aparte porque además los renderiza.
export async function fetchCarteraEntries(supabase: SupabaseClient): Promise<CarteraContextEntry[]> {
  const [futalemuRes, accountsRes] = await Promise.all([
    supabase.from("investments_futalemu").select("*").order("fecha", { ascending: false }).limit(1),
    supabase.from("investment_accounts").select("*").order("created_at", { ascending: true }),
  ]);

  const futalemuRow = ((futalemuRes.data as InvestmentsFutalemu[]) ?? [])[0] ?? null;
  let futalemu: { meta: InvestmentsFutalemu; positions: InvestmentsFutalemuPosition[] } | null = null;
  if (futalemuRow) {
    const positionsRes = await supabase
      .from("investments_futalemu_positions")
      .select("*")
      .eq("snapshot_id", futalemuRow.id);
    futalemu = { meta: futalemuRow, positions: (positionsRes.data as InvestmentsFutalemuPosition[]) ?? [] };
  }

  const accounts = (accountsRes.data as InvestmentAccount[]) ?? [];
  const accountsWithPositions = await Promise.all(
    accounts.map(async (account) => {
      const positionsRes = await supabase
        .from("investment_account_positions")
        .select("*")
        .eq("account_id", account.id);
      return { account, positions: (positionsRes.data as InvestmentAccountPosition[]) ?? [] };
    }),
  );

  return buildCarteraEntries(futalemu, accountsWithPositions);
}
