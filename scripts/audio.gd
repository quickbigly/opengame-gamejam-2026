extends Node
## Autoload "Audio": plays the synthesised effects (made by `dev -Sounds`) and the music loops.
## Buses: Music and SFX, both into Master; Settings sets their volumes. Effects come from a small
## pool of players; the same effect can't restart within MIN_GAP, so a burst of events plays one.
##
## The levels below were set by meter (peak and RMS, printed by `dev -Sounds`). Nobody has
## listened to them yet.

const SOUNDS := [
	"ui_move", "ui_select", "ui_back", "wall_start", "turn", "blocked", "snap", "capture",
	"break", "shield", "lock", "split", "freeze", "repel", "level_up", "clear", "game_over",
	"victory", "pick",
]
## Playback level per effect, in dB. The files peak at -3 dBFS (interface at -6).
const LEVELS := {
	"ui_move": -10.0, "ui_select": -6.0, "ui_back": -6.0, "turn": -10.0, "blocked": -8.0,
	"wall_start": -6.0, "snap": -2.0, "capture": -3.0, "break": 0.0, "shield": -4.0,
	"lock": -3.0, "split": -5.0, "freeze": -4.0, "repel": -4.0, "level_up": -3.0,
	"clear": -2.0, "game_over": -2.0, "victory": -1.0, "pick": -4.0,
}
## Music level per loop, in dB. The menu loop is denser (RMS -13.9 against -19.1 dBFS).
const MUSIC_LEVELS := {"menu": -14.0, "play": -9.0}
const VOICES := 10
const MIN_GAP := 0.04
const PITCH_JITTER := 0.025
const MUSIC_FADE := 1.2
## How far the music drops while paused.
const PAUSE_DUCK := -8.0

var _streams := {}
var _players: Array[AudioStreamPlayer] = []
var _last_played := {}
var _music: Array[AudioStreamPlayer] = []
var _music_streams := {}
var _current_music := ""
var _ducked := false
var _fades := {}
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_rng.randomize()
	for bus_name in ["Music", "SFX"]:
		if AudioServer.get_bus_index(bus_name) < 0:
			AudioServer.add_bus()
			var index := AudioServer.bus_count - 1
			AudioServer.set_bus_name(index, bus_name)
			AudioServer.set_bus_send(index, "Master")
	Settings.apply()

	for sound_name in SOUNDS:
		_streams[sound_name] = load("res://audio/%s.wav" % sound_name)
	for i in VOICES:
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_players.append(player)
	for loop_name in MUSIC_LEVELS:
		_music_streams[loop_name] = load("res://audio/music_%s.wav" % loop_name)
	for i in 2:
		var player := AudioStreamPlayer.new()
		player.bus = "Music"
		player.volume_db = -80.0
		add_child(player)
		_music.append(player)


func _exit_tree() -> void:
	for player in _players + _music:
		player.stop()


## Plays an effect. `pitch` scales its pitch (and speed); `gain_db` adds to its level.
func play(sound_name: String, pitch := 1.0, gain_db := 0.0) -> void:
	var stream: AudioStream = _streams.get(sound_name)
	if stream == null:
		push_warning("No sound named " + sound_name)
		return
	var now := Time.get_ticks_msec() / 1000.0
	if now - _last_played.get(sound_name, -1.0) < MIN_GAP:
		return
	_last_played[sound_name] = now
	var player := _free_player()
	player.stream = stream
	player.volume_db = LEVELS.get(sound_name, -6.0) + gain_db
	player.pitch_scale = pitch * (1.0 + _rng.randf_range(-PITCH_JITTER, PITCH_JITTER))
	player.play()


## The first idle player, or else the one that has played longest.
func _free_player() -> AudioStreamPlayer:
	var oldest := _players[0]
	for player in _players:
		if not player.playing:
			return player
		if player.get_playback_position() > oldest.get_playback_position():
			oldest = player
	return oldest


## Crossfades to a music loop ("menu", "play", or "" for silence). Does nothing if it's playing.
## _music[0] is the current loop's player; _music[1] is the one fading out or idle.
func music(loop_name: String) -> void:
	if loop_name == _current_music:
		return
	_current_music = loop_name
	var outgoing := _music[0]
	var incoming := _music[1]
	_music.reverse()
	if outgoing.playing:
		_fade(outgoing, -60.0, MUSIC_FADE, true)
	if loop_name == "":
		return
	incoming.stream = _music_streams[loop_name]
	incoming.volume_db = -40.0
	incoming.play()
	_fade(incoming, _music_level(), MUSIC_FADE, false)


## Lowers the music while the game is paused.
func duck(on: bool) -> void:
	if on == _ducked:
		return
	_ducked = on
	if _music[0].playing:
		_fade(_music[0], _music_level(), 0.25, false)


func _fade(player: AudioStreamPlayer, to_db: float, seconds: float, then_stop: bool) -> void:
	var previous: Tween = _fades.get(player)
	if previous:
		previous.kill()
	var tween := create_tween()
	tween.tween_property(player, "volume_db", to_db, seconds)
	if then_stop:
		tween.tween_callback(player.stop)
	_fades[player] = tween


func _music_level() -> float:
	return MUSIC_LEVELS.get(_current_music, -12.0) + (PAUSE_DUCK if _ducked else 0.0)
