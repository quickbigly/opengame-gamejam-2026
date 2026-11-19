class_name Ball
extends RefCounted
## A ball bouncing around the grid. Positions and sizes are in cells: cell (x, y) covers
## [x, x + 1) × [y, y + 1).

const DEFAULT_RADIUS := 0.35
const DEFAULT_SPEED := 10.0  # cells per second
## Each substep moves the ball at most this fraction of its radius, so it can't skip a wall.
const MAX_STEP_OF_RADIUS := 0.5

var position: Vector2
var velocity: Vector2
var radius: float
## How many balls this one counts as toward a pen's limit.
var weight := 1.0
## Set by the board when the ball is in a locked pen.
var locked := false


func _init(start: Vector2, start_velocity: Vector2, ball_radius := DEFAULT_RADIUS) -> void:
	position = start
	velocity = start_velocity
	radius = ball_radius


## A diagonal velocity with the given speed. Each sign is +1 or -1.
static func diagonal(speed: float, x_sign: int, y_sign: int) -> Vector2:
	return Vector2(x_sign, y_sign).normalized() * speed


static func circle_overlaps_rect(center: Vector2, r: float, rect: Rect2) -> bool:
	var nearest := center.clamp(rect.position, rect.end)
	return center.distance_squared_to(nearest) < r * r


## The cells a circle's bounding box touches, inclusive.
static func cells_under(center: Vector2, r: float) -> Rect2i:
	var top_left := Vector2i(floori(center.x - r), floori(center.y - r))
	var bottom_right := Vector2i(floori(center.x + r), floori(center.y + r))
	return Rect2i(top_left, bottom_right - top_left + Vector2i.ONE)


func cell() -> Vector2i:
	return Vector2i(floori(position.x), floori(position.y))


func overlaps_rect(rect: Rect2) -> bool:
	return circle_overlaps_rect(position, radius, rect)


func overlaps_filled(grid: Grid, at: Vector2) -> bool:
	var area := cells_under(at, radius)
	for y in range(area.position.y, area.end.y):
		for x in range(area.position.x, area.end.x):
			var c := Vector2i(x, y)
			if grid.is_filled(c) and circle_overlaps_rect(at, radius, Rect2(c, Vector2.ONE)):
				return true
	return false


## Moves the ball for dt seconds, bouncing off filled cells one axis at a time.
func step(grid: Grid, dt: float) -> void:
	var distance := velocity.length() * dt
	var substeps := maxi(1, ceili(distance / (radius * MAX_STEP_OF_RADIUS)))
	var sub_dt := dt / substeps
	for i in substeps:
		var moved_x := position + Vector2(velocity.x * sub_dt, 0.0)
		if overlaps_filled(grid, moved_x):
			velocity.x = -velocity.x
		else:
			position = moved_x
		var moved_y := position + Vector2(0.0, velocity.y * sub_dt)
		if overlaps_filled(grid, moved_y):
			velocity.y = -velocity.y
		else:
			position = moved_y
