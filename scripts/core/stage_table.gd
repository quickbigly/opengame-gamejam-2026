class_name StageTable
extends RefCounted
## The run's stages: how many balls, which special kinds, how fast they go (× the base speed)
## and how tight the pen limit is.
## Past the last stage, Endless keeps adding balls and tightening the limit.
##
## "kinds" lists the special balls (Ball.Kind) among "balls"; the rest are Basic.

const SWIFT := Ball.Kind.SWIFT
const BIG := Ball.Kind.BIG
const SPLITTER := Ball.Kind.SPLITTER
const DRIFTER := Ball.Kind.DRIFTER

const STAGES: Array[Dictionary] = [
	{"balls": 1, "limit": 0.20, "speed": 0.85, "kinds": []},
	{"balls": 2, "limit": 0.16, "speed": 0.9, "kinds": []},
	{"balls": 2, "limit": 0.12, "speed": 1.0, "kinds": []},
	{"balls": 3, "limit": 0.11, "speed": 1.05, "kinds": [SWIFT]},
	{"balls": 3, "limit": 0.10, "speed": 1.1, "kinds": [SWIFT]},
	{"balls": 4, "limit": 0.09, "speed": 1.15, "kinds": [BIG]},
	{"balls": 4, "limit": 0.08, "speed": 1.2, "kinds": [SWIFT, BIG]},
	{"balls": 5, "limit": 0.07, "speed": 1.25, "kinds": [SPLITTER]},
	{"balls": 6, "limit": 0.065, "speed": 1.3, "kinds": [SWIFT, SPLITTER]},
	{"balls": 6, "limit": 0.06, "speed": 1.35, "kinds": [DRIFTER]},
	{"balls": 7, "limit": 0.055, "speed": 1.4, "kinds": [BIG, DRIFTER]},
	{"balls": 8, "limit": 0.05, "speed": 1.45, "kinds": [SWIFT, BIG, SPLITTER, DRIFTER]},
]

## Endless: each stage past the last tightens the limit by this factor, down to the floor.
const ENDLESS_SHRINK := 0.94
const ENDLESS_FLOOR := 0.025
const ENDLESS_MAX_BALLS := 10
const ENDLESS_SPEED_STEP := 0.02
const ENDLESS_MAX_SPEED := 1.6
const ENDLESS_KIND_CYCLE: Array[int] = [SWIFT, BIG, SPLITTER, DRIFTER]


## Stages in a run, before Endless.
static func count() -> int:
	return STAGES.size()


static func is_endless(number: int) -> bool:
	return number > STAGES.size()


## Stage numbers start at 1. Numbers past count() are Endless stages.
static func stage(number: int) -> Dictionary:
	if number <= STAGES.size():
		return STAGES[maxi(number, 1) - 1]
	var extra := number - STAGES.size()
	var last: Dictionary = STAGES[STAGES.size() - 1]
	var balls := mini(last["balls"] + (extra + 1) / 2, ENDLESS_MAX_BALLS)
	var kinds: Array = last["kinds"].duplicate()
	for i in extra / 2:
		kinds.append(ENDLESS_KIND_CYCLE[i % ENDLESS_KIND_CYCLE.size()])
	kinds.resize(mini(kinds.size(), balls))
	return {
		"balls": balls,
		"limit": maxf(last["limit"] * pow(ENDLESS_SHRINK, extra), ENDLESS_FLOOR),
		"speed": minf(last["speed"] + ENDLESS_SPEED_STEP * extra, ENDLESS_MAX_SPEED),
		"kinds": kinds,
	}


## Kinds that appear in this stage but in no earlier one.
static func new_kinds(number: int) -> Array:
	var seen := {}
	for earlier in range(1, number):
		for kind in stage(earlier)["kinds"]:
			seen[kind] = true
	var result := []
	for kind in stage(number)["kinds"]:
		if not seen.has(kind) and not result.has(kind):
			result.append(kind)
	return result
