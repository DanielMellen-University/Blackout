export const MODAL_FOCUSABLE_SELECTOR = 'button:not([hidden]):not([disabled]), select:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])'

/** Native disclosures belong in the focus loop, but their closed bodies do not. */
export function modalFocusable(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter(element => {
    if (element.hidden || element.tabIndex < 0 || element.closest('[hidden]')) return false
    let child: Element = element
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.getAttribute('aria-hidden') === 'true') return false
      if (parent.tagName === 'DETAILS' && !parent.hasAttribute('open') &&
        parent.querySelector(':scope > summary') !== child) return false
      child = parent
    }
    return true
  })
}
