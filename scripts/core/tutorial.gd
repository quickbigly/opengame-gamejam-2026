class_name Tutorial
extends RefCounted
## The tips shown during stages 1 and 2: one at a time, each until the player has done what it
## teaches or for a few seconds. Feed it board events (and "turned") and the time that passes.
## `tip` is the current text, or "" when there's nothing to show.

## Each step: text, and either "until" (an event type that ends it) or "seconds" (how long it
## shows). A step with neither shows for the rest of the stage. "skip_after" ends a step anyway
## once that many walls have been started.
const STEPS := {
	1: [
		{"text": "Click an empty spot to build a wall. It grows both ways from where you click.",
			"until": "wall_started"},
		{"text": "Right-click or Space turns your next wall. The outline shows which way it will grow.",
			"until": "turned", "skip_after": 4},
		{"text": "A ball that touches a growing wall breaks it, and you lose a life. Finished walls are safe.",
			"seconds": 7.0},
		{"text": "Space with no ball in it is captured. Cut the ball's space down until it fits the limit (area / limit).",
			"until": "cleared"},
	],
	2: [
		{"text": "Two balls. Each needs a pen: a space with two balls may be up to twice the limit.",
			"seconds": 8.0},
		{"text": "A pen that fits locks and glows. Box in every ball to clear the stage.",
			"until": "cleared"},
	],
}

var tip := ""
var _steps: Array = []
var _index := -1
var _timer := 0.0
var _walls := 0
## Event types seen so far: a step whose event has already happened is skipped.
var _seen := {}


func _init(stage: int) -> void:
	_steps = STEPS.get(stage, [])
	_next()


static func has_tips(stage: int) -> bool:
	return STEPS.has(stage)


func on_event(type: String) -> void:
	_seen[type] = true
	if type == "wall_started":
		_walls += 1
	if _index >= _steps.size():
		return
	var step: Dictionary = _steps[_index]
	if step.get("until", "") == type or (step.has("skip_after") and _walls >= step["skip_after"]):
		_next()


func update(delta: float) -> void:
	if _index >= _steps.size() or not _steps[_index].has("seconds"):
		return
	_timer -= delta
	if _timer <= 0.0:
		_next()


func _next() -> void:
	_index += 1
	while _index < _steps.size() and _seen.has(_steps[_index].get("until", "")):
		_index += 1
	if _index >= _steps.size():
		tip = ""
		return
	var step: Dictionary = _steps[_index]
	tip = step["text"]
	_timer = step.get("seconds", 0.0)
