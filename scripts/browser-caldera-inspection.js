// Review-only fixed camera. No aircraft, physics, mission or scoring writes.
let calderaCamera = null
const calderaRender = renderer.render.bind(renderer)
renderer.render = (scene, camera) => calderaRender(scene, calderaCamera || camera)
window.__training.inspectCaldera = () => {
 const yaw = world.spawn.yaw, base = world.runway.position
 const point = (right, forward, height) => ({
  x: base.x + Math.cos(yaw) * right + Math.sin(yaw) * forward,
  y: base.y + height,
  z: base.z - Math.sin(yaw) * right + Math.cos(yaw) * forward,
 })
 const eye = point(-700, 1900, 4500), target = point(-2200, 3200, 1100)
 calderaCamera = cameras.camera.clone()
 calderaCamera.fov = 62; calderaCamera.updateProjectionMatrix()
 calderaCamera.position.set(eye.x,eye.y,eye.z)
 calderaCamera.lookAt(target.x,target.y,target.z)
 return {eye,target,fov:62,method:'Fixed camera over resident production terrain. Ordinary aircraft controls and streaming continue; excluded from timing and completion acceptance.'}
}
