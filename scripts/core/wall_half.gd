class_name WallHalf
extends RefCounted
## One half of a wall. It grows from the centre of its origin cell in one direction until it
## meets a filled cell, then turns solid and fills the cells it covers (origin included).

enum State { GROWING, SOLID, BROKEN }

var wall_id: int
var origin: Vector2i
var direction: Vector2i
## Distance from the origin cell's centre to the tip, in cells.
var length := 0.0
var state := State.GROWING


func _init(id: int, start: Vector2i, dir: Vector2i) -> void:
	wall_id = id
	origin = start
	direction = dir


func is_growing() -> bool:
	return state == State.GROWING


## How many cells, origin included, lie between the origin and the first filled cell ahead.
func reach(grid: Grid) -> int:
	var n := 1
	while grid.is_open(origin + direction * n):
		n += 1
	return n


## The length at which the tip meets the first filled cell ahead.
func target_length(grid: Grid) -> float:
	return reach(grid) - 0.5


## The area the half covers: its whole origin cell plus everything out to the tip.
func rect() -> Rect2:
	var centre := Vector2(origin) + Vector2(0.5, 0.5)
	var tip := centre + Vector2(direction) * length
	var side := Vector2(absi(direction.y), absi(direction.x)) * 0.5
	return Rect2(origin, Vector2.ONE).expand(tip + side)


## The cells this half fills when it turns solid, given the grid at that moment.
func cells(grid: Grid) -> PackedVector2Array:
	var result := PackedVector2Array()
	for i in reach(grid):
		result.append(Vector2(origin + direction * i))
	return result


## Moves the tip forward. Returns true if it reached the first filled cell ahead.
## Within `snap` cells of the end, the tip jumps straight there.
func grow(grid: Grid, distance: float, snap := 0.0) -> bool:
	var target := target_length(grid)
	length = minf(length + distance, target)
	if target - length <= snap:
		length = target
	return length >= target
