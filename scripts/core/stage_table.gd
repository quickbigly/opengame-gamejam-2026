class_name StageTable
extends RefCounted
## The run's stages: how many balls and how tight the pen limit is. Starting values from the
## design doc; tuned in M3. Ball types arrive in M3 too.

const STAGES: Array[Dictionary] = [
	{"balls": 1, "limit": 0.20},
	{"balls": 2, "limit": 0.16},
	{"balls": 2, "limit": 0.12},
	{"balls": 3, "limit": 0.11},
	{"balls": 3, "limit": 0.10},
	{"balls": 4, "limit": 0.09},
	{"balls": 4, "limit": 0.08},
	{"balls": 5, "limit": 0.07},
	{"balls": 5, "limit": 0.065},
	{"balls": 6, "limit": 0.06},
	{"balls": 6, "limit": 0.055},
	{"balls": 7, "limit": 0.05},
]


static func count() -> int:
	return STAGES.size()


## Stage numbers start at 1.
static func stage(number: int) -> Dictionary:
	return STAGES[clampi(number, 1, STAGES.size()) - 1]
