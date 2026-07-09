'use client'

import { useEffect } from 'react'

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function fixSpecialJurisdictionCards() {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.public-section-card'))
  const specialSection = sections.find((section) => normalize(section.textContent ?? '').includes('Jurisdicciones especiales'))
  if (!specialSection) return

  const cards = Array.from(specialSection.querySelectorAll<HTMLAnchorElement>('a.public-directory-item'))
  for (const card of cards) {
    if (card.dataset.specialJurisdictionFixed === 'true') continue

    const strong = card.querySelector('strong')
    const detail = card.querySelector('span')
    if (!strong || !detail) continue

    const ordinaryName = normalize(strong.textContent ?? '')
    const detailText = normalize(detail.textContent ?? '')
    const parts = detailText.split('·').map((item) => normalize(item)).filter(Boolean)
    if (parts.length < 2) continue

    const role = parts[0]
    const jurisdictionName = parts.slice(1).join(' · ')
    if (!jurisdictionName || jurisdictionName === ordinaryName) continue

    strong.textContent = jurisdictionName
    detail.textContent = `${role} · Ordinario: ${ordinaryName}`
    card.dataset.specialJurisdictionFixed = 'true'
  }
}

export function PublicDashboardEntityCards() {
  useEffect(() => {
    fixSpecialJurisdictionCards()

    const observer = new MutationObserver(() => fixSpecialJurisdictionCards())
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(fixSpecialJurisdictionCards, 900)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
