type SeedInputLike = Pick<HTMLInputElement, 'setAttribute' | 'removeAttribute'>

/** Mark the custom seed field so assistive tech reads it as invalid until it is fixed. */
export function setSeedInputInvalid(input: SeedInputLike | null | undefined, invalid: boolean): void {
  if (!input) return
  if (invalid) input.setAttribute('aria-invalid', 'true')
  else input.removeAttribute('aria-invalid')
}
