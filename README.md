# Coin 10s

## Play locally

Extract the ZIP before launching. On Windows, double-click **START-GAME.bat**. On macOS, run **START-GAME.command**, or run `python3 server.py` in this folder on macOS or Linux. If the browser does not open automatically, visit `http://127.0.0.1:8710/`. The Windows launcher includes a PowerShell fallback when Python is unavailable.

Wait for the Play prompt on the title screen, then click or tap anywhere to zoom into the game. Space and Enter also spin once the game has started. Bets run from 10 to 100 credits in steps of 10. Wins use the three center stops. A blank anywhere on that line pays zero. The paytable shows credits at the current bet.

The leaderboard records local cash-outs. Credits, bets, debt and scores are stored by browser and site. The game starts with 1,000 credits. Once eligible, cashing out records that score and starts a new 1,000-credit balance. The reference thresholds are 10,000 credits, or 5,000 after borrowing and repaying all debt. The debt period is 30 days.

## Tune the game

Open **EDITOR** or press **E**. Choose an element to see its sliders and precise numeric fields. Drag the cabinet, buttons, and credit displays. Each cyan shape is a button press mask. Drag its edge, or select the corresponding press mask and drag anywhere inside it. Adjust the mask shape and the button's press motion independently. When you move a button, its mask follows and keeps its offset.

Use **Test spin** to play a selected outcome with the real reel motion and effects. The test spin, popup previews and effect previews leave your balance alone. **RTP calculator** shows exact RTP immediately and samples up to 20 million spins using the same payout probabilities. In **Reels, spacing + blank chance**, set the percentage chance of an empty center stop per reel. The default is 50%. Coin weights set the relative likelihood of each coin type whenever a reel lands on a coin.

In **Audio levels and timing**, use **Preview sound** to hear the landing sounds, mixed line win count-up, and bonus bell. A Big Win or Jackpot counts up for 10 seconds. Click or tap to finish the count early, then click or tap again to claim. In **Big Win / Jackpot shake**, adjust the horizontal and vertical movement, rotation, frequency, and decay. Turn off **Sync to bell** to set a fixed shake duration. Both count-up tracks follow the SFX toggle and volume. To replace them, swap `assets/audio/big-win-music.mp3` and `assets/audio/jackpot-music.mp3`.

**Save** keeps the current editor settings in this browser. **Export** downloads `current-settings.json`. Replace the copy beside `index.html` to distribute your settings. **Import** loads a saved JSON into the editor. **Defaults** restores the settings from the game folder. Use **Save** after restoring defaults if you want them to take precedence over an earlier browser save.

## Prepare an itch.io build

Zip the contents of this folder so `index.html` sits at the root. Keep the `js`, `assets`, and `vendor` folders beside it. The game has no CDN dependencies. Set `data-editor="off"` in `index.html` to disable the editor for a public build. The local server serves files with no-cache headers, and the browser loader adds a fresh query string to runtime resources on each load.

The first ZIP is a complete build. Future replacement-only updates can preserve these same relative paths so you can copy them into your existing game.
