# iPhone reminder: set up the "CPT Clock Reminder" Shortcut (one time, on your Mac)

Chrome can't set an alarm on your iPhone directly. Instead, CPT Clock opens a **Shortcut on your Mac**.
The Shortcut creates a timed **Reminder** in iCloud, which syncs to your iPhone and alerts you there,
even if your Mac is asleep by then.

## Build the Shortcut

1. Open the **Shortcuts** app on your Mac and click **+** to make a new shortcut.
2. Name it exactly **`CPT Clock Reminder`**. If you use another name, enter it in CPT Clock's Settings.
3. Click the **ⓘ** (Shortcut Details) button and turn on **Use as Quick Action** → *Receive* **Text**.
   This lets the shortcut accept the clock-out time as input.
4. Add these actions in order:
   1. **Get Dates from Input**, with input set to *Shortcut Input*.
   2. **Adjust Date**: *Subtract* `5` *minutes* from *Dates*. This step is optional; it rings 5 min early.
   3. **Add New Reminder**:
      - Title: `Clock out (CPT)`
      - List: any **iCloud** list (not "On My Mac")
      - Tap *Show More* → turn on **Remind Me** → *At Time* → pick the **Adjusted Date** variable.
5. Test it: open Terminal and run
   ```sh
   shortcuts run "CPT Clock Reminder" <<< "$(date -v+2M '+%B %-d, %Y at %-I:%M %p')"
   ```
   A reminder due in 2 minutes should show up on your iPhone.

## Use it

- Clock in (on Workday/ADP/UKG, or with the extension's **Clock in** button), then click **Send to iPhone**
  in the CPT Clock popup.
- The first time, Chrome asks *"Open Shortcuts.app?"*. Tick **Always allow** and click **Open**.
- Want this to happen automatically? Turn on **Send to iPhone automatically when I clock in** in Settings.

## Tips

- On the iPhone, make sure **Settings → Notifications → Reminders** allows alerts and sounds, and consider letting it through Focus modes.
- If you edit your shifts after sending, click **Send to iPhone** again. The old reminder stays, so delete it.
- Why not a real Clock alarm? The Mac version of Shortcuts has no "Create Alarm" action, and Apple doesn't let
  browsers set alarms. A native iPhone app could do this later.
