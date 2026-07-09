'use client'

import { useEffect, useRef } from 'react'

type Country = {
  key: string
  iso2?: string | null
  name: string
  flag_emoji?: string | null
  flag_image_url?: string | null
  flag_alt?: string | null
}

type DashboardData = {
  countries?: Country[]
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function findComboboxInput(labelText: string) {
  const labels = Array.from(document.querySelectorAll<HTMLLabelElement>('label'))
  const label = labels.find((item) => normalize(item.textContent ?? '').startsWith(labelText))
  return label?.querySelector<HTMLInputElement>('input.public-combobox-input') ?? null
}

function selectedCountryName() {
  return normalize(findComboboxInput('País')?.value ?? '') || 'República Dominicana'
}

function flagEmojiFromIso2(value?: string | null) {
  const iso2 = (value ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(iso2)) return ''
  return Array.from(iso2).map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('')
}

function renderCountryFlag(countries: Country[]) {
  const marker = document.querySelector<HTMLElement>('.public-country-mark')
  if (!marker) return

  const countryName = selectedCountryName()
  const country = countries.find((item) => item.name === countryName || item.key === countryName) ?? countries[0]
  if (!country) return

  const signature = `${country.key}|${country.flag_image_url ?? ''}|${country.flag_emoji ?? ''}`
  if (marker.dataset.countryFlagSignature === signature) return
  marker.dataset.countryFlagSignature = signature

  marker.classList.add('public-country-flag-mark')
  marker.replaceChildren()

  if (country.flag_image_url) {
    const image = document.createElement('img')
    image.alt = country.flag_alt ?? `Bandera de ${country.name}`
    image.decoding = 'async'
    image.loading = 'lazy'
    image.src = country.flag_image_url
    marker.append(image)
    marker.removeAttribute('aria-hidden')
    return
  }

  const emoji = document.createElement('span')
  emoji.className = 'public-country-flag-emoji'
  emoji.textContent = country.flag_emoji || flagEmojiFromIso2(country.iso2 ?? country.key) || '◼'
  emoji.setAttribute('role', 'img')
  emoji.setAttribute('aria-label', country.flag_alt ?? `Bandera de ${country.name}`)
  marker.append(emoji)
  marker.removeAttribute('aria-hidden')
}

export function PublicCountryFlagEnhancements() {
  const countriesRef = useRef<Country[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/dashboard/vistas')
        if (!response.ok) return
        const data = await response.json() as DashboardData
        if (cancelled) return
        countriesRef.current = data.countries ?? []
        renderCountryFlag(countriesRef.current)
      } catch (error) {
        console.warn('No se pudo cargar la bandera del país', error)
      }
    }

    load()

    const observer = new MutationObserver(() => renderCountryFlag(countriesRef.current))
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })

    const timer = window.setInterval(() => renderCountryFlag(countriesRef.current), 700)

    return () => {
      cancelled = true
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  return null
}
