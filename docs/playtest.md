# Boxed In: Playtest Guide

For M5 ([plan.md](plan.md)). Each session needs one person who hasn't played before and about 20 minutes. Run it locally or from the private OpenGame preview link.

## What the persona playtests already settled

Agents played the game as nine kinds of player first ([persona-results.md](persona-results.md)). Don't spend session time on these; they're checked by script on every build (`node run.mjs` in `tests/browser`):

- keyboard-only menus;
- reduced motion;
- colour contrast of locked pens under five kinds of colour blindness;
- saving across a reload;
- a clean second run;
- 700 random inputs without a crash;
- the tip box never hiding a ball.

Spend the sessions on what agents can't judge:

- **Sound.** Nobody has heard it.
- **Real difficulty.** Agents played on a paused clock. The newcomer bot loses on stage 1 in 27% of runs, while careful agents found stages 1–3 slow and easy. Which is it for a person?
- **First impressions,** and these questions from the agents' findings:
  - When a wall is still building, do they understand the grey "wall building" outline?
  - Does the pulsing red outline (a ball is near a growing wall) help, or does it make the game too easy?
  - Do they always know which way the next wall will grow?
  - Does the tip box moving between the bottom and top of the field distract them?

## Before the session

1. Export the web build with `dev -Web`. Serve it with `python -m http.server 5180 --directory build/web` and open http://localhost:5180 in Chrome or Firefox. Or use the private preview link once there is one.
2. Use a fresh browser profile or a private window, so there's no saved best score or settings and the tips show.
3. Turn the sound on and use speakers or headphones. Nobody has listened to the sounds yet, so the tester is the first.

## During the session

Say only: "This is a puzzle game. Play it however you like and think out loud." Don't explain the rules, and don't help unless they've been stuck for 2 minutes.

Write down, with the time:

- Anything they say out loud, word for word, especially questions.
- Where they hesitate for more than a few seconds, and on which screen.
- Their first click: where, and whether it built a wall.
- Whether they find the turn control (right-click or Space) without being told.
- Each life lost, and whether they can say why.
- Whether they read the pen meter (area / limit) and understand when a pen will lock.
- The stage they reach, and their score.
- Anything that looks broken, sounds wrong or is too loud.

## Afterwards, ask

1. What was the goal of each stage?
2. What made you lose a life?
3. Which upgrade did you like most, and which did nothing for you?
4. Was any sound annoying, too loud, too quiet or missing? Was the music OK to listen to for a whole run?
5. Was anything hard to read or to see? (Ask about colours if they're colour-blind.)
6. Would you play another run?

## Sound check (needs ears)

Nobody has heard the sounds yet: every level was set by meter (`dev -Sounds` prints peak and RMS). A person needs to check:

- Sound starts on the first click on the title screen, with no extra "click for sound" step.
- The break sound is clearly the loudest effect, and the snap and capture sounds are pleasant to hear hundreds of times.
- The lock chime rises in pitch as more pens lock in a stage.
- The play music loops without an audible seam (it's 40 s long; the menu loop is 32 s).
- The volume sliders work, and setting one to 0 silences it.

## After a few sessions

- Fix whatever more than one person tripped on.
- Have each tester finish at least one run from stage 1 in the desktop build (`dev`) on this machine, then run `dev -Balance --real`. This puts their runs beside the bot tiers and closes the M3 real-run check. Runs played in a browser are logged to that browser's own storage, which the balance script can't read.
