# Snowbound Signal: Fault Library

**Snowbound Signal** is a cozy winter puzzle and management game for the OpenGame Game Jam 2026.

- **Premise:** it's the night before the town's winter festival broadcast, and a blizzard has snowed in the town. You're the only TV and tech fixer.
- **How a job works:** neighbors call with problems. You visit, look at how their living room is hooked up, and fix it.
- **Order matters** inside each fix, and along your route through town.

## Design Rule: No Jargon Required

Anyone should be able to play this, even if they've never plugged in a soundbar. Every fault is based on a real problem, but the player only ever sees plain words and pictures.

### Show the Connections

The **Hookup View** draws each connection as a colored line:

| Line | Meaning |
| --- | --- |
| Blue | Picture |
| Orange | Sound |
| Green | Internet |
| Purple dotted | Remote and "auto-control" signals |

When something is wrong, the line visibly breaks, flickers, fades or goes to the wrong place. Players fix what they can see.

### Friendly Device Names

| In game | Real thing |
| --- | --- |
| TV | TV |
| Sound Bar | Soundbar |
| Cable Box / Satellite Box | Set-top box |
| Game Console | Game console |
| Streaming Stick | Streaming stick |
| Internet Box | Modem |
| Wi-Fi Box | Router |
| Speaker Hub | AV receiver |
| Splitter | HDMI splitter |
| Smart Plug | Smart plug |

### Friendly Terms

| In game | Real concept |
| --- | --- |
| Sound socket (TV socket with a speaker icon) | HDMI ARC port |
| Auto-control | HDMI-CEC |
| Handshake (devices must say hello in the right order) | HDCP |
| Fast cable (gold label) / Old cable | Ultra High Speed vs. older HDMI |
| Hum | Ground loop |
| Picture zoomed in | Overscan |
| Too-smooth mode | Motion smoothing |
| Black level | RGB range |
| Matches the oldest screen | Splitter EDID |

### Few, Simple Actions

The player only does six kinds of thing:

- **Plug / unplug / move a cable**
- **Turn a device on / off**
- **Flip a setting** (simple menus with 3 to 5 options)
- **Swap in a part** from the toolbox
- **Wait**
- **Ask the neighbor a question**

### Tip Cards

Solving a fault the first time unlocks a one-sentence **Tip Card** in your notebook. Later faults combine tips, so the difficulty comes from **combinations and order**, not from obscure knowledge. The notebook is also where players who like to optimize plan their best route.

## Fields

Each fault lists these fields:

- **Call:** what the neighbor says.
- **Player sees:** what the Hookup View shows.
- **What's wrong:** the cause, in plain words.
- **Fix:** the steps in order. They're the same plain actions listed above.
- **Order rule:** what happens if the steps are done out of order.
- **Bonus:** the extra fix that earns a bigger tip, or prevents a callback later.
- **Tip Card:** the line added to the notebook.
- **Real basis:** for the dev team only. It's never shown to the player.

The faults are grouped into four tiers, roughly in the order a player meets them:

| Tier | Faults | When it appears |
| --- | --- | --- |
| Tier 1: Learn the Basics | #1 to #5 | Night 1 |
| Tier 2: Neighbors' Favorites | #6 to #11 | Night 1 and Night 2 |
| Tier 3: Two Problems at Once | #12 to #16 | Night 2 |
| Tier 4: The Big Night | #17 to #20 | Night 3 |

---

## Tier 1: Learn the Basics

### 1. "It Says No Signal"

- **Call:** "The TV just says No Signal! I didn't touch anything."
- **Player sees:** the blue picture line from the Cable Box goes into the TV, but the TV is "listening" to a different socket.
- **What's wrong:** the TV is set to the wrong input. The grandkids left it on the game console.
- **Fix:**
  1. Press Input.
  2. Pick "Cable."
- **Bonus:** rename the inputs so they're easy for Grandma to read.
- **Tip Card:** "No Signal usually means the TV is looking at the wrong socket."
- **Real basis:** wrong HDMI input selected.

### 2. "The Remote Stopped Working"

- **Call:** "Remote's dead. I even put new batteries in!"
- **Player sees:** the purple dotted line from the remote hits the new Sound Bar and stops short of the TV.
- **What's wrong:** the Sound Bar sits right in front of the TV's remote sensor.
- **Fix:** slide the Sound Bar down, or use a **Remote Booster** part.
- **Order rule:** none. This fault teaches the Hookup View.
- **Tip Card:** "Remotes need a clear path to the TV."
- **Real basis:** the soundbar blocks the IR receiver.

### 3. "The Edges Are Cut Off"

- **Call:** "I can't see the score in the corner. It's like the picture is too big."
- **Player sees:** the picture overflows the TV frame.
- **What's wrong:** the TV's Picture Size is set to "Zoom."
- **Fix:** set Picture Size to "Fit Screen."
- **Tip Card:** "If the picture is cut off, check Picture Size."
- **Real basis:** overscan.

### 4. "Movies Look Weird and Too Smooth"

- **Call:** "Our new TV makes movies look like a cheap home video. Hubby hates it."
- **Player sees:** the TV's settings show "Super Smooth: ON."
- **What's wrong:** new TVs come with a too-smooth mode switched on.
- **Fix:**
  1. Set Picture Mode to "Movie."
  2. Turn Super Smooth off.
- **Order rule:** changing Picture Mode resets Super Smooth, so doing it second undoes your fix.
- **Tip Card:** "Change the big setting first, then the small ones."
- **Real basis:** motion interpolation. Picture presets reset sub-settings.

### 5. "Satellite Says Searching..."

- **Call:** "The satellite's been 'searching for signal' since lunch."
- **Player sees:** the satellite line from outside is faint and crackly. Outside, the dish has a big snow cap.
- **What's wrong:** snow is piled on the dish.
- **Fix:** brush the snow off with the **Soft Broom**.
- **Order rule:** using **Hot Water** works for a minute, then freezes into ice, which makes the problem worse.
- **Bonus:** fit a **Dish Cover** so the neighbor doesn't call again on Night 3.
- **Tip Card:** "Brush, don't melt."
- **Real basis:** snow and ice on the dish attenuate the signal.

---

## Tier 2: Neighbors' Favorites

### 6. "Sound Still Comes Out of the TV"

- **Call:** "We got a sound bar for Christmas, but the sound still comes from the TV."
- **Player sees:** the orange sound line stops at the TV and never goes back to the Sound Bar. Only one TV socket has a little speaker icon, and it's empty.
- **What's wrong:** the Sound Bar is plugged into a regular socket instead of the **sound socket**.
- **Fix:**
  1. Move the cable to the sound socket.
  2. Turn on Auto-control.
  3. Set Sound Output to "Sound Bar."
- **Order rule:** the "Sound Bar" option doesn't appear in the menu until steps 1 and 2 are done.
- **Tip Card:** "Sound bars need the socket with the speaker icon."
- **Real basis:** soundbar on a non-ARC HDMI port, with CEC needed for ARC.

### 7. "Internet's Out After the Lights Flickered"

- **Call:** "The lights blinked in the storm and now the TV says no internet."
- **Player sees:** the green line from the Internet Box to the Wi-Fi Box is broken.
- **What's wrong:** the Wi-Fi Box woke up before the Internet Box was ready, so it missed the connection.
- **Fix:**
  1. Turn off the Wi-Fi Box.
  2. Restart the Internet Box.
  3. Wait for its light to turn solid.
  4. Turn the Wi-Fi Box back on.
- **Order rule:** restarting the Wi-Fi Box first just repeats the problem.
- **Tip Card:** "Internet Box first, Wi-Fi Box second."
- **Real basis:** the router lost its WAN address while the modem was syncing.

### 8. "There's a Buzz"

- **Call:** "There's a hum coming out of the speakers, even when it's muted."
- **Player sees:** a wavy red "hum" loop circles between the Cable Box's wall cable and the Speaker Hub.
- **What's wrong:** two devices plugged into different wall outlets, plus the cable from outside, create a hum.
- **Fix:**
  1. Unplug the wall cable to test it. The hum stops.
  2. Add a **Hum Stopper** part.
  3. Plug the cable back in.
- **Bonus:** put everything on one power strip.
- **Tip Card:** "If unplugging a cable stops the hum, the hum came through that cable."
- **Real basis:** a ground loop through the CATV coax.

### 9. "Mouths Move Before the Words"

- **Call:** "Everyone's lips move before the words come out. Drives me nuts!"
- **Player sees:** the orange sound line to the Sound Bar is wireless and dotted, with a little clock icon showing delay. An unused cable lies behind the TV.
- **What's wrong:** the Sound Bar is connected wirelessly, which causes a delay.
- **Fix:**
  1. Disconnect the wireless link.
  2. Plug the Sound Bar into the sound socket (the same steps as #6).
  3. Set Lip Sync to "Auto."
- **Order rule:** if you set Lip Sync first, it's wrong again once you switch to the cable.
- **Tip Card:** "Wires beat wireless for sound timing."
- **Real basis:** Bluetooth audio latency.

### 10. "Laptop Won't Show Up on the TV"

- **Call:** "I want to show my holiday photos on the TV, but my laptop won't show up!"
- **Player sees:** the blue line from the laptop to the TV is present but dark. The laptop's screen settings show "This Screen Only."
- **What's wrong:** the laptop is set to show its picture only on itself.
- **Fix:**
  1. Set the laptop to "Show on Both."
  2. Set Sound to "TV."
- **Order rule:** the "TV" sound option only appears once the TV is showing the picture.
- **Tip Card:** "Laptops have to be told to share their screen."
- **Real basis:** Windows display mode (Win+P) and the default playback device.

### 11. "Internet Dies at 9 Every Night"

- **Call:** "Like clockwork, the internet goes out at 9 PM and comes back at 7 AM!"
- **Player sees:** the Wi-Fi Box is plugged into a **Smart Plug** with a little moon icon.
- **What's wrong:** a parent set a bedtime timer to turn off the teen's game console, but plugged the Wi-Fi Box into it by mistake.
- **Fix:**
  1. Ask the neighbor about the moon icon.
  2. Move the Wi-Fi Box to a normal outlet.
  3. Move the Game Console onto the timed plug.
- **Bonus:** moving the console onto the plug keeps the parent's bedtime rule working, which earns a big tip.
- **Tip Card:** "Ask before you replace anything."
- **Real basis:** a smart-plug schedule.

---

## Tier 3: Two Problems at Once

### 12. "The TV Keeps Switching by Itself"

- **Call:** "Every time I start the game console, the TV flips back to the cable channel!"
- **Player sees:** the purple auto-control lines from the Cable Box and the Game Console tug the TV back and forth.
- **What's wrong:** the Cable Box and the Game Console both try to control the TV.
- **Fix:**
  1. Unplug the devices one at a time to find the bossy one.
  2. Turn off Auto-control on the Cable Box only.
- **Order rule:** turning off Auto-control on the TV fixes this, but breaks the Sound Bar (see #6). That gives a smaller tip and a callback.
- **Tip Card:** "Turn off the troublemaker, not the whole house."
- **Real basis:** an HDMI-CEC conflict.

### 13. "Surround Sound Sounds Hollow"

- **Call:** "We set up surround sound and the voices sound hollow, and there's no deep bass."
- **Player sees:**
  - One front speaker's wires cross (red to black).
  - The subwoofer's orange line goes nowhere.
  - The Speaker Hub settings show "Subwoofer: None."
- **What's wrong:** one speaker is wired backwards, and the Speaker Hub doesn't know the subwoofer exists.
- **Fix:**
  1. Fix the wires (red to red).
  2. Set Subwoofer to "Yes."
  3. Run Auto Setup with the **Setup Mic** part.
- **Order rule:** running Auto Setup before fixing the wires saves bad settings, so you have to redo it.
- **Tip Card:** "Fix the hardware before you run the setup."
- **Real basis:** reversed speaker polarity, plus the subwoofer disabled in the AV receiver. Calibration order.

### 14. "Shows Buffer Every Evening"

- **Call:** "Shows are fine in the morning, but they keep loading-loading-loading every night!"
- **Player sees:**
  - The green line to the Streaming Stick is thin and wobbly.
  - The stick is tucked behind the metal TV.
  - At night, neighbors' Wi-Fi lines crowd the same lane.
- **What's wrong:** the stick is hidden behind the TV on the slow, crowded Wi-Fi lane.
- **Fix:**
  1. Use an **Extension Cable** to move the stick out from behind the TV.
  2. Switch it to the "Fast" Wi-Fi lane.
- **Tip Card:** "Get Wi-Fi gadgets out from behind the TV."
- **Real basis:** 2.4 GHz congestion and a metal TV back blocking the stick.

### 15. "TV Won't Turn On After the Storm"

- **Call:** "Since the power surge, the TV won't turn on. The little red light just blinks."
- **Player sees:** the TV's status light blinks. The wall outlet is fine. Test it with the lamp.
- **What's wrong:** the TV got "stuck" from the surge and needs a full reset.
- **Fix:**
  1. Unplug the TV.
  2. Hold its power button for 30 seconds.
  3. Wait.
  4. Plug it back in.
- **Order rule:** holding the button while it's still plugged in does nothing.
- **Bonus:** add a **Surge Protector** to prevent a callback on Night 3.
- **Tip Card:** "Stuck gadgets: unplug, hold power, wait."
- **Real basis:** a full power drain resets the TV's controller after a surge.

### 16. "Headphones Won't Connect"

- **Call:** "I got Grandpa wireless headphones for the TV so the rest of us can sleep, but they won't connect!"
- **Player sees:** the TV's wireless list shows "Patio Speaker (connected)," which is still plugged in out in the garage.
- **What's wrong:** the TV only connects one wireless sound device at a time, and the old patio speaker keeps grabbing it.
- **Fix:**
  1. Forget the Patio Speaker.
  2. Put the headphones in pairing mode.
  3. Connect them.
- **Order rule:** pairing the headphones first fails while the patio speaker is still connected.
- **Tip Card:** "Wireless sound: one at a time. Clear the old one first."
- **Real basis:** the TV supports a single Bluetooth audio sink.

---

## Tier 4: The Big Night

### 17. "Black Screen with an Error"

- **Call:** "The new streaming box just shows a black screen and an error. The cable box works fine!"
- **Player sees:**
  - The blue line from the Streaming Box to the Speaker Hub has a red ✗ "handshake failed."
  - Only some Speaker Hub sockets have a small ✓ "handshake" badge.
- **What's wrong:** the box is plugged into an old socket that can't do the handshake. The devices also have to wake up in the right order.
- **Fix:**
  1. Move the box to a socket with a ✓ badge.
  2. Turn everything off.
  3. Turn them on in this order: TV, then Speaker Hub, then Streaming Box.
- **Order rule:** turning on the Streaming Box first brings the error back.
- **Tip Card:** "Turn on the screen first, then work backward to the box."
- **Real basis:** HDCP 2.2 port support, and power-on order for the HDCP handshake.

### 18. "Game Console Screen Blinks Black"

- **Call:** "Every few minutes the kid's new console blinks to black for a second, then comes back."
- **Player sees:** the blue line flickers. The cable is labeled "Old Cable." The TV socket's "Turbo Mode" is off.
- **What's wrong:** the old cable can't carry the console's super-fast picture, and the TV socket isn't in Turbo Mode.
- **Fix:**
  1. Swap in a **Fast Cable** (gold label).
  2. Turn on Turbo Mode for that socket.
  3. Run the console's screen setup.
- **Order rule:** turning on Turbo Mode with the old cable makes the blinking constant.
- **Tip Card:** "Fast games need fast cables."
- **Real basis:** HDMI 2.1 4K/120 on an old cable, and the TV's Enhanced HDMI format.

### 19. "The PC Looks Gray and Foggy"

- **Call:** "My son hooked his computer to the big TV for family game night. Everything looks gray and foggy."
- **Player sees:**
  - Blacks look gray.
  - The computer's "Black Level" setting doesn't match the TV's.
  - "HDR" on the computer is on for no reason.
- **What's wrong:** the computer and the TV disagree about how dark black should be.
- **Fix:**
  1. Turn off HDR on the computer.
  2. Match the Black Level on the computer and the TV.
  3. Set Picture Mode to "Game."
- **Order rule:** turning up brightness or contrast instead makes dark scenes muddy, which costs time.
- **Tip Card:** "When colors look foggy, both ends must agree on Black Level."
- **Real basis:** RGB Full/Limited range mismatch, plus Windows HDR on for SDR content.

### 20. Finale: "The Festival Screen Looks Blurry"

- **Call:** "The town hall's big new TV looks blurry for the festival broadcast! The old projector's hooked up too."
- **Player sees:** a **Splitter** feeds both screens. Its setting "Match: Oldest Screen" squeezes the big TV's picture down to the projector's quality.
- **What's wrong:** the splitter makes both screens use the old projector's lower quality.
- **Fix:**
  1. Set the Splitter to "Match: Screen 1."
  2. Turn on "Shrink for Screen 2."
  3. Restart the Splitter.
  4. Restart the festival player.
- **Order rule:** setting the player to max quality by hand blacks out the projector, and the crowd groans.
- **Ending:** fixing it in time starts the festival broadcast. This is the game's ending.
- **Tip Card:** "A splitter can only please both screens if you tell it which one leads."
- **Real basis:** the HDMI splitter's EDID uses the lowest common display, and you fix it with EDID copy and downscaling.

---

## Design Notes

- **Linked faults:**
  - #6, #9 and #12 share the sound socket and Auto-control.
  - #7 and #14 share the Wi-Fi Box.
  - #5 and #15 can come back on Night 3 if their bonus was skipped. #12 comes back as "The Sound Bar Went Quiet" if the TV's Auto-control was left off. Callbacks are fixed for free.
  - Route order on the town map decides which callbacks happen.
- **Tip Cards stack:** later faults reuse earlier tips in new combinations. That's the real difficulty curve.
- **Real gadget menus aren't used.** All in-game menus are fictional, short and consistently worded.
