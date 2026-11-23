extends SceneTree
## Writes every sound effect and music loop to res://audio/ as 16-bit mono WAV files, and prints
## each file's peak and RMS level. Everything is synthesised here from sine, triangle and
## filtered noise; nothing is sampled from anywhere else. Seeded, so a rerun writes the same files.
##   dev -Sounds
##
## Music loops carry a WAV "smpl" loop point, so Godot's importer ("Detect From WAV") loops them.
## Notes that ring past a loop's end wrap round to its start, so the seam is silent.

const RATE := 22050
const OUT_DIR := "res://audio"
## Peak level each file is normalised to, in dBFS. Playback levels are set in Audio.
const SFX_PEAK_DB := -3.0
const UI_PEAK_DB := -6.0
const MUSIC_PEAK_DB := -4.0

var rng := RandomNumberGenerator.new()


func _initialize() -> void:
	rng.seed = 20261119
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	var rows: Array[String] = []
	var sounds := {
		"ui_move": _ui_move, "ui_select": _ui_select, "ui_back": _ui_back,
		"wall_start": _wall_start, "turn": _turn, "blocked": _blocked, "snap": _snap,
		"capture": _capture, "break": _break, "shield": _shield, "lock": _lock, "split": _split,
		"freeze": _freeze, "repel": _repel, "level_up": _level_up, "clear": _clear,
		"game_over": _game_over, "victory": _victory, "pick": _pick,
	}
	for sound_name in sounds:
		var samples: PackedFloat32Array = sounds[sound_name].call()
		var peak_db := UI_PEAK_DB if sound_name.begins_with("ui_") else SFX_PEAK_DB
		_normalize(samples, peak_db)
		_fade_edges(samples)
		rows.append(_write(sound_name, samples, false))
	for loop_name in ["music_menu", "music_play"]:
		var started := Time.get_ticks_msec()
		var samples: PackedFloat32Array = _music_menu() if loop_name == "music_menu" else _music_play()
		_normalize(samples, MUSIC_PEAK_DB)
		rows.append(_write(loop_name, samples, true) + "   (%.1f s to render)" % ((Time.get_ticks_msec() - started) / 1000.0))
	print("file                 length    peak dBFS   RMS dBFS")
	for row in rows:
		print(row)
	quit()


# --- Building blocks --------------------------------------------------------------------------


func _buffer(seconds: float) -> PackedFloat32Array:
	var b := PackedFloat32Array()
	b.resize(int(seconds * RATE))
	return b


static func _midi(note: float) -> float:
	return 440.0 * pow(2.0, (note - 69.0) / 12.0)


## Adds a tone that glides from f0 to f1 (exponentially) over its length. The envelope is a linear
## attack, an exponential decay at `decay` per second, and a linear release over the last
## `release` seconds. With `wrap`, samples past the buffer's end land at its start (for loops).
## Waves: "sine", "tri", "warm" (sine with soft odd harmonics), "pad" (three detuned sines).
func _tone(b: PackedFloat32Array, start: float, length: float, f0: float, f1: float, amp: float, wave := "sine", attack := 0.004, decay := 0.0, release := 0.01, wrap := false) -> void:
	var i0 := int(start * RATE)
	var n := int(length * RATE)
	var size := b.size()
	var phase := 0.0
	var phase2 := 0.0
	var phase3 := 0.0
	var ratio := f1 / f0
	var wave_id := ["sine", "tri", "warm", "pad"].find(wave)
	for i in n:
		var index := i0 + i
		if index >= size:
			if not wrap:
				return
			index %= size
		var t := float(i) / RATE
		var f := f0 * pow(ratio, t / length) if ratio != 1.0 else f0
		phase += f / RATE
		var s: float
		match wave_id:
			0:
				s = sin(TAU * phase)
			1:
				s = 4.0 * absf(fposmod(phase, 1.0) - 0.5) - 1.0
			2:
				s = sin(TAU * phase) + 0.22 * sin(3.0 * TAU * phase) + 0.08 * sin(5.0 * TAU * phase)
			_:
				phase2 += f * 1.0035 / RATE
				phase3 += f * 0.9968 / RATE
				s = (sin(TAU * phase) + 0.7 * sin(TAU * phase2) + 0.7 * sin(TAU * phase3) + 0.18 * sin(2.0 * TAU * phase)) * 0.38
		var env := 1.0
		if t < attack:
			env = t / attack
		if decay > 0.0:
			env *= exp(-decay * t)
		var left := length - t
		if left < release:
			env *= left / release
		b[index] += s * amp * env


## Adds filtered noise. The low-pass cutoff glides from lp0 to lp1 Hz; hp (Hz, 0 for none) takes
## out the lows. Same envelope as _tone.
func _noise(b: PackedFloat32Array, start: float, length: float, amp: float, lp0: float, lp1: float, hp := 0.0, attack := 0.002, decay := 0.0, release := 0.01, wrap := false) -> void:
	var i0 := int(start * RATE)
	var n := int(length * RATE)
	var size := b.size()
	var low := 0.0
	var high_state := 0.0
	var hp_a := 0.0 if hp <= 0.0 else exp(-TAU * hp / RATE)
	for i in n:
		var index := i0 + i
		if index >= size:
			if not wrap:
				return
			index %= size
		var t := float(i) / RATE
		var cutoff := lp0 * pow(lp1 / lp0, t / length)
		var a := 1.0 - exp(-TAU * cutoff / RATE)
		low += a * (rng.randf_range(-1.0, 1.0) - low)
		var s := low
		if hp > 0.0:
			high_state = hp_a * high_state + (1.0 - hp_a) * low
			s = low - high_state
		var env := 1.0
		if t < attack:
			env = t / attack
		if decay > 0.0:
			env *= exp(-decay * t)
		var left := length - t
		if left < release:
			env *= left / release
		b[index] += s * amp * env


## A bell: inharmonic sine partials, each decaying faster the higher it is.
func _bell(b: PackedFloat32Array, start: float, freq: float, amp: float, length := 1.2, wrap := false) -> void:
	var partials := [[1.0, 1.0, 3.0], [2.0, 0.35, 5.0], [3.01, 0.18, 8.0], [4.17, 0.08, 12.0]]
	for p in partials:
		_tone(b, start, length, freq * p[0], freq * p[0], amp * p[1], "sine", 0.002, p[2], 0.05, wrap)


## A plucked note: a triangle that dies away quickly.
func _pluck(b: PackedFloat32Array, start: float, freq: float, amp: float, length := 0.5, wrap := false) -> void:
	_tone(b, start, length, freq, freq, amp, "tri", 0.003, 7.0, 0.05, wrap)
	_tone(b, start, length, freq * 2.0, freq * 2.0, amp * 0.25, "sine", 0.003, 12.0, 0.05, wrap)


func _normalize(b: PackedFloat32Array, peak_db: float) -> void:
	var peak := 0.0
	for s in b:
		peak = maxf(peak, absf(s))
	if peak <= 0.0:
		return
	var gain := db_to_linear(peak_db) / peak
	for i in b.size():
		b[i] *= gain


## 2 ms fades at both ends, so no one-shot clicks on start or stop.
func _fade_edges(b: PackedFloat32Array) -> void:
	var n := mini(int(0.002 * RATE), b.size() / 2)
	for i in n:
		var g := float(i) / n
		b[i] *= g
		b[b.size() - 1 - i] *= g


## Writes a 16-bit mono WAV (with a smpl loop chunk if `loop`) and returns its report row.
func _write(sound_name: String, b: PackedFloat32Array, loop: bool) -> String:
	var pcm := PackedByteArray()
	pcm.resize(b.size() * 2)
	var peak := 0.0
	var sum := 0.0
	for i in b.size():
		var s := clampf(b[i], -1.0, 1.0)
		peak = maxf(peak, absf(s))
		sum += s * s
		pcm.encode_s16(i * 2, roundi(s * 32767.0))
	var chunks := PackedByteArray()
	var fmt := PackedByteArray()
	fmt.resize(16)
	fmt.encode_u16(0, 1)  # PCM
	fmt.encode_u16(2, 1)  # mono
	fmt.encode_u32(4, RATE)
	fmt.encode_u32(8, RATE * 2)
	fmt.encode_u16(12, 2)
	fmt.encode_u16(14, 16)
	chunks.append_array(_chunk("fmt ", fmt))
	if loop:
		var smpl := PackedByteArray()
		smpl.resize(60)
		smpl.encode_u32(8, int(1e9 / RATE))  # sample period, ns
		smpl.encode_u32(12, 60)  # MIDI unity note
		smpl.encode_u32(28, 1)  # one loop
		smpl.encode_u32(36 + 4, 0)  # loop type: forward
		smpl.encode_u32(36 + 8, 0)  # start
		smpl.encode_u32(36 + 12, b.size() - 1)  # end (inclusive)
		chunks.append_array(_chunk("smpl", smpl))
	chunks.append_array(_chunk("data", pcm))
	var file := FileAccess.open("%s/%s.wav" % [OUT_DIR, sound_name], FileAccess.WRITE)
	file.store_buffer("RIFF".to_ascii_buffer())
	file.store_32(4 + chunks.size())
	file.store_buffer("WAVE".to_ascii_buffer())
	file.store_buffer(chunks)
	file.close()
	var rms := sqrt(sum / maxf(1.0, b.size()))
	return "%-20s %6.2f s   %8.1f   %8.1f" % [sound_name + ".wav", b.size() / float(RATE), linear_to_db(peak), linear_to_db(rms)]


static func _chunk(id: String, body: PackedByteArray) -> PackedByteArray:
	var out := id.to_ascii_buffer()
	var size := PackedByteArray()
	size.resize(4)
	size.encode_u32(0, body.size())
	out.append_array(size)
	out.append_array(body)
	if body.size() % 2 == 1:
		out.append(0)
	return out


# --- Interface --------------------------------------------------------------------------------


func _ui_move() -> PackedFloat32Array:
	var b := _buffer(0.05)
	_tone(b, 0.0, 0.05, 1500.0, 1600.0, 0.6, "sine", 0.002, 70.0)
	return b


func _ui_select() -> PackedFloat32Array:
	var b := _buffer(0.16)
	_tone(b, 0.0, 0.07, 880.0, 880.0, 0.5, "warm", 0.002, 30.0)
	_tone(b, 0.045, 0.11, 1320.0, 1320.0, 0.5, "warm", 0.002, 25.0)
	return b


func _ui_back() -> PackedFloat32Array:
	var b := _buffer(0.16)
	_tone(b, 0.0, 0.07, 1100.0, 1100.0, 0.45, "warm", 0.002, 30.0)
	_tone(b, 0.045, 0.11, 740.0, 740.0, 0.45, "warm", 0.002, 25.0)
	return b


# --- Walls ------------------------------------------------------------------------------------


func _wall_start() -> PackedFloat32Array:
	var b := _buffer(0.14)
	_tone(b, 0.0, 0.14, 260.0, 150.0, 0.8, "warm", 0.002, 28.0)
	_noise(b, 0.0, 0.012, 0.35, 6000.0, 3000.0, 1500.0, 0.0005, 200.0)
	return b


func _turn() -> PackedFloat32Array:
	var b := _buffer(0.04)
	_tone(b, 0.0, 0.04, 1000.0, 1150.0, 0.5, "tri", 0.002, 70.0)
	return b


func _blocked() -> PackedFloat32Array:
	var b := _buffer(0.2)
	_tone(b, 0.0, 0.07, 150.0, 140.0, 0.6, "warm", 0.003, 20.0)
	_tone(b, 0.09, 0.09, 140.0, 125.0, 0.6, "warm", 0.003, 20.0)
	return b


## A half sets solid: a tight click with a bright, short ring.
func _snap() -> PackedFloat32Array:
	var b := _buffer(0.22)
	_noise(b, 0.0, 0.01, 0.6, 9000.0, 5000.0, 2500.0, 0.0003, 300.0)
	_tone(b, 0.0, 0.22, 1760.0, 1760.0, 0.35, "sine", 0.001, 26.0)
	_tone(b, 0.0, 0.16, 2637.0, 2637.0, 0.18, "sine", 0.001, 34.0)
	_tone(b, 0.0, 0.08, 220.0, 160.0, 0.4, "sine", 0.001, 40.0)
	return b


## Space fills in: an airy rising sweep under a short climbing shimmer.
func _capture() -> PackedFloat32Array:
	var b := _buffer(0.6)
	_noise(b, 0.0, 0.5, 0.5, 500.0, 5000.0, 300.0, 0.08, 4.0, 0.15)
	var notes := [76.0, 79.0, 83.0, 88.0]  # E5 G5 B5 E6
	for i in notes.size():
		_tone(b, 0.04 + i * 0.05, 0.45, _midi(notes[i]), _midi(notes[i]), 0.16, "sine", 0.004, 9.0, 0.08)
	return b


## A ball breaks a growing half: a dull crunch and a falling thud.
func _break() -> PackedFloat32Array:
	var b := _buffer(0.45)
	_noise(b, 0.0, 0.3, 0.8, 2500.0, 400.0, 80.0, 0.001, 14.0, 0.05)
	_tone(b, 0.0, 0.4, 320.0, 55.0, 0.7, "warm", 0.002, 8.0, 0.08)
	for i in 4:
		_noise(b, 0.03 + i * 0.045 + rng.randf() * 0.02, 0.02, 0.35, 4000.0, 2000.0, 800.0, 0.0005, 120.0)
	return b


## A shield (Hardened Tip) turns a ball away: a clean metallic ping.
func _shield() -> PackedFloat32Array:
	var b := _buffer(0.6)
	_bell(b, 0.0, 1200.0, 0.6, 0.6)
	_noise(b, 0.0, 0.008, 0.3, 8000.0, 6000.0, 3000.0, 0.0003, 300.0)
	return b


## A pen locks. Played at higher pitches as more pens lock in one stage.
func _lock() -> PackedFloat32Array:
	var b := _buffer(1.3)
	_bell(b, 0.0, _midi(72.0), 0.55, 1.3)  # C5
	_bell(b, 0.0, _midi(79.0), 0.25, 1.1)  # G5
	return b


func _split() -> PackedFloat32Array:
	var b := _buffer(0.14)
	_tone(b, 0.0, 0.07, 500.0, 900.0, 0.6, "sine", 0.002, 20.0)
	_tone(b, 0.05, 0.09, 700.0, 1250.0, 0.5, "sine", 0.002, 20.0)
	return b


# --- Actives ----------------------------------------------------------------------------------


func _freeze() -> PackedFloat32Array:
	var b := _buffer(0.8)
	for i in 5:
		var f := 2600.0 + i * 410.0
		_tone(b, i * 0.03, 0.7, f, f * 0.55, 0.14, "sine", 0.01, 4.0, 0.15)
	_noise(b, 0.0, 0.6, 0.25, 9000.0, 3000.0, 2000.0, 0.02, 5.0, 0.2)
	return b


func _repel() -> PackedFloat32Array:
	var b := _buffer(0.5)
	_tone(b, 0.0, 0.45, 90.0, 260.0, 0.8, "warm", 0.01, 5.0, 0.12)
	_noise(b, 0.0, 0.4, 0.4, 300.0, 3000.0, 150.0, 0.05, 6.0, 0.15)
	return b


# --- Run --------------------------------------------------------------------------------------


func _level_up() -> PackedFloat32Array:
	var b := _buffer(0.9)
	_tone(b, 0.0, 0.35, 400.0, 1600.0, 0.35, "warm", 0.01, 2.0, 0.08)
	var notes := [84.0, 88.0, 91.0, 96.0]  # C6 E6 G6 C7
	for i in notes.size():
		_bell(b, 0.18 + i * 0.07, _midi(notes[i]), 0.22, 0.6)
	return b


func _clear() -> PackedFloat32Array:
	var b := _buffer(1.6)
	var notes := [72.0, 76.0, 79.0, 84.0]  # C5 E5 G5 C6
	for i in notes.size():
		_pluck(b, i * 0.09, _midi(notes[i]), 0.5, 0.6)
	_bell(b, 0.36, _midi(84.0), 0.35, 1.2)
	_tone(b, 0.36, 1.2, _midi(60.0), _midi(60.0), 0.3, "pad", 0.05, 2.5, 0.3)
	return b


func _game_over() -> PackedFloat32Array:
	var b := _buffer(1.4)
	var notes := [67.0, 63.0, 60.0]  # G4 Eb4 C4
	for i in notes.size():
		_tone(b, i * 0.26, 0.5 if i < 2 else 1.1, _midi(notes[i]), _midi(notes[i]), 0.5, "warm", 0.01, 3.0 if i < 2 else 1.8, 0.1)
	_tone(b, 0.52, 0.9, _midi(36.0), _midi(36.0), 0.4, "sine", 0.02, 2.5, 0.2)
	return b


func _victory() -> PackedFloat32Array:
	var b := _buffer(2.6)
	var notes := [72.0, 76.0, 79.0, 84.0, 88.0]
	for i in notes.size():
		_pluck(b, i * 0.1, _midi(notes[i]), 0.45, 0.7)
	for note in [60.0, 64.0, 67.0, 72.0]:
		_tone(b, 0.5, 2.1, _midi(note), _midi(note), 0.22, "pad", 0.08, 1.2, 0.5)
	_bell(b, 0.5, _midi(84.0), 0.35, 2.0)
	_bell(b, 0.62, _midi(91.0), 0.2, 1.8)
	return b


func _pick() -> PackedFloat32Array:
	var b := _buffer(0.6)
	_tone(b, 0.0, 0.08, 880.0, 880.0, 0.4, "warm", 0.002, 25.0)
	_tone(b, 0.05, 0.12, 1320.0, 1320.0, 0.4, "warm", 0.002, 20.0)
	_bell(b, 0.1, 1760.0, 0.3, 0.5)
	return b


# --- Music ------------------------------------------------------------------------------------

## Chords as [bass note, pad notes...] (MIDI): Am9, Fmaj7, Cmaj7, G6.
const CHORDS := [
	[45, 57, 60, 64, 71],
	[41, 53, 57, 60, 64],
	[48, 55, 59, 64, 67],
	[43, 55, 59, 62, 64],
]
const PENTATONIC := [69, 72, 74, 76, 79, 81, 84]  # A minor pentatonic, A4 to C6


## Title and menus: slow pads with a few bell notes, no drums. 8 bars of 4 s.
func _music_menu() -> PackedFloat32Array:
	var bar := 4.0
	var bars := 8
	var b := _buffer(bar * bars)
	for i in bars:
		var chord: Array = CHORDS[i % 4]
		var at := i * bar
		_tone(b, at, bar + 1.5, _midi(chord[0]), _midi(chord[0]), 0.22, "sine", 0.6, 0.0, 1.5, true)
		for k in range(1, chord.size()):
			_tone(b, at, bar + 1.5, _midi(chord[k]), _midi(chord[k]), 0.16, "pad", 1.2, 0.0, 1.6, true)
		for beat in [0.5, 2.0, 3.0]:
			if rng.randf() < 0.6:
				var note: int = PENTATONIC[rng.randi_range(0, PENTATONIC.size() - 1)]
				_bell(b, at + beat, _midi(note), 0.09, 2.0, true)
	return b


## In play: the same chords at 96 BPM with a soft bass, a plucked arpeggio, a quiet kick and,
## in the second half, hats and a counter-melody. 16 bars, 40 s.
func _music_play() -> PackedFloat32Array:
	var beat := 60.0 / 96.0
	var bar := beat * 4.0
	var bars := 16
	var b := _buffer(bar * bars)
	var arp_order := [0, 1, 2, 3, 2, 1, 2, 3]
	for i in bars:
		var chord: Array = CHORDS[i % 4]
		var at := i * bar
		var second_half := i >= 8
		# Pad and bass.
		for k in range(1, chord.size()):
			_tone(b, at, bar + 1.0, _midi(chord[k]), _midi(chord[k]), 0.10, "pad", 0.4, 0.0, 1.0, true)
		for half in 2:
			_tone(b, at + half * beat * 2.0, beat * 2.0, _midi(chord[0]), _midi(chord[0]), 0.30, "warm", 0.01, 1.2, 0.08, true)
		# Arpeggio, an octave higher in the second half.
		var lift := 24 if second_half else 12
		for step in 8:
			var note: int = chord[1 + arp_order[step]] + lift
			var accent := 1.0 if step % 2 == 0 else 0.7
			_pluck(b, at + step * beat * 0.5, _midi(note), 0.10 * accent, 0.5, true)
		# Kick on 1 and 3.
		for k in [0, 2]:
			_tone(b, at + k * beat, 0.25, 110.0, 45.0, 0.45, "sine", 0.002, 14.0, 0.03, true)
		if second_half:
			for step in 4:
				_noise(b, at + (step + 0.5) * beat, 0.05, 0.08, 9000.0, 7000.0, 5000.0, 0.001, 60.0, 0.01, true)
			# Counter-melody: one long bell note per bar from the chord's top.
			_bell(b, at, _midi(chord[4] + 12), 0.10, bar, true)
	return b
