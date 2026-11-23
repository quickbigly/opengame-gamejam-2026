class_name Run
extends RefCounted
## One run from stage 1 to victory or game over: lives, score, XP, level-ups and upgrades.
## Builds each stage's Board with the upgrades applied and scores the Board's events.
##
## Flow: start_stage() -> feed every board event to handle_event() -> when the board clears,
## finish_stage() -> while pending_levels > 0: open_offer(), then reroll() or pick() ->
## advance() -> start_stage() ...

const START_LIVES := 3
## Clearing a stage gives lives up to this many (plus one per Spare).
const MAX_LIVES := 5
const CELL_POINTS := 10
const SQUEEZE_POINTS := 25
const CLEAN_BONUS := 0.25
const STAGE_MULTIPLIER_STEP := 0.15
## Level n needs XP_BASE × XP_GROWTH^(n−1) XP. The design doc's 800 × 1.3 levelled up about
## five times on stage 1 alone; this gives roughly one level per stage. Tuned in M3.
const XP_BASE := 5000.0
const XP_GROWTH := 1.35
const BASE_REROLLS := 1
const OFFER_SIZE := 3

var rng := RandomNumberGenerator.new()
var run_seed: int
var stage := 1
var lives := START_LIVES
var score := 0
var level := 1
## XP toward the next level.
var xp := 0.0
var pending_levels := 0
## {upgrade id: stacks}
var upgrades := {}
var board: Board
var offer: Array[String] = []
var rerolls_left := 0
## Set once the player keeps going after the last stage.
var endless := false
## One entry per stage played: {stage, cleared, time, walls, lives_lost, points, upgrades}.
var history: Array[Dictionary] = []

# This stage so far.
var stage_points := 0
var capture_points := 0
var combo_points := 0
var lives_lost := 0


func _init(seed_value: int) -> void:
	run_seed = seed_value
	rng.seed = seed_value


func stacks(id: String) -> int:
	return upgrades.get(id, 0)


func has(id: String) -> bool:
	return stacks(id) > 0


func stage_count() -> int:
	return StageTable.count()


func is_final_stage() -> bool:
	return not endless and stage >= stage_count()


func is_endless_stage() -> bool:
	return StageTable.is_endless(stage)


func stage_multiplier() -> float:
	return 1.0 + STAGE_MULTIPLIER_STEP * stage


func point_multiplier() -> float:
	return stage_multiplier() * (1.0 + 0.15 * stacks("greed"))


## Clearing a stage tops lives up to this many.
func max_lives() -> int:
	return MAX_LIVES + stacks("spare")


func xp_multiplier() -> float:
	return 1.0 + 0.2 * stacks("study")


func xp_needed(for_level := -1) -> float:
	var at := level if for_level < 0 else for_level
	return XP_BASE * pow(XP_GROWTH, at - 1)


func pen_limit() -> float:
	return StageTable.stage(stage)["limit"] * pow(1.08, stacks("loose_fit"))


func ball_count() -> int:
	return StageTable.stage(stage)["balls"]


## The stage's ball speed, as a multiple of the base speed.
func ball_speed() -> float:
	return StageTable.stage(stage)["speed"]


func ball_kinds() -> Array:
	return StageTable.stage(stage)["kinds"]


func active() -> String:
	return Upgrades.held_active(upgrades)


## Builds the board for the current stage with every upgrade applied.
func start_stage() -> Board:
	board = Board.new(pen_limit(), lives)
	board.wall_speed = Board.WALL_SPEED * pow(1.2, stacks("quick_build"))
	board.max_walls = 2 if has("twin_crews") else 1
	if has("twin_crews"):
		board.wall_speed *= 1.5
	board.last_stretch = 5.0 if has("last_stretch") else 0.0
	board.stun_time = 1.0 if has("stun") else 0.0
	board.close_calls = 1 if has("close_call") else 0
	board.auto_lock = 0.35 if has("auto_lock") else 0.0
	board.shield_hits = 2 if has("hardened_tip") else 0
	board.crossbeam = has("crossbeam")
	board.active = active()
	if board.active != "":
		board.active_cost = Upgrades.find(board.active)["cost"]
		board.active_charge = board.active_cost  # every stage starts with it ready
	var speed := Ball.DEFAULT_SPEED * ball_speed() * pow(0.92, stacks("thick_air"))
	var radius := Ball.DEFAULT_RADIUS * pow(0.9, stacks("shrink"))
	board.spawn_balls(ball_count(), rng, speed, radius, ball_kinds())
	board.take_events()
	stage_points = 0
	capture_points = 0
	combo_points = 0
	lives_lost = 0
	return board


func handle_event(event: Dictionary) -> void:
	match event["type"]:
		"wall_finished":
			_score_wall(event["cells"], event["regions"])
		"half_broken":
			if event["costs_life"]:
				lives_lost += 1
	if board:
		lives = board.lives


func combo_multiplier(regions: int) -> int:
	if regions < 2:
		return 1
	return regions + (1 if has("chain") else 0)


func _score_wall(cells: int, regions: int) -> void:
	if cells <= 0:
		return
	var plain := _award(cells * CELL_POINTS)
	capture_points += plain
	var multiplier := combo_multiplier(regions)
	if multiplier > 1:
		combo_points += _award(cells * CELL_POINTS * (multiplier - 1))


## Adds base points with the stage and Greed multipliers, plus the XP they earn.
func _award(base: float) -> int:
	return _add_points(roundi(base * point_multiplier()))


func _add_points(points: int) -> int:
	score += points
	stage_points += points
	xp += points * xp_multiplier()
	while xp >= xp_needed():
		xp -= xp_needed()
		level += 1
		pending_levels += 1
	return points


## Scores the clear and grants the clear's lives. Returns the stage's breakdown.
func finish_stage() -> Dictionary:
	var squeeze_base := 0.0
	for pen in board.pens:
		squeeze_base += SQUEEZE_POINTS * maxf(0.0, pen.limit - pen.area)
	var squeeze := _award(squeeze_base * pow(2.0, stacks("snug_reward")))
	var clean := 0
	if lives_lost == 0:
		clean = _add_points(roundi(stage_points * CLEAN_BONUS))
	var lives_gained := clampi(max_lives() - board.lives, 0, 1 + (1 if has("second_wind") else 0))
	lives = board.lives + lives_gained
	_record_stage(true)
	return {
		"captures": capture_points,
		"combos": combo_points,
		"squeeze": squeeze,
		"clean": clean,
		"total": stage_points,
		"lives_gained": lives_gained,
	}


## Records a stage lost to running out of lives.
func fail_stage() -> void:
	lives = 0
	_record_stage(false)


func _record_stage(cleared: bool) -> void:
	history.append({
		"stage": stage,
		"cleared": cleared,
		"time": snappedf(board.time, 0.01),
		"walls": board.walls_started,
		"lives_lost": lives_lost,
		"points": stage_points,
		"upgrades": upgrades.keys(),
	})


## A summary of the run so far, for the local run log and the balance report.
func summary(victory: bool) -> Dictionary:
	return {
		"seed": run_seed,
		"stage": stage,
		"victory": victory,
		"endless": endless,
		"score": score,
		"level": level,
		"upgrades": upgrades.duplicate(),
		"stages": history.duplicate(),
	}


func advance() -> void:
	stage += 1


func rerolls_per_offer() -> int:
	return BASE_REROLLS + stacks("reroll")


func open_offer() -> void:
	rerolls_left = rerolls_per_offer()
	offer = Upgrades.roll(rng, upgrades, OFFER_SIZE)


func reroll() -> bool:
	if rerolls_left <= 0:
		return false
	rerolls_left -= 1
	offer = Upgrades.roll(rng, upgrades, OFFER_SIZE)
	return true


func pick(index: int) -> String:
	if index < 0 or index >= offer.size():
		return ""
	var id := offer[index]
	if Upgrades.is_active(id):
		var held := active()
		if held != "" and held != id:
			upgrades.erase(held)  # one active slot: the new one replaces it
	upgrades[id] = stacks(id) + 1

	if id == "spare":
		lives += 1
	pending_levels = maxi(0, pending_levels - 1)
	offer.clear()
	return id


## 12345 -> "12,345"
static func thousands(value: int) -> String:
	var digits := str(absi(value))
	var result := ""
	while digits.length() > 3:
		result = "," + digits.substr(digits.length() - 3) + result
		digits = digits.substr(0, digits.length() - 3)
	return ("-" if value < 0 else "") + digits + result


## 0.2 -> "20%", 0.055 -> "5.5%"
static func percent(fraction: float) -> String:
	var text := String.num(fraction * 100.0, 1)
	return text.trim_suffix(".0") + "%"
