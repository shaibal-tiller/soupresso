// Client-safe constant — kept separate from actor.ts because that file
// imports next/headers, which cannot be pulled into a client bundle.
export const ACTOR_COOKIE = "soupresso_actor";
