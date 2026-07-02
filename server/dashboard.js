// Mock analytics for the MoWCD dashboard view. In production this would be
// derived from real (anonymised) interaction logs; here it is representative
// sample data so the department-side value is visible in the demo.

export function dashboardData() {
  const days = 14
  const today = new Date()
  const trend = []
  // A gentle upward trend with weekly rhythm — deterministic-ish shape.
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const base = 900 + (days - i) * 40
    const wobble = Math.round(120 * Math.sin(i * 1.1) + 60 * Math.cos(i * 0.7))
    trend.push({
      date: d.toISOString().slice(0, 10),
      interactions: Math.max(400, base + wobble),
    })
  }

  const totalInteractions = trend.reduce((s, t) => s + t.interactions, 0)

  return {
    generatedAt: today.toISOString(),
    kpis: {
      totalInteractions,
      uniqueCitizens: Math.round(totalInteractions * 0.62),
      avgResponseSec: 3.4,
      resolutionRate: 0.86,
      escalations: 218,
      languagesServed: 12,
    },
    byScheme: [
      { key: 'shakti', label: 'Mission Shakti', value: 41, color: '#b0138e' },
      { key: 'poshan', label: 'Poshan Abhiyaan', value: 37, color: '#2e9e5b' },
      { key: 'vatsalya', label: 'Mission Vatsalya', value: 22, color: '#f08a24' },
    ],
    byLanguage: [
      { label: 'हिन्दी', value: 44 },
      { label: 'English', value: 19 },
      { label: 'বাংলা', value: 9 },
      { label: 'मराठी', value: 8 },
      { label: 'తెలుగు', value: 7 },
      { label: 'தமிழ்', value: 6 },
      { label: 'Other', value: 7 },
    ],
    topQuestions: [
      { q: 'How do I get the ₹5,000 PMMVY maternity benefit?', scheme: 'poshan', count: 4820 },
      { q: 'Where is my nearest Anganwadi Centre?', scheme: 'poshan', count: 4390 },
      { q: 'How do I reach the Women Helpline 181 / One Stop Centre?', scheme: 'shakti', count: 3970 },
      { q: 'My child is not gaining weight — what should I do?', scheme: 'poshan', count: 3510 },
      { q: 'How does legal adoption (CARA) work?', scheme: 'vatsalya', count: 2640 },
      { q: 'When should I call CHILDLINE 1098?', scheme: 'vatsalya', count: 2280 },
      { q: 'Is there a working women hostel / creche near me?', scheme: 'shakti', count: 1970 },
    ],
    regions: [
      { state: 'Uttar Pradesh', interactions: 3120, topConcern: 'Anganwadi access & THR', urgency: 'high' },
      { state: 'Bihar', interactions: 2410, topConcern: 'PMMVY registration', urgency: 'high' },
      { state: 'Maharashtra', interactions: 1980, topConcern: 'One Stop Centre reach', urgency: 'medium' },
      { state: 'West Bengal', interactions: 1730, topConcern: 'Child protection (1098)', urgency: 'medium' },
      { state: 'Rajasthan', interactions: 1520, topConcern: 'Anaemia & nutrition', urgency: 'high' },
      { state: 'Madhya Pradesh', interactions: 1290, topConcern: 'Creche / Palna demand', urgency: 'low' },
    ],
    emergingConcerns: [
      { label: 'PMMVY payment delays', change: +18, sentiment: 'negative' },
      { label: 'Demand for creche (Palna) facilities', change: +26, sentiment: 'neutral' },
      { label: 'Awareness of One Stop Centres', change: +14, sentiment: 'positive' },
      { label: 'Anganwadi THR quality queries', change: +9, sentiment: 'negative' },
    ],
    urgencyBreakdown: [
      { label: 'Safety / distress (routed to helpline)', value: 6, color: '#d92d20' },
      { label: 'Scheme access & eligibility', value: 58, color: '#b0138e' },
      { label: 'General information', value: 36, color: '#667085' },
    ],
    trend,
  }
}
