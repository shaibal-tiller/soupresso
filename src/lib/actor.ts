import { cookies } from "next/headers";
import { ACTOR_COOKIE } from "@/lib/actor-shared";

export { ACTOR_COOKIE };

export async function getActorName(): Promise<string> {
  const store = await cookies();
  const value = store.get(ACTOR_COOKIE)?.value?.trim();
  return value && value.length > 0 ? value : "Unknown";
}
