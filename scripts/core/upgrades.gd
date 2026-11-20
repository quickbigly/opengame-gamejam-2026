class_name Upgrades
extends RefCounted
## The upgrade catalogue and how offers are rolled. Effects are applied by Run.

enum Rarity { COMMON, RARE, EPIC }

const RARITY_NAMES := ["Common", "Rare", "Epic"]
const RARITY_WEIGHTS := [60, 30, 10]

## max: how many times it can be taken. Actives ("active": true) share one slot: picking one
## replaces the one held. "cost" is how many walls an active takes to recharge.
const ALL: Array[Dictionary] = [
	# Walls
	{"id": "quick_build", "name": "Quick Build", "rarity": Rarity.COMMON, "max": 5,
		"text": "Walls grow 20% faster."},
	{"id": "last_stretch", "name": "Last Stretch", "rarity": Rarity.RARE, "max": 1,
		"text": "A wall half within 5 cells of finishing completes instantly."},
	{"id": "twin_crews", "name": "Twin Crews", "rarity": Rarity.EPIC, "max": 1,
		"text": "Two walls can build at once, and walls grow 50% faster."},
	{"id": "hardened_tip", "name": "Hardened Tip", "rarity": Rarity.RARE, "max": 1,
		"text": "Your walls shrug off the first 2 ball hits each stage."},
	{"id": "crossbeam", "name": "Crossbeam", "rarity": Rarity.EPIC, "max": 1,
		"text": "Hold Shift as you click to build a + wall: four halves at once, 30% faster."},
	# Balls
	{"id": "thick_air", "name": "Thick Air", "rarity": Rarity.COMMON, "max": 5,
		"text": "Balls move 8% slower."},
	{"id": "shrink", "name": "Shrink", "rarity": Rarity.COMMON, "max": 5,
		"text": "Balls are 10% smaller."},
	{"id": "stun", "name": "Stun", "rarity": Rarity.RARE, "max": 1,
		"text": "Balls freeze for 1 s whenever a wall finishes (unless another is still building)."},
	# Squeeze
	{"id": "loose_fit", "name": "Loose Fit", "rarity": Rarity.COMMON, "max": 5,
		"text": "Pen limit +8%."},
	{"id": "snug_reward", "name": "Snug Reward", "rarity": Rarity.RARE, "max": 3,
		"text": "Squeeze bonus ×2."},
	{"id": "auto_lock", "name": "Auto-Lock", "rarity": Rarity.EPIC, "max": 1,
		"text": "A pen up to 35% over its limit locks anyway."},
	# Score and XP
	{"id": "greed", "name": "Greed", "rarity": Rarity.COMMON, "max": 5,
		"text": "+15% points."},
	{"id": "study", "name": "Study", "rarity": Rarity.COMMON, "max": 5,
		"text": "+20% XP."},
	{"id": "chain", "name": "Chain", "rarity": Rarity.RARE, "max": 1,
		"text": "Combo multiplier +1."},
	{"id": "reroll", "name": "Reroll", "rarity": Rarity.COMMON, "max": 3,
		"text": "+1 reroll on every upgrade pick."},
	# Survival
	{"id": "spare", "name": "Spare", "rarity": Rarity.COMMON, "max": 99,
		"text": "+1 life now, and stage clears top you up to 1 more."},
	{"id": "second_wind", "name": "Second Wind", "rarity": Rarity.RARE, "max": 1,
		"text": "+1 more life each time you clear a stage."},
	{"id": "close_call", "name": "Close Call", "rarity": Rarity.RARE, "max": 1,
		"text": "The first life you'd lose each stage is spared."},
	# Actives
	{"id": "freeze", "name": "Freeze", "rarity": Rarity.RARE, "max": 1, "active": true, "cost": 6,
		"text": "Active, Q: stop every ball for 3 s. Recharges after 6 walls."},
	{"id": "repel", "name": "Repel", "rarity": Rarity.RARE, "max": 1, "active": true, "cost": 3,
		"text": "Active, Q: every ball turns to head away from the cursor. Recharges after 3 walls."},
]


static func find(id: String) -> Dictionary:
	for upgrade in ALL:
		if upgrade["id"] == id:
			return upgrade
	return {}


static func is_active(id: String) -> bool:
	return find(id).get("active", false)


## The active held among the owned upgrades, or "".
static func held_active(owned: Dictionary) -> String:
	for id in owned:
		if owned[id] > 0 and is_active(id):
			return id
	return ""


## Upgrades that can still be taken, given {id: stacks} already owned.

static func available(owned: Dictionary) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for upgrade in ALL:
		if owned.get(upgrade["id"], 0) < upgrade["max"]:
			result.append(upgrade)
	return result


## Up to `count` distinct upgrade ids, weighted by rarity.
static func roll(rng: RandomNumberGenerator, owned: Dictionary, count: int) -> Array[String]:
	var pool := available(owned)
	var picked: Array[String] = []
	while picked.size() < count and not pool.is_empty():
		var total := 0
		for upgrade in pool:
			total += RARITY_WEIGHTS[upgrade["rarity"]]
		var roll_at := rng.randi_range(0, total - 1)
		for i in pool.size():
			roll_at -= RARITY_WEIGHTS[pool[i]["rarity"]]
			if roll_at < 0:
				picked.append(pool[i]["id"])
				pool.remove_at(i)
				break
	return picked
