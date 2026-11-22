# Coin 10s implementation plan

1. Keep the bundled PixiJS 7.4.3 runtime and the ZEUS1 reel engine's ticker, pooled sprites, strip travel, acceleration, deceleration, contact cues, bounce, and clipping. Replace the bonus schedule with the three coin anticipation rules and enforce symbol/blank parity through the whole strip.
2. Fit the supplied square cabinet to both orientations over a full-viewport gray gradient. Reuse the mobile render profile, live editor, grid snapping, popup transitions, and draggable layout. Separate the four cabinet controls into their own sprites with editable press masks.
3. Use a single center payline. Keep outcomes, payout evaluation, and simulation in separate modules. Use the same weighted reel-stop rules in the game and the opt-in calculator.
4. Reuse the audio engine, local launcher, and debt rules. Add separate player volume controls, persistent credits and debt, and a local leaderboard. Embed Matcha Squishy and pixel-style win digits.
5. Verify the launch, center payline, blank stops, anticipation, win count-up, menus, editor, settings export, and save recovery in desktop and portrait layouts.
