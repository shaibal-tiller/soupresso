import { cookies } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/lib/i18n-shared";

export { t, LANG_COOKIE } from "@/lib/i18n-shared";
export type { Lang } from "@/lib/i18n-shared";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return value === "bn" ? "bn" : "en";
}
