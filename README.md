# ~/philip

Personal portfolio of Philip Pereira, Im a  BE Computer Science Engineering student at MIT World Peace University, Pune, work with LLMs   and have a small  interest with quant finance tool and have built a  sustainable IoT Device  in health hardware and machine learning. I am currently building a SAN navigation system for a DRDO project.

- **Email:** [philippereira2701@gmail.com](mailto:philippereira2701@gmail.com)
- **GitHub:** [@Phil27-gotchu](https://github.com/Phil27-gotchu)
- **LinkedIn:** [philip-pereira-a32146308](https://www.linkedin.com/in/philip-pereira-a32146308)

The site is a single static page (plain HTML, CSS and JavaScript, no build step or dependencies) that a swarm of multiplayer cursors builds in front of you as you scroll. 

## Credit

Both the site intro and the extension are a tribute to **[Swarm](https://califa.github.io/swarm-site/)** by **[Joel Califa](https://joelcalifa.com)** ([@califa](https://github.com/califa), [source](https://github.com/califa/swarm-site)), a website that builds itself as you scroll.



## The portfolio

### Run it

There's nothing to install. Open `index.html` in a browser, or serve the folder so it behaves like the deployed site:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static host works for deployment (GitHub Pages, Netlify, Cloudflare Pages, and so on): upload `index.html`, `style.css`, `script.js`, `desk.css`, `desk.js` and the `asset/` folder.

### What's on the page

- **Split-flap greeting.** The page opens on a departure-board style "IT'S PHILIP" screen. Click anywhere to skip it.
- **Swarm build.** Then up to eight named cursors (Ada, Linus, Grace, Dennis, Ken, Barbara, Alan, Margaret; five on narrow screens) drag out boxes and type the text of the whole page, from the nav bar down, building whatever is on screen as you scroll. If you jump ahead (say, with a nav link), the sections you skipped stay blank until you scroll back to them, and the cursors build them then. A HUD shows who's editing and the progress. Press **Esc** or **skip** to show everything at once.
- **Draggable desk.** The hero is a desk of sticky notes (an intro, "where i've been" and "things i'm good at"), a split-flap card that cycles through phrases, a polaroid of Philip, a "Philip 5.5" chat box that opens the terminal, a "see my work" ticket and four stickers (football, coffee, fedora hat, terminal). Everything on it can be dragged around (on screens wider than 900px), and **+ add a sticky note** lets visitors write their own notes.
- **LED name.** The hero name is drawn on a canvas as a dot-matrix LED sign (5×7 bitmap font, with faint unlit dots behind it). The dots rise into place when the swarm reaches it, lean toward your cursor like it's magnetic, and a ripple runs across them every few seconds.
- **About and skills.** Plain content sections. The about section ends with a "currently:" line.
- **Projects.** Cards for the **B&S Terminal** (a Bloomberg-style NASDAQ + BSE market and options terminal with implied vol, GARCH forecasts, Monte Carlo and a delta-hedge backtest; [repo](https://github.com/Phil27-gotchu/Black-and-Scholes-eqn-with-GBM-)) and the **jaundice screening probe** (an ESP8266 colour-sensor probe with a live dashboard, collecting a newborn dataset in a hospital; [repo](https://github.com/Phil27-gotchu/Jaundice_detection)). Links with an empty `href` are hidden.
- **Contact.** A row of word links: **email**, **github** and **linkedin**. Hovering one shows the full address, and a row with an empty `href` is hidden.
- **Options lab.** A live Black-Scholes pricer: drag spot, strike, volatility, days to expiry and the risk-free rate to see the price, delta, gamma, theta and vega, plus a chart of value today against payoff at expiry. Below it, a delta-hedging simulation sells the option and runs 500 random price paths, comparing hedged and unhedged P&L for daily, every-5-days or one-time rebalancing.
- **Terminal.** A working command line. Type `help` to list commands, including `whoami`, `projects`, `skills`, `contact`, `bs call 100 105 25 45` (price an option), `open <section>`, `theme <name>`, `rebuild` (run the swarm again) and `clear`, plus Fedora extras: `fastfetch` (or `neofetch`), `dnf install <pkg>`, `uname -a` and `cat /etc/os-release`. Up and down arrows recall history.
- **Themes.** Six color themes (paper, fedora, night, ocean, ink, grape) from the dots in the nav or the `theme` command, saved in `localStorage`.
- **Custom cursor.** A dot and trailing ring on devices with a mouse.

### Accessibility

- With **prefers-reduced-motion**, the greeting and the swarm don't run and the page appears immediately.
- If `script.js` fails to load, the content is un-hidden after 3 seconds instead of staying blank.
- There's a skip link, labelled controls, and live regions for the terminal and the hedging result.

### Editing content

All content is in `index.html`. Anything marked `data-build="text"`, `"box"`, `"chip"` or `"pixels"` is animated by the swarm. Untagged elements just appear. To change the big name, edit `data-text` on `#pixel-name` (letters, digits, `-` and `.` are supported).

One placeholder still needs real values: the third project card (`[project title]`, `[yyyy]`, `[short description of another project.]`, `[tag]` and its GitHub link). Fill it in, or delete that `<article class="card">` block if there's no third project yet.

## Swarm Rebuild (Chrome extension)

A Chrome extension that wipes any web page to a blank canvas and lets a swarm of multiplayer cursors build it back, live: crosshair-drawn boxes, typed text, pen-tool lines, ruler guides and ⌥-drag duplicates, until the page looks just like it did before.

### Install


1. Clone or download this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the [`swarm-rebuild/`](swarm-rebuild) folder.
4. Pin it (puzzle icon, then pin).

### Use

- Click the toolbar icon or press **Alt+Shift+S** on any page.
- The page fades out and the cursors orbit the site's favicon, then fan out and start building.
- **Scroll** and the swarm chases you, with more agents joining the faster you go.
- **Tour** auto-scrolls at the pace the swarm can keep up with. Good for screen recordings.
- **1× / 2× / 3×** changes build speed.
- **Sound** is on by default (🔊 in the toolbar, or press **M**). If the page hasn't been clicked yet, Chrome keeps audio locked and the button says **Tap for sound**; one click anywhere starts it.
- When it's done, the cursors flock to your mouse. **Go live** fades back to the real, clickable page; **Replay** builds it again.
- **Esc**, **✕**, or clicking the icon again exits at any time.

There's a self-contained test page in [`demo/index.html`](demo/index.html) (an inner-scrolling app shell with floats, forms, cards and media). Opening local files needs **Allow access to file URLs** enabled for the extension.

### How it works

1. **Snapshot.** [`swarm.js`](swarm-rebuild/swarm.js) walks the live DOM, including open shadow roots, and turns it into a blueprint:
   - boxes with fills, borders, radii, shadows, gradients, masks and backdrop blur become **rects**
   - text blocks become **text layers**, cloned with their computed styles (fonts, links, inline code, icons, `::before`/`::after`)
   - single-side borders and `<hr>` become **pen-tool lines**
   - `<img>`, `<svg>`, `<video>`, `<canvas>` and iframes become **media**. WebGL canvases, playing video and cross-origin iframes are cropped from a screenshot taken at click time while only those elements are visible.
   - repeated siblings (nav links, cards, list rows, logos) become one **master** plus **duplicates**
   - shared left edges and baselines become **ruler guides** that text snaps to
2. **Blank.** A full-viewport layer, isolated from the page's CSS in a shadow root, covers the page with its own background color. A quick hidden scroll pass first triggers lazy images and reveal-on-scroll content.
3. **Rebuild.** Each cursor runs a small generator script per task. Tasks unlock top-down as you scroll, children wait for their parent box, and duplicates wait for their master:
   - **rect / media:** crosshair drag with a live `W × H` badge and a gray placeholder, then the real fill fades in (images sweep top to bottom)
   - **text:** drag a text box, type with an I-beam and a blinking caret; big headings start at 18px and step up
   - **lines:** pen tool, anchor points, rubber band to the cursor
   - **guides:** Figma-style rulers slide in, a red guide is dragged out, and text snaps onto it
   - **duplicates:** select the master, ⌥-drag a copy with red spacing measurements, then retype its text, swap its image or restyle it
   - **swarm physics:** orbiting, alignment and mouse-avoiding flocking for the intro and the finale
4. **Sound.** Synthesized live with the Web Audio API (no audio files), mostly clicky, a little musical:
   - typing is a mechanical keyboard (a sharp click over a short thock, deeper on spaces), and every mouse press is a press-and-release click
   - guides snap with a crisp click, and growing headings tick up in pitch
   - boxes, images and duplicates add a sparse, quiet glass-piano note from the E major pentatonic, on an eighth-note grid: big sections play low, small things high, pitch rises left to right, and every sound is panned to its cursor
   - an airy swell as the page dissolves, a short arpeggio as the swarm fans out, a soft E major chord when the page is done, and a falling sweep for Go live

### Limits

- Chrome doesn't let extensions run on `chrome://` pages, the Web Store or the PDF viewer. The icon shows a red × there.
- It's a visual rebuild, not a clone. Animations freeze at the moment you click, decorative pseudo-elements are skipped when their position can't be worked out, and canvases, videos and iframes below the first screen become placeholders.
- Web components are rebuilt as plain styled elements, so none of the page's scripts run inside the swarm's layer.
- Very long pages are capped at about 4,000 layers / 40,000px.

### Publishing

`./scripts/package.sh` writes `dist/swarm-rebuild-<version>.zip` (currently 1.1.0, read from the manifest) for the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Listing text, permission justifications and assets are in [`store/`](store), and the privacy policy is [`PRIVACY.md`](PRIVACY.md).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The portfolio page and all of its content |
| `style.css` | Layout, themes and swarm-cursor styles |
| `script.js` | Split-flap greeting, LED dot-matrix name, swarm build, options lab, terminal, themes and custom cursor |
| `desk.css`, `desk.js` | The draggable desk hero: dragging, the split-flap card, the photo and chat box, and visitor sticky notes |
| `asset/` | Photos. `me.webp` (polaroid) and `philip-chat.webp` (chat box) are the web-sized copies the site uses; the large `.png` files are the originals |
| `_old-site/` | Backup of the previous, non-desk version of the site |
| `swarm-rebuild/manifest.json` | Extension manifest (V3); permissions are `activeTab` and `scripting` only |
| `swarm-rebuild/background.js` | Handles the toolbar click: takes the media-only screenshot, then injects `swarm.js` (or toggles it off) |
| `swarm-rebuild/swarm.js` | Snapshot, renderer and swarm engine, as one dependency-free content script |
| `demo/index.html` | Edge-case test page for the extension |
| `store/` | Chrome Web Store listing copy, screenshots and promo tiles |
| `scripts/package.sh` | Builds the zip to upload to the Web Store |
| `PRIVACY.md` | Privacy policy for the extension |

