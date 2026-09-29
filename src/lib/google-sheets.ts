import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

function getClient(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "Faltan las credenciales de Google (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) en las variables de entorno.",
    );
  }
  return new JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
}

/**
 * Lee valores crudos de una hoja de Google Sheets (rango tipo "Hoja1!A1:G50")
 * usando una cuenta de servicio. La hoja debe estar compartida con el
 * client_email de la cuenta de servicio como Lector.
 */
export async function fetchSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const client = getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("No se pudo obtener el token de acceso de Google.");
  }
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error al leer Google Sheets (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}
