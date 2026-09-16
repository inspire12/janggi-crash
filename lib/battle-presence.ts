export const disconnectMs = 30_000;
export function connectionState(choSeen:number|null,hanSeen:number|null,now:number) {
  const choAge=Math.max(0,now-(choSeen??now));
  const hanAge=Math.max(0,now-(hanSeen??now));
  // No winner is inferred during a shared outage. Both get a fresh grace period.
  const bothAbsent=choAge>=disconnectMs && hanAge>=disconnectMs;
  const loser=bothAbsent?null:choAge>=disconnectMs?'cho':hanAge>=disconnectMs?'han':null;
  return {choAge,hanAge,bothAbsent,loser};
}
