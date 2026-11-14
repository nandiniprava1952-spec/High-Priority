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

## Updating
Edit files, then bump `VERSION` in `sw.js` (e.g. `mch-v2`) so installed apps pick up the change.

## Offline mode
Every topic and video has a **⬇ Save for offline** button (and day tabs have **Save all**). Saved PPTX/PDF/MP4 files are
stored on the phone (Cache API) and served by `sw.js`, so they open with no internet. Manage them in the **Offline** tab.
Cache names: `mch-offline-v1` (your saved files – kept across updates), `mch-v4` (app shell).
