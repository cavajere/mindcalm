import type { Directive } from 'vue'

interface TooltipElement extends HTMLElement {
  _tooltipEl?: HTMLElement | null
  _tooltipHandlers?: {
    show: () => void
    hide: () => void
    reposition: () => void
  }
}

const TOOLTIP_CLASS = 'app-tooltip'
const VIEWPORT_PADDING = 4
const GAP = 6

function createTooltipElement(text: string): HTMLElement {
  const el = document.createElement('div')
  el.className = TOOLTIP_CLASS
  el.textContent = text
  el.setAttribute('role', 'tooltip')
  return el
}

function positionTooltip(tooltipEl: HTMLElement, targetEl: HTMLElement) {
  const targetRect = targetEl.getBoundingClientRect()
  const tooltipRect = tooltipEl.getBoundingClientRect()

  let top = targetRect.top - tooltipRect.height - GAP
  if (top < VIEWPORT_PADDING) {
    top = targetRect.bottom + GAP
  }

  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING),
  )

  tooltipEl.style.top = `${top}px`
  tooltipEl.style.left = `${left}px`
}

function hide(el: TooltipElement) {
  if (el._tooltipEl) {
    el._tooltipEl.remove()
    el._tooltipEl = null
  }
}

function show(el: TooltipElement, text: string) {
  if (!text || el._tooltipEl) return
  const tooltipEl = createTooltipElement(text)
  document.body.appendChild(tooltipEl)
  el._tooltipEl = tooltipEl
  requestAnimationFrame(() => {
    if (!el._tooltipEl) return
    positionTooltip(el._tooltipEl, el)
    el._tooltipEl.classList.add('visible')
  })
}

export const vTooltip: Directive<TooltipElement, string | undefined | null> = {
  mounted(el, binding) {
    const getText = () => (binding.value ?? '').toString()
    const handlers = {
      show: () => show(el, getText()),
      hide: () => hide(el),
      reposition: () => {
        if (el._tooltipEl) positionTooltip(el._tooltipEl, el)
      },
    }
    el._tooltipHandlers = handlers
    el.addEventListener('mouseenter', handlers.show)
    el.addEventListener('mouseleave', handlers.hide)
    el.addEventListener('focus', handlers.show)
    el.addEventListener('blur', handlers.hide)
    window.addEventListener('scroll', handlers.hide, true)
    window.addEventListener('resize', handlers.hide)
  },
  updated(el, binding) {
    const text = (binding.value ?? '').toString()
    if (el._tooltipEl) {
      el._tooltipEl.textContent = text
      positionTooltip(el._tooltipEl, el)
    }
  },
  beforeUnmount(el) {
    if (el._tooltipHandlers) {
      el.removeEventListener('mouseenter', el._tooltipHandlers.show)
      el.removeEventListener('mouseleave', el._tooltipHandlers.hide)
      el.removeEventListener('focus', el._tooltipHandlers.show)
      el.removeEventListener('blur', el._tooltipHandlers.hide)
      window.removeEventListener('scroll', el._tooltipHandlers.hide, true)
      window.removeEventListener('resize', el._tooltipHandlers.hide)
    }
    hide(el)
  },
}
