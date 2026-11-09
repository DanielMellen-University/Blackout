/** The operation stays off the flight-plan cards unless this dev flag is present. */
export function operationDevRequested(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(query).get('dev') === 'operation'
}
