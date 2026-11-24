extends Node
## Autoload "Settings": the player's settings, from one schema. Each change is sanitised, saved
## to the [settings] section of user://save.cfg at once and applied live. Read once at boot.

signal changed

const SAVE_PATH := "user://save.cfg"
const SECTION := "settings"

## One entry per setting, in the order the settings screen shows them. Volumes are 0 to 1.
const SCHEMA: Array[Dictionary] = [
	{"key": "master_volume", "label": "Master volume", "default": 0.8},
	{"key": "music_volume", "label": "Music", "default": 0.6},
	{"key": "sfx_volume", "label": "Effects", "default": 0.8},
	{"key": "reduced_motion", "label": "Reduced motion", "default": false,
		"hint": "No shake, sweeps, bursts or moving stripes."},
	{"key": "colorblind", "label": "Colour-blind palette", "default": false,
		"hint": "Blue, orange and yellow in place of red and green."},
	{"key": "show_grid", "label": "Show grid", "default": true,
		"hint": "Lines between the field's cells."},
	{"key": "tips", "label": "Tutorial tips", "default": true,
		"hint": "Tips on stages 1 and 2."},
]

var _values := {}
## False when the browser or OS refused to save; the settings screen says so.
var storage_ok := true


func _ready() -> void:
	var config := ConfigFile.new()
	var loaded := config.load(SAVE_PATH) == OK
	for entry in SCHEMA:
		var key: String = entry["key"]
		var value: Variant = entry["default"]
		if loaded and config.has_section_key(SECTION, key):
			value = config.get_value(SECTION, key)
		elif key == "reduced_motion":
			value = _system_prefers_reduced_motion()
		_values[key] = sanitize(key, value)
	apply()


func value(key: String) -> Variant:
	return _values.get(key, default_of(key))


func set_value(key: String, new_value: Variant) -> void:
	_values[key] = sanitize(key, new_value)
	_save()
	apply()
	changed.emit()


## A copy of every setting, for the test state.
func values() -> Dictionary:
	return _values.duplicate()


func reduced_motion() -> bool:
	return value("reduced_motion")


static func default_of(key: String) -> Variant:
	for entry in SCHEMA:
		if entry["key"] == key:
			return entry["default"]
	return null


## Coerces a saved or set value into the setting's type and range. Unknown keys give null.
static func sanitize(key: String, raw: Variant) -> Variant:
	var default: Variant = default_of(key)
	if default is bool:
		if raw is bool:
			return raw
		if raw is int or raw is float:
			return raw != 0
		return default
	if default is float:
		if raw is int or raw is float:
			var number := float(raw)
			return default if is_nan(number) else clampf(number, 0.0, 1.0)
		return default
	return default


func apply() -> void:
	Palette.colorblind = value("colorblind")
	_set_bus("Master", value("master_volume"))
	_set_bus("Music", value("music_volume"))
	_set_bus("SFX", value("sfx_volume"))


func _set_bus(bus_name: String, level: float) -> void:
	var index := AudioServer.get_bus_index(bus_name)
	if index < 0:
		return
	AudioServer.set_bus_mute(index, level <= 0.001)
	AudioServer.set_bus_volume_db(index, linear_to_db(maxf(level, 0.001)))


func _save() -> void:
	var config := ConfigFile.new()
	config.load(SAVE_PATH)  # keep the other sections (best score)
	for key in _values:
		config.set_value(SECTION, key, _values[key])
	storage_ok = config.save(SAVE_PATH) == OK


static func _system_prefers_reduced_motion() -> bool:
	if not OS.has_feature("web"):
		return false
	var result: Variant = JavaScriptBridge.eval("window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0", true)
	# The web bridge hands a JS boolean back as a number, so compare as one (true == 1 is false).
	return (result is int or result is float) and result != 0
