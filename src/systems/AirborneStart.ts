/** Place the aircraft on the approach side of the gate's crossing plane. */
export function airborneStart(
  gate: { x: number; y: number; z: number; fwdX: number; fwdZ: number },
  groundHeight: (x: number, z: number) => number,
) {
  // Choose the longest clear, level approach; the gate corridor itself already
  // has terrain clearance. Sampling the whole approach avoids spawning behind
  // a ridge that hides the gate.
  let distance = 0
  for (let d = 10; d <= 300; d += 10) {
    const x = gate.x - gate.fwdX * d
    const z = gate.z - gate.fwdZ * d
    if (groundHeight(x, z) > gate.y - 20) break
    distance = d
  }
  return {
    x: gate.x - gate.fwdX * distance,
    y: gate.y,
    z: gate.z - gate.fwdZ * distance,
    yaw: Math.atan2(gate.fwdX, gate.fwdZ),
  }
}

/** Free flight retains the world runway pose; gated runs use gate 1. */
export function flightStart<T extends { x: number; y: number; z: number; yaw: number }>(
  runway: T,
  gate: { x: number; y: number; z: number; fwdX: number; fwdZ: number } | null,
  groundHeight: (x: number, z: number) => number,
) {
  return gate ? airborneStart(gate, groundHeight) : runway
}
