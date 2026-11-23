class_name Palette
extends RefCounted
## The game's colours. The colour-blind-safe palette (from the Okabe–Ito set) swaps the hues
## that carry meaning; state never reads by colour alone in either palette (stripes, outlines,
## icons and text carry it too). Settings sets `colorblind`.

const DEFAULT := {
	"background": Color("0b0e16"),
	"background_glow": Color("1a2340"),
	"grid_line": Color("1a2131"),
	"open": Color("111622"),
	"filled": Color("27304a"),
	"filled_rim": Color("4f5f8a"),
	"pen_locked": Color("123a33"),
	"half_a": Color("4cc9f0"),
	"half_b": Color("f7b267"),
	"stripe": Color("0b0e16", 0.5),
	"ball": Color("f1f4fb"),
	"ball_locked": Color("7fd8be"),
	"frozen": Color("9ad7ff"),
	"preview": Color(1, 1, 1, 0.16),
	"preview_blocked": Color("ff5d73", 0.24),
	"text": Color("e8ecf4"),
	"text_dim": Color("949db2"),
	"good": Color("7fd8be"),
	"bad": Color("ff5d73"),
	"xp": Color("c792ea"),
	"panel": Color("161b29"),
	"panel_edge": Color("2c3550"),
	"button": Color("222a3e"),
	"button_hover": Color("2f3955"),
	"focus": Color("4cc9f0"),
	"common": Color("a9b4c8"),
	"rare": Color("4cc9f0"),
	"epic": Color("f7b267"),
}

const COLORBLIND := {
	"pen_locked": Color("37361a"),
	"half_a": Color("56b4e9"),
	"half_b": Color("e69f00"),
	"ball_locked": Color("f0e442"),
	"preview_blocked": Color("d55e00", 0.3),
	"good": Color("f0e442"),
	"bad": Color("d55e00"),
	"xp": Color("cc79a7"),
	"focus": Color("56b4e9"),
	"rare": Color("56b4e9"),
	"epic": Color("e69f00"),
}

static var colorblind := false


static func c(color_name: String) -> Color:
	if colorblind and COLORBLIND.has(color_name):
		return COLORBLIND[color_name]
	return DEFAULT[color_name]
