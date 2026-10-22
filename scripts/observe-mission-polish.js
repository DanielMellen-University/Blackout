// Read-only presentation observations added to the existing review pilot.
const polishObserve = window.__training.state
window.__training.state = () => ({ ...polishObserve(),
 routeLabel: world.mission.routeSummary.label,
 routeBriefing: world.mission.routeBriefing,
 timeOfDay: world.atmosphere.timeOfDay,
})
