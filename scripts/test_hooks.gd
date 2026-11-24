extends Node
## Autoload "TestHooks": the one place the game reads test flags. Persona playtests
## (docs/persona-playtest.md) use it to read the game's full state, step its clock and plant
## known defects. Nothing else in the game may read a test flag; tests/test_hooks.gd checks that.
##
## The hooks are on only in a test build: the "Web Test" export preset (feature `test_hooks`,
## built by `dev -WebTest` to build/web-test) or a desktop run with `--test`. A release build
## never turns them on, whatever its URL says. The flags, from the URL query (?step&persona=P2)
## or the command line (--step --persona=P2):
##
##   test           turns the hooks on (implied by any other flag on desktop)
##   step           stepped clock: a stage's board advances only when the page calls
##                  boxedInStep(n) (n board steps of 1/120 s), so an agent can look, think and
##                  click while the balls stand still
##   persona=P2     the persona playing; finished runs are logged with source "persona:P2"
##   plant=a,b      known defects to switch on, to prove a check can fail (PLANTS)
##   stage=N        start runs at stage N (like --stage on desktop)
##   quiet          publish nothing per frame (for timing runs: the hooks then cost nothing)
##   autoplay=tier  a Bot of that tier (scripts/core/bot.gd) watches each stage and publishes what
##                  it would do as `advice` in the state; the browser test does it with real
##                  clicks and keys. The bot never touches the board itself.
##
## In a test build the full state is published every frame as JSON in window.boxedInTest (web)
## and, with --state-log=path on desktop, appended to that file once per second of play.

## The known defects a check must catch. Each is one line in the game, guarded by planted().
const PLANTS := {
	"no_meter": "Pen meters (area / limit, bar and padlock) are not drawn.",
	"no_right_turn": "Right-click no longer turns the wall (Space still does).",
	"esc_quits": "Esc during play quits to the title without asking.",
	"hide_locks": "Locked pens look exactly like open space: same colour, no padlock, no glow.",
	"shake_ignores_reduced": "Screen shake plays even with reduced motion on.",
	"double_pick": "One click on an upgrade card applies it twice.",
	"no_best_save": "The best score and stage are never saved.",
	"tip_stays_put": "The tutorial tip never moves off the play it covers.",
	"red_busy_preview": "While a wall builds, the hover preview shows the whole path in red again.",
	"no_direction_icon": "The next wall's direction shows only while hovering open space.",
	"meter_at_centre": "Pen meters sit at the pen's centre, on walls or not.",
	"no_danger_cue": "A growing wall gives no warning when a ball comes close.",
}

var enabled := false
var stepped := false
var persona := ""
var autoplay := ""
var start_stage := 0
var quiet := false
var plants := {}
## Board steps the page has asked for and the field hasn't run yet.
var steps_pending := 0
## Board steps run under the stepped clock so far.
var steps_taken := 0
var state_log := ""

var _step_callback: JavaScriptObject
var _last_log := -1.0


func _ready() -> void:
	var flags := _read_flags()
	# On desktop, --stage alone is the old dev option, not a test run.
	var switched_on := flags.keys().any(func(key: String) -> bool: return key not in ["stage", "quiet"])
	enabled = OS.has_feature("test_hooks") or (not OS.has_feature("web") and switched_on)
	if not enabled:
		return
	stepped = flags.has("step")
	persona = str(flags.get("persona", ""))
	autoplay = str(flags.get("autoplay", ""))
	start_stage = clampi(str(flags.get("stage", "0")).to_int(), 0, 99)
	quiet = flags.has("quiet")
	assert(autoplay == "" or Bot.TIERS.has(autoplay), "unknown autoplay tier " + autoplay)
	if autoplay != "" and not Bot.TIERS.has(autoplay):
		autoplay = ""
	state_log = flags.get("state-log", "")
	for plant_name in str(flags.get("plant", "")).split(",", false):
		assert(PLANTS.has(plant_name), "unknown plant " + plant_name)
		if PLANTS.has(plant_name):
			plants[plant_name] = true
	if OS.has_feature("web"):
		_step_callback = JavaScriptBridge.create_callback(_on_step_requested)
		var window := JavaScriptBridge.get_interface("window")
		window.boxedInStep = _step_callback
	print("Test hooks on: step=%s persona=%s autoplay=%s plants=%s" % [stepped, persona, autoplay, ",".join(plants.keys())])


func planted(plant_name: String) -> bool:
	return enabled and plants.has(plant_name)


## How many board steps the field may run this frame under the stepped clock (at most `most`).
func take_steps(most: int) -> int:
	var n := mini(steps_pending, most)
	steps_pending -= n
	steps_taken += n
	return n


## Who played the run, for the run log: "human", or "persona:<id>" in a persona playtest.
func run_source() -> String:
	return "persona:" + persona if enabled and persona != "" else "human"


## Publishes the game's full state (built by Main.test_state()). Test builds only.
func publish(state: Dictionary) -> void:
	if not enabled or quiet:
		return
	state["test"] = {"stepped": stepped, "steps_pending": steps_pending, "steps_taken": steps_taken,
		"persona": persona, "autoplay": autoplay, "plants": plants.keys()}
	if OS.has_feature("web"):
		var window := JavaScriptBridge.get_interface("window")
		window.boxedInTest = JSON.stringify(state)
	elif state_log != "":
		var now := Time.get_ticks_msec() / 1000.0
		if now - _last_log >= 1.0:
			_last_log = now
			var file := FileAccess.open(state_log, FileAccess.READ_WRITE) if FileAccess.file_exists(state_log) else FileAccess.open(state_log, FileAccess.WRITE)
			if file:
				file.seek_end()
				file.store_line(JSON.stringify(state))


func _on_step_requested(args: Array) -> void:
	var n := 1
	if args.size() > 0 and args[0] != null:
		n = int(args[0])
	steps_pending += maxi(0, n)


func _read_flags() -> Dictionary:
	var flags := {}
	var words: PackedStringArray = []
	if OS.has_feature("web"):
		var search: Variant = JavaScriptBridge.eval("window.location.search", true)
		if search is String:
			words = (search as String).trim_prefix("?").split("&", false)
	else:
		words = OS.get_cmdline_user_args()
	for word in words:
		var parts := word.trim_prefix("--").split("=", true, 1)
		if parts[0] in ["test", "step", "persona", "plant", "state-log", "autoplay", "stage", "quiet"]:
			flags[parts[0]] = parts[1].uri_decode() if parts.size() > 1 else true
	return flags
