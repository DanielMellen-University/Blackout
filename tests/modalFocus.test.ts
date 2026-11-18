import { describe, expect, it } from 'vitest'
import { modalFocusable, MODAL_FOCUSABLE_SELECTOR } from '../src/ui/ModalFocus'

class FocusNode {
  hidden = false
  tabIndex = 0
  open = false
  ariaHidden = false
  summary: FocusNode | null = null
  legend: FocusNode | null = null
  readonly attributes = new Set<string>()
  constructor(readonly tagName = 'BUTTON', public parentElement: FocusNode | null = null) {}
  closest(): FocusNode | null {
    for (let node: FocusNode | null = this; node; node = node.parentElement) {
      if (node.hidden) return node
    }
    return null
  }
  getAttribute(name: string): string | null {
    return name === 'aria-hidden' && this.ariaHidden ? 'true' : null
  }
  hasAttribute(name: string): boolean {
    return name === 'open' ? this.open : this.attributes.has(name)
  }
  querySelector(selector: string): FocusNode | null {
    return selector === ':scope > legend' ? this.legend : this.summary
  }
}

function focusable(...nodes: FocusNode[]): HTMLElement[] {
  return modalFocusable({ querySelectorAll: (selector: string) => {
    expect(selector).toBe(MODAL_FOCUSABLE_SELECTOR)
    return nodes
  } } as unknown as ParentNode)
}

describe('native disclosure modal focus', () => {
  it('includes a closed summary but excludes its body until opened', () => {
    const details = new FocusNode('DETAILS')
    const summary = details.summary = new FocusNode('SUMMARY', details)
    const body = new FocusNode('DIV', details)
    const action = new FocusNode('BUTTON', body)
    expect(focusable(summary, action)).toEqual([summary])
    details.open = true
    expect(focusable(summary, action)).toEqual([summary, action])
  })

  it('does not expose a nested disclosure inside a closed outer body', () => {
    const outer = new FocusNode('DETAILS')
    const outerSummary = outer.summary = new FocusNode('SUMMARY', outer)
    const inner = new FocusNode('DETAILS', outer)
    const innerSummary = inner.summary = new FocusNode('SUMMARY', inner)
    inner.open = true
    const action = new FocusNode('BUTTON', inner)
    expect(focusable(outerSummary, innerSummary, action)).toEqual([outerSummary])
    outer.open = true
    expect(focusable(outerSummary, innerSummary, action)).toEqual([outerSummary, innerSummary, action])
  })

  it('excludes hidden ancestors, aria-hidden panels, and negative tab stops', () => {
    const panel = new FocusNode('DIV')
    const action = new FocusNode('BUTTON', panel)
    panel.hidden = true
    expect(focusable(action)).toEqual([])
    panel.hidden = false
    panel.ariaHidden = true
    expect(focusable(action)).toEqual([])
    panel.ariaHidden = false
    action.tabIndex = -1
    expect(focusable(action)).toEqual([])
  })

  it('skips controls inside inert subtrees', () => {
    const panel = new FocusNode('DIV')
    const action = new FocusNode('BUTTON', panel)
    const link = new FocusNode('A', panel)
    expect(focusable(action, link)).toEqual([action, link])
    panel.attributes.add('inert')
    expect(focusable(action, link)).toEqual([])
  })

  it('skips form controls in a disabled fieldset but keeps its first legend reachable', () => {
    const fieldset = new FocusNode('FIELDSET')
    const legend = fieldset.legend = new FocusNode('LEGEND', fieldset)
    const legendAction = new FocusNode('BUTTON', legend)
    const field = new FocusNode('INPUT', fieldset)
    const link = new FocusNode('A', fieldset)
    expect(focusable(legendAction, field, link)).toEqual([legendAction, field, link])
    fieldset.attributes.add('disabled')
    expect(focusable(legendAction, field, link)).toEqual([legendAction, link])
  })

  it('leaves hidden-type inputs out of the selector and includes text areas', () => {
    expect(MODAL_FOCUSABLE_SELECTOR).toContain('input:not([hidden]):not([disabled]):not([type="hidden"])')
    expect(MODAL_FOCUSABLE_SELECTOR).toContain('textarea:not([hidden]):not([disabled])')
  })
})
