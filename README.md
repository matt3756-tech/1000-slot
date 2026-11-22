# Coin 10s

## Play locally

Extract the ZIP before launching. On Windows, double-click **START-GAME.bat**. On macOS, run **START-GAME.command**, or run `python3 server.py` in this folder on macOS or Linux. If the browser does not open automatically, visit `http://127.0.0.1:8710/`. The Windows launcher includes a PowerShell fallback when Python is unavailable.

Wait for the Play prompt, then click or tap anywhere. Space and Enter also spin once the game has started. Bets run from 10 to 100 credits in steps of 10. Wins use the three center stops. A blank anywhere on that line pays zero. The paytable shows credits at the current bet.

The leaderboard records local cash-outs. Credits, bets, debt and scores are stored by browser and site. The game starts with 1,000 credits. Once eligible, cashing out records that score and starts a new 1,000-credit balance. The reference thresholds are 10,000 credits, or 5,000 after borrowing and repaying all debt. The debt period is 30 days.

## Tune the game

Open **EDITOR** or press **E**. Choose an element to see its sliders and precise numeric fields. Drag the cabinet, buttons, and credit displays. Each cyan shape is a button press mask. Drag its edge, or select the corresponding press mask and drag anywhere inside it. Adjust the mask shape and the button's press motion independently. When you move a button, its mask follows and keeps its offset.

Use **Test spin** to play a selected outcome with the real reel motion and effects. The test spin, popup previews and effect previews leave your balance alone. **RTP calculator** runs on demand, using the same payout rules and per-stop weights as the game. Every reel alternates coins and blanks, so weights set the relative likelihood of the three coin types within the coin stops.

**Save** keeps the current editor settings in this browser. **Export** downloads `current-settings.json`. Replace the copy beside `index.html` to distribute your settings. **Import** loads a saved JSON into the editor. **Defaults** restores the settings from the game folder. Use **Save** after restoring defaults if you want them to take precedence over an earlier browser save.

## Prepare an itch.io build

Zip the contents of this folder so `index.html` sits at the root. Keep the `js`, `assets`, and `vendor` folders beside it. The game has no CDN dependencies. Set `data-editor="off"` in `index.html` to disable the editor for a public build. The local server serves files with no-cache headers, and the browser loader adds a fresh query string to runtime resources on each load.

The first ZIP is a complete build. Future replacement-only updates can preserve these same relative paths so you can copy them into your existing game.
