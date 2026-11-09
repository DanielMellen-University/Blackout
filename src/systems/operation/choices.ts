export const ROUTE_CHOICES = ['valley', 'ridge'] as const
export const ENERGY_CHOICES = ['conserve', 'commit'] as const
export type RouteChoice = typeof ROUTE_CHOICES[number]
export type EnergyChoice = typeof ENERGY_CHOICES[number]

export function isRouteChoice(value: unknown): value is RouteChoice {
  return value === 'valley' || value === 'ridge'
}

export function isEnergyChoice(value: unknown): value is EnergyChoice {
  return value === 'conserve' || value === 'commit'
}

export function operationPathKey(route: RouteChoice, energy: EnergyChoice): string {
  return `${route}-${energy}`
}
