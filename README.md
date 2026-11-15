# MCH Training Hub (PWA)

Installable web app built from the `mch_section_viewer_kobo` form: 32 training topics across 3 days,
PPTX/PDF links and a video gallery. Cover photo: `assets/cover.jpg`. App icon: `icons/`.

## Deploy on GitHub Pages
1. Create a repo (or use `High-Priority`) and upload **all files in this folder** to the root of `main`
   (keep the `.github` and `.nojekyll` files).
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push (or run the "Deploy PWA to GitHub Pages" action). Your app opens at
   `https://<user>.github.io/<repo>/`.
4. Open it on a phone: Chrome shows **Install app**; on iPhone use Share → Add to Home Screen.

## Where the content comes from
`data.js` holds the topics. Files (A1.png, A1.pdf, A1.pptx, videos…) are loaded from
`https://raw.githubusercontent.com/nandiniprava1952-spec/High-Priority/main/` (the `base` value at the top of `data.js`).
Change `base` if you move the files. Cover images load online and are cached as they are viewed;
PDFs, PPTX and videos always need internet.

## How updates reach users
The app checks for a new version when it opens, when the user comes back to it, and every 30 minutes
(logic in `update-kit.js`, which is the same file in all three apps).

1. **Update found** - a card appears at the top with a progress ring and percentage, "Downloading update…".
2. **Update ready** - at 100% it becomes "Update available" with **Update** and **Later**. *Later* hides the card until the next check.
3. **Installing** - *Update* shows a spinning ring, "Installing update…", then the app restarts on its own.
4. **After the restart** - "✔ Updated to the latest version".

**To release an update:** change your files, then bump the version name at the top of `sw.js` (`VERSION`, e.g. `mch-v10`).
That is the only thing phones look at. `update-kit.js` must stay listed in the file list at the top of `sw.js`.

## Offline mode
Every topic and video has a **⬇** button. Saved PPTX/PDF/MP4 files are
stored on the phone (Cache API) and served by `sw.js`, so they open with no internet. The **⬇** button in the top bar (next to Home) saves everything at once; when everything is already saved it opens the Offline page, where saved items can be removed.
Cache names: `mch-offline-v1` (your saved files – kept across updates), `mch-vN` (app shell, replaced on each update).
