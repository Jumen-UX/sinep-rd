import AxeBuilder from '@axe-core/playwright'

const blockingImpacts = new Set(['critical', 'serious'])
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function formatViolation(violation) {
  const targets = violation.nodes
    .flatMap((node) => node.target)
    .map((target) => String(target))
    .join(', ')

  return `${violation.id} [${violation.impact ?? 'sin impacto'}]: ${violation.help} — ${targets}`
}

export async function expectNoBlockingAccessibilityViolations({ page, expect, testInfo, include }) {
  let builder = new AxeBuilder({ page }).withTags(wcagTags)
  if (include) builder = builder.include(include)

  const results = await builder.analyze()
  const blocking = results.violations.filter((violation) => blockingImpacts.has(violation.impact))

  await testInfo.attach('axe-accessibility-results', {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: 'application/json',
  })

  expect(
    blocking.map(formatViolation),
    'La página contiene violaciones automáticas de accesibilidad con impacto crítico o serio.',
  ).toEqual([])
}
