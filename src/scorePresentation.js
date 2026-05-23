export function getMatchStrength(score) {
  const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
  if (safeScore >= 90) return { label: 'Strong match', tone: 'strong' };
  if (safeScore >= 75) return { label: 'Good match', tone: 'good' };
  if (safeScore >= 55) return { label: 'Possible match', tone: 'possible' };
  return { label: 'Skip', tone: 'skip' };
}
