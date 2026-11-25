const shelf = document.querySelector("#sleeves");
const gallery = document.querySelector("#gallery");
const cardTemplate = document.createElement("template");
cardTemplate.innerHTML = `<article class="publication">
      <a class="post-link">
        <img loading="lazy" decoding="async" alt="">
        <h2></h2>
        <p></p>
      </a>
      <details class="card-details">
        <summary aria-label="Idea details">•••</summary>
        <p><span class="card-category"></span><span class="creative-status" hidden></span></p>
      </details>
      <button class="bookmark" type="button" aria-pressed="false">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3.5h12v17L12 16l-6 4.5z"/></svg>
      </button>
    </article>`;

if (shelf) {
  for (const collection of collections) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const label = document.createElement("span");

    link.className = "sleeve";
    link.href = "category.html?id=" + encodeURIComponent(collection.id);
    link.dataset.cover = collection.id;
    link.style.backgroundImage = `url("assets/covers/${collection.id}.jpg")`;
    label.textContent = collection.name;

    link.append(label);
    item.append(link);
    shelf.append(item);
  }
  document.querySelector("#shelf-count").textContent = shelf.children.length + " collections";
  setUpShelfScroll();
}

function setUpShelfScroll() {
  const viewport = document.querySelector("#shelf-window");
  const controls = document.querySelector(".shelf-controls");
  const previous = document.querySelector("#previous");
  const next = document.querySelector("#next");

  function updateControls() {
    const end = viewport.scrollWidth - viewport.clientWidth;
    controls.hidden = end <= 2;
    previous.disabled = viewport.scrollLeft <= 2;
    next.disabled = viewport.scrollLeft >= end - 2;
  }

  function move(direction) {
    // Шаг равен ширине конверта вместе с промежутком.
    const items = shelf.children;
    const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : viewport.clientWidth;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollBy({ left: direction * step, behavior: reduceMotion ? "instant" : "smooth" });
  }

  previous.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  viewport.addEventListener("scroll", updateControls, { passive: true });
  new ResizeObserver(updateControls).observe(viewport);
  updateControls();
}

const params = new URLSearchParams(location.search);
const samplePosts = collections.flatMap(collection => collection.posts.map(post => ({
  id: post.image,
  category: collection.id,
  title: post.title,
  author: post.author || "In Progress Studio",
  creatorId: "in-progress-studio",
  allowContinuation: post.allowContinuation === true,
  description: post.note,
  date: post.date || "2026-11-23",
  tags: post.tags || [],
  status: post.status,
  images: [{ src: `assets/gallery/${post.image}.jpg`, bytes: post.bytes, logUrl: post.logUrl, width: post.width || 412, height: post.height || 412, alt: post.alt }]
}))).sort((a, b) => b.date.localeCompare(a.date));

let database;
function openDatabase() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open("in-progress-publications", 2);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (event.oldVersion < 1) db.createObjectStore("posts", { keyPath: "id" });
      db.createObjectStore("settings").add(crypto.randomUUID(), "creator");
    };
    request.onblocked = () => { document.querySelector("#notice").textContent = "Close older tabs of this site to finish updating local storage."; };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); database = undefined; };
      const identity = db.transaction("settings").objectStore("settings").get("creator");
      identity.onsuccess = () => { localCreatorId = identity.result; resolve(db); };
      identity.onerror = () => reject(identity.error);
    };
    request.onerror = () => { database = undefined; reject(request.error); };
  });
  return database;
}

async function readLocalPosts() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("posts").objectStore("posts").getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.date.localeCompare(a.date)));
    request.onerror = () => reject(request.error);
  });
}

async function savePost(post) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("posts", "readwrite");
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
    tx.objectStore("posts").add(post);
  });
}

function collectionUrl(id) {
  return "category.html?id=" + encodeURIComponent(id);
}

function postUrl(post) {
  return collectionUrl(post.category) + "&post=" + encodeURIComponent(post.id);
}

const pictureUrls = new WeakMap();
function fillImage(img, picture) {
  img.width = picture.width;
  img.height = picture.height;
  img.alt = picture.alt;
  if (!picture.src && !pictureUrls.has(picture)) pictureUrls.set(picture, URL.createObjectURL(picture.blob));
  img.src = picture.src || pictureUrls.get(picture);
}

function thumbnail(post) {
  const link = document.createElement("a");
  const image = document.createElement("img");
  link.href = postUrl(post);
  link.setAttribute("aria-label", post.title);
  image.loading = "lazy";
  fillImage(image, currentImages(post)[0]);
  link.append(image);
  return link;
}

async function showPublications() {
  const heading = document.querySelector("#collection-name");
  const description = document.querySelector("#collection-description");
  const setIntro = (name, text) => {
    heading.textContent = name;
    description.textContent = text;
    document.title = name + " — In Progress";
  };

  const collection = collections.find(item => item.id === params.get("id"));
  let localPosts = [];
  try { localPosts = await readLocalPosts(); }
  catch { document.querySelector("#notice").textContent = "Local storage is unavailable. Showing studio publications."; }
  const posts = [...localPosts, ...samplePosts];
  if (!shelf && params.get("view") === "upload") {
    gallery.hidden = true;
    const revise = params.has("revise");
    const continuation = params.has("continue");
    let source, version;
    if (revise || continuation) {
      source = posts.find(item => item.id === params.get(revise ? "revise" : "continue"));
      version = source && ideaVersions(source).find(item => item.id === params.get("version"));
      if (!version || (revise && continuation) || (revise ? !isOwned(source) : !source.allowContinuation)) {
        setIntro("Idea unavailable", "The source is unavailable or this action is closed.");
        return;
      }
    }
    document.body.classList.add("upload-view");
    setIntro(revise ? "Add version" : continuation ? "Continue this idea" : "Upload idea", "");
    setupUpload(source, version, revise, posts);
    return;
  }
  if (shelf) {
    setupWall(posts);
    return;
  }

  if (params.has("post")) {
    gallery.hidden = true;
    const post = posts.find(item => item.id === params.get("post") && item.category === collection?.id);
    if (!post) {
      setIntro("Idea not found", "Local ideas are available in the browser where they were published.");
      return;
    }
    setIntro(post.title, "");
    document.body.classList.add("detail-view");
    document.querySelector(".photo-info").prepend(heading.closest(".collection-intro"));
    document.querySelector("#detail-author").textContent = post.author;
    const bookmark = cardTemplate.content.querySelector(".bookmark").cloneNode(true);
    setupBookmark(bookmark, post);
    bookmark.append("Save to Collection");
    bookmark.setAttribute("aria-label", "Save to Collection");
    document.querySelector(".evolution-actions").prepend(bookmark);
    document.querySelector("#detail-description").textContent = post.description;
    document.querySelector("#detail").hidden = false;
    const back = document.querySelector("#back-collection");
    back.href = collectionUrl(post.category);
    back.textContent = "Back to " + collection.name;
    const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(post.date));
    document.querySelector("#credits").textContent = [collection.name, date, post.status].filter(Boolean).join(" · ");
    document.querySelector("#tags").textContent = post.tags.map(tag => "#" + tag).join("  ");
    setupEvolution(post, posts);
    return;
  }

  const all = params.get("view") === "all";
  if (!all && !collection) {
    setIntro("Collection not found", "Return to the shelf to choose a collection.");
    return;
  }
  if (all) {
    document.body.classList.add("wall-view");
    setIntro("All Ideas", "Unfinished thoughts, visual experiments, and everything in between.");
    document.querySelector(".wall-upload").hidden = false;
    setupWall(posts);
    return;
  }
  setIntro(collection.name, collection.about);
  const next = collections[(collections.indexOf(collection) + 1) % collections.length];
  const link = document.querySelector("#next-collection");
  link.textContent = "Next: " + next.name;
  link.href = collectionUrl(next.id);
  link.hidden = collections.length < 2;

  for (const post of posts.filter(item => item.category === collection.id)) {
    gallery.append(publicationCard(post));
  }
}

function fileSize(bytes) {
  if (bytes < 1000) return bytes + " B";
  if (bytes < 1e6) return (bytes / 1000).toFixed(1) + " kB";
  return (bytes / 1e6).toFixed(1) + " MB";
}

function setupPhotoViewer(pictures) {
  const plates = document.querySelector("#plates");
  const previous = document.querySelector("#previous-photo");
  const next = document.querySelector("#next-photo");
  const original = document.querySelector("#original-file");
  const log = document.querySelector("#log-file");
  const thumbs = document.querySelector("#photo-thumbs");
  thumbs.replaceChildren();
  thumbs.hidden = pictures.length < 2;
  if (!thumbs.hidden) pictures.forEach((picture, i) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.setAttribute("aria-label", "Show image " + (i + 1));
    const miniature = new Image();
    fillImage(miniature, picture);
    thumb.append(miniature);
    thumb.onclick = () => { index = i; showPhoto(); };
    thumbs.append(thumb);
  });
  let index = 0;

  function showPhoto() {
    const picture = pictures[index];
    const image = new Image();
    function showResolution(width, height) {
      plates.style.setProperty("--photo-ratio", width / height);
      const mp = Number((width * height / 1e6).toPrecision(2));
      document.querySelector("#photo-resolution").textContent = width + " × " + height + " px · " + mp + " MP";
    }
    showResolution(picture.width, picture.height);
    image.onload = () => {
      if (plates.contains(image)) showResolution(image.naturalWidth, image.naturalHeight);
    };
    fillImage(image, picture);
    const full = document.createElement("a");
    full.href = image.src;
    full.target = "_blank";
    full.rel = "noopener";
    full.setAttribute("aria-label", "Open full-size image");
    full.append(image);
    plates.replaceChildren(full);
    Array.from(thumbs.children).forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    original.href = image.src;
    if (picture.originalBlob) {
      if (!pictureUrls.has(picture.originalBlob)) pictureUrls.set(picture.originalBlob, URL.createObjectURL(picture.originalBlob));
      original.href = pictureUrls.get(picture.originalBlob);
    }
    const logUrl = /^https?:\/\//i.test(picture.logUrl || "") ? picture.logUrl : "";
    log.hidden = !logUrl;
    if (logUrl) log.href = logUrl;
    else log.removeAttribute("href");
    const type = picture.blob?.type || "image/jpeg";
    const download = document.querySelector("#download-file");
    download.href = image.src;
    download.download = picture.blob ? (picture.alt || "image").replace(/\.[^.]+$/, "") + "." + type.slice(6) : picture.src.split("/").pop();
    document.querySelector("#photo-format").textContent = type.replace("image/", "").toUpperCase();
    document.querySelector("#quality-row").hidden = !picture.quality;
    document.querySelector("#photo-quality").textContent = picture.quality || "";
    const bytes = picture.blob?.size ?? picture.bytes;
    document.querySelector("#size-row").hidden = !Number.isFinite(bytes);
    if (Number.isFinite(bytes)) {
      const size = document.querySelector("#photo-size");
      size.textContent = fileSize(bytes);
      size.title = bytes.toLocaleString("en") + " bytes";
    }
    document.querySelector("#photo-position").textContent = (index + 1) + " / " + pictures.length;
    previous.disabled = index === 0;
    next.disabled = index === pictures.length - 1;
  }
  previous.onclick = () => { index--; showPhoto(); };
  next.onclick = () => { index++; showPhoto(); };
  document.querySelector(".photo-switch").hidden = pictures.length < 2;
  showPhoto();
}

function publicationCard(post) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector(".post-link").href = postUrl(post);
  fillImage(card.querySelector("img"), currentImages(post)[0]);
  card.querySelector("h2").textContent = post.title;
  const group = collections.find(group => group.id === post.category);
  card.querySelector(".post-link p").textContent = post.author;
  card.querySelector(".card-category").textContent = group?.name || "";
  card.querySelector("summary").setAttribute("aria-label", "Details for " + post.title);
  if (post.status) {
    const status = card.querySelector(".creative-status");
    status.textContent = post.status;
    status.hidden = false;
  }
  setupBookmark(card.querySelector(".bookmark"), post);
  return card;
}

function setupBookmark(button, post) {
  const key = "in-progress:bookmark:" + post.category + "/" + post.id;
  button.setAttribute("aria-label", "Bookmark " + post.title);
  try {
    button.setAttribute("aria-pressed", String(localStorage.getItem(key) === "1"));
    button.onclick = () => {
      try {
        const save = localStorage.getItem(key) !== "1";
        if (save) localStorage.setItem(key, "1");
        else localStorage.removeItem(key);
        button.setAttribute("aria-pressed", String(save));
      } catch { document.querySelector("#notice").textContent = "Bookmarks could not be saved in this browser."; }
    };
    button.dataset.key = key;
  } catch { button.disabled = true; button.title = "Browser storage is unavailable"; }
}

window.addEventListener("storage", event => {
  document.querySelectorAll(".bookmark").forEach(button => {
    if (event.key === null || event.key === button.dataset.key) {
      button.setAttribute("aria-pressed", String(event.newValue === "1"));
    }
  });
});

// Place cards in reading order, always using the shortest column.
function layoutWall() {
  const cards = Array.from(gallery.children);
  const sizes = cards.map(card => card.getBoundingClientRect().height);
  const css = getComputedStyle(gallery);
  const columns = Number(css.getPropertyValue("--wall-columns"));
  const gap = parseFloat(css.columnGap);
  const step = (gallery.clientWidth + gap) / columns;
  const heights = Array(columns).fill(0);
  cards.forEach((card, index) => {
    const column = heights.indexOf(Math.min(...heights));
    card.style.left = column * step + "px";
    card.style.top = heights[column] + "px";
    heights[column] += sizes[index] + gap;
  });
  gallery.style.height = Math.max(...heights) + "px";
}

function setupWall(posts) {
  gallery.insertAdjacentHTML("beforebegin", `
    <section id="wall-tools" aria-label="Browse publications" hidden>
      <div class="filter-bar">
        <label class="search-box">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/></svg>
          <input id="idea-search" type="search" aria-label="Search ideas" placeholder="Search ideas…">
        </label>
        <details class="filter-drawer" open>
          <summary>Collections</summary>
          <div id="category-index" role="group" aria-label="Filter by category"></div>
        </details>
      </div>
      <div class="wall-summary">
        <span id="result-count" role="status"></span>
        <select id="idea-sort" aria-label="Sort publications">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
    </section>
    <section id="featured" aria-labelledby="feature-title" hidden>
      <a class="feature-image" tabindex="-1" aria-hidden="true"><img alt=""></a>
      <div class="feature-copy">
        <p class="feature-kicker">Featured / 001</p>
        <h2 id="feature-title"></h2>
        <p class="feature-credit"></p>
        <div class="feature-actions">
          <a class="feature-link">View idea <span aria-hidden="true">↗</span></a>
          <details class="feature-note"><summary>Studio note</summary><p class="feature-description"></p></details>
        </div>
      </div>
    </section>
    <section id="wall-empty" hidden>
      <h2></h2><p></p>
      <button type="button" id="reset-wall">Clear filters</button>
    </section>
  `);
  const search = document.querySelector("#idea-search");
  const chips = document.querySelector("#category-index");
  const drawer = document.querySelector(".filter-drawer");
  const compact = matchMedia("(max-width: 48rem)");
  const fitFilters = () => { drawer.open = !compact.matches; };
  fitFilters();
  compact.addEventListener("change", fitFilters);
  const sort = document.querySelector("#idea-sort");
  const empty = document.querySelector("#wall-empty");
  const reset = document.querySelector("#reset-wall");
  const feature = document.querySelector("#featured");
  document.querySelector("#wall-tools").hidden = false;
  const pick = posts.find(post => post.id === "alpine-hour") || posts[0];
  if (pick) {
    feature.querySelectorAll("a").forEach(link => link.href = postUrl(pick));
    fillImage(feature.querySelector("img"), currentImages(pick)[0]);
    feature.querySelector("h2").textContent = pick.title;
    feature.querySelector(".feature-credit").textContent = pick.author;
    feature.querySelector(".feature-description").textContent = pick.description;
    feature.querySelector(".feature-note").hidden = !pick.description;
  }

  let category = "";
  for (const group of [{ id: "", name: "All" }, ...collections]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = group.name;
    button.dataset.id = group.id;
    button.onclick = () => {
      category = group.id;
      if (compact.matches) {
        drawer.open = false;
        drawer.querySelector("summary").focus();
      }
      render();
    };
    chips.append(button);
  }
  const resize = new ResizeObserver(layoutWall);
  function render() {
    const query = search.value.trim().toLowerCase();
    const matches = posts.filter(post => {
      const text = [post.title, post.description, ...(post.tags || [])].join(" ").toLowerCase();
      return (!category || post.category === category) && text.includes(query);
    }).sort((a, b) => sort.value === "oldest"
      ? Date.parse(a.date) - Date.parse(b.date)
      : Date.parse(b.date) - Date.parse(a.date));
    for (const button of chips.children) button.setAttribute("aria-pressed", String(button.dataset.id === category));
    drawer.querySelector("summary").textContent = collections.find(group => group.id === category)?.name || "Collections";
    feature.hidden = !pick || Boolean(category || query);
    document.querySelector("#result-count").textContent = matches.length + (matches.length === 1 ? " idea" : " ideas");
    empty.hidden = matches.length > 0;
    empty.querySelector("h2").textContent = posts.length ? "No matching ideas" : "The shelf is open";
    empty.querySelector("p").textContent = posts.length ? "Try another search or collection." : "Upload the first idea to start the collection.";
    reset.hidden = !posts.length;
    resize.disconnect();
    gallery.replaceChildren(...matches.map(publicationCard));
    layoutWall();
    for (const card of gallery.children) resize.observe(card);
    resize.observe(gallery);
  }
  search.addEventListener("input", render);
  sort.addEventListener("change", render);
  reset.onclick = () => { category = ""; search.value = ""; render(); search.focus(); };
  render();
}

function setupPhotoSettings(tile, picture, sourceImage, updateSubmit) {
  const file = picture.blob;
  const longest = Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight);
  const edge = tile.querySelector(".export-edge");
  const format = tile.querySelector(".export-format");
  const quality = tile.querySelector(".export-quality");
  const info = tile.querySelector(".export-info");
  const preview = tile.querySelector("img");
  const formats = ["image/jpeg", "image/png", "image/webp"];
  edge.max = longest;
  edge.placeholder = "Original · " + longest;
  tile.querySelector(".upload-filename").textContent = file.name;
  format.add(new Option("Original · " + file.type.slice(6).toUpperCase(), file.type));
  for (const type of formats.filter(type => type !== file.type)) format.add(new Option(type.slice(6).toUpperCase(), type));
  let generation = 0;
  let previewUrl;

  async function update() {
    const current = ++generation;
    const type = format.value;
    edge.disabled = !formats.includes(type);
    quality.disabled = type !== "image/jpeg" && type !== "image/webp";
    quality.options[0].textContent = quality.disabled ? (type === "image/png" ? "Lossless" : "Original") : "Auto";
    if (quality.disabled) quality.value = "";
    const limit = edge.disabled || !edge.value ? longest : edge.valueAsNumber;
    const selectedQuality = quality.disabled ? "" : quality.value;
    const keepFile = type === file.type && limit === longest && !selectedQuality;
    const note = tile.querySelector(".export-note");
    note.textContent = edge.disabled ? "Choose another format to resize this image." :
      keepFile ? "Original file preserved." : "Exports a still image. The original stays available.";
    if (!edge.disabled && !edge.validity.valid) {
      info.textContent = "Enter a whole number from 1 to " + longest + " px.";
      tile.dataset.state = "invalid";
      updateSubmit();
      return;
    }
    tile.dataset.state = "working";
    updateSubmit();
    try {
      const width = Math.max(1, Math.round(sourceImage.naturalWidth * limit / longest));
      const height = Math.max(1, Math.round(sourceImage.naturalHeight * limit / longest));
      let blob = file;
      let setting = "Original file";
      if (!keepFile) {
        info.textContent = "Preparing preview…";
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (type === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sourceImage, 0, 0, width, height);
        const factor = Number(selectedQuality || 0.85);
        blob = await new Promise(resolve => canvas.toBlob(resolve, type, factor));
        if (!blob || blob.type !== type) throw new Error("Unsupported export");
        setting = type === "image/png" ? "Lossless" : Math.round(factor * 100) + "%";
      }
      if (current !== generation || !tile.isConnected) return;
      Object.assign(picture, { blob, width, height, quality: setting });
      if (keepFile) delete picture.originalBlob;
      else picture.originalBlob = file;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = keepFile ? null : URL.createObjectURL(blob);
      preview.src = previewUrl || sourceImage.src;
      info.textContent = [width + " × " + height + " px", type.slice(6).toUpperCase(), fileSize(blob.size), setting].join(" · ");
      tile.dataset.state = "ready";
    } catch {
      if (current !== generation || !tile.isConnected) return;
      info.textContent = "Could not export this image. Try a smaller size or the original settings.";
      tile.dataset.state = "invalid";
    }
    updateSubmit();
  }
  edge.oninput = update;
  format.onchange = update;
  quality.onchange = update;
  update();
  return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
}

function setupUpload(sourcePost, sourceVersion, revise, posts) {
  const form = document.querySelector("#idea-form");
  const fields = form.elements;
  const previews = document.querySelector("#previews");
  const message = document.querySelector("#form-message");
  const submit = form.querySelector("button[type=submit]");
  form.hidden = false;
  document.querySelector("#inspiration").hidden = Boolean(sourcePost);
  for (const id of ["alpine-hour", "concrete-arc", "linen-field", "sea-line"]) {
    const post = samplePosts.find(item => item.id === id);
    if (post) document.querySelector(".moodboard").append(thumbnail(post));
  }
  for (const category of collections) {
    fields.category.add(new Option(category.name, category.id));
  }
  fields.category.value = "photo";
  if (!sourcePost) {
    const chooser = document.querySelector("#choose-source");
    const select = chooser.querySelector("select");
    const openIdeas = posts.filter(post => post.allowContinuation);
    chooser.hidden = !openIdeas.length;
    for (const post of openIdeas) select.add(new Option(post.title + " · " + post.author, post.id));
    select.onchange = () => {
      sourcePost = openIdeas.find(post => post.id === select.value);
      const preview = document.querySelector("#source-preview");
      preview.hidden = !sourcePost;
      submit.textContent = sourcePost ? "Publish continuation" : "Publish idea";
      if (sourcePost) {
        sourceVersion = ideaVersions(sourcePost).at(-1);
        sourceCaption(preview, sourcePost, sourceVersion);
      }
    };
  }
  if (sourcePost) {
    sourceCaption(document.querySelector("#source-preview"), sourcePost, sourceVersion);
    fields.category.value = sourcePost.category;
    submit.textContent = revise ? "Save version" : "Publish continuation";
    fields.description.maxLength = 400;
    fields.description.closest("label").firstChild.textContent = "Change note (optional)";
    fields.title.closest("label").before(fields.description.closest("label"));
    if (revise) {
      fields.title.closest("label").hidden = true;
      fields.category.closest("label").hidden = true;
      form.querySelectorAll(".optional-fields").forEach(group => { group.hidden = true; });
    }
  }

  const pictures = [];
  let pending = 0;
  function updateSubmit() {
    submit.disabled = pending > 0 || Boolean(previews.querySelector('figure:not([data-state="ready"])'));
  }
  async function addFiles(files) {
    pending++;
    submit.disabled = true;
    message.textContent = "";
    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.type)) {
        message.textContent = "Choose a JPG, PNG, WebP, GIF or AVIF image.";
        continue;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
        const picture = { blob: file, width: img.naturalWidth, height: img.naturalHeight, alt: file.name };
        pictures.push(picture);
        if (pictures.length === 1 && !fields.title.value.trim()) {
          fields.title.value = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 140);
        }
        const tile = document.createElement("figure");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", "Remove " + file.name);
        remove.onclick = () => {
          pictures.splice(pictures.indexOf(picture), 1);
          tile.remove();
          releasePreview();
          URL.revokeObjectURL(url);
          updateSubmit();
        };
        img.alt = file.name;
        const source = document.querySelector("#log-source-field").content.cloneNode(true);
        const sourceUrl = source.querySelector("input");
        sourceUrl.setAttribute("aria-label", "Log source URL for " + file.name);
        sourceUrl.oninput = () => { picture.logUrl = sourceUrl.value.trim(); };
        const controls = document.querySelector("#photo-settings").content.cloneNode(true);
        controls.querySelector("figcaption").append(source);
        tile.append(img.cloneNode(), remove, controls);
        previews.append(tile);
        const releasePreview = setupPhotoSettings(tile, picture, img, updateSubmit);
      } catch {
        URL.revokeObjectURL(url);
        message.textContent = "Could not read " + file.name + ". Try a different image.";
      }
    }
    pending--;
    updateSubmit();
  }

  fields.files.onchange = () => {
    addFiles(Array.from(fields.files.files));
    fields.files.value = "";
  };
  const drop = form.querySelector(".drop-area");
  drop.ondragover = event => { event.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = event => {
    event.preventDefault();
    drop.classList.remove("over");
    addFiles(Array.from(event.dataTransfer.files));
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const title = fields.title.value.trim() || "Untitled study";
    const author = fields.author.value.trim() || "Anonymous";
    const description = fields.description.value.trim();
    if (!pictures.length) {
      message.textContent = "Choose an image to publish.";
      return;
    }
    submit.disabled = true;
    form.inert = true;
    try {
      if (revise) {
        const version = { id: crypto.randomUUID(), date: new Date().toISOString(), note: description, images: pictures.slice() };
        await editOwnedIdea(sourcePost.id, saved => {
          (saved.revisions ||= []).push(version);
        });
        location.assign(versionUrl(sourcePost, version));
        return;
      }
      const post = {
        id: crypto.randomUUID(), title, author, description,
        creatorId: localCreatorId,
        allowContinuation: fields.allowContinuation.checked,
        category: fields.category.value,
        status: fields.status.value,
        date: new Date().toISOString(),
        tags: fields.tags.value.split(",").map(tag => tag.trim()).filter(Boolean),
        images: pictures.slice()
      };
      if (sourcePost) await saveContinuation(post, sourcePost.id, sourceVersion.id);
      else await savePost(post);
      location.assign(sourcePost ? postUrl(post) : collectionUrl(post.category));
    } catch (error) {
      message.textContent = error instanceof IdeaError ? error.message : "Could not save in this browser. Check available storage and try again.";
      form.inert = false;
      updateSubmit();
    }
  };
}

if (gallery) {
  showPublications();
  window.addEventListener("pageshow", event => {
    if (event.persisted && params.get("view") !== "upload") location.reload();
  });
}

// A falling pitch gives the sleeve a short, rounded pop.
let audio;
let soundOn = true;
try { soundOn = localStorage.getItem("shelf-sound") !== "off"; } catch {}
const soundButton = document.querySelector(".sound");

function showSoundState() {
  const needsGesture = shelf && soundOn && navigator.userActivation && !navigator.userActivation.hasBeenActive;
  soundButton.textContent = needsGesture ? "Enable sound" : soundOn ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", String(soundOn));
}

function rustle() {
  try {
    audio ??= new AudioContext();
    audio.resume().catch(() => {});
    const now = audio.currentTime;
    const source = audio.createOscillator();
    source.type = "triangle";
    source.frequency.setValueAtTime(540, now);
    source.frequency.exponentialRampToValueAtTime(155, now + .055);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.17, now + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .082);
    source.connect(gain).connect(audio.destination);
    source.start(now);
    source.stop(now + .085);
    return true;
  } catch { return false; }
}

showSoundState();
soundButton.addEventListener("click", () => {
  soundOn = soundButton.textContent === "Enable sound" || !soundOn;
  try { localStorage.setItem("shelf-sound", soundOn ? "on" : "off"); } catch {}
  showSoundState();
  if (soundOn) rustle();
});

if (shelf) {
  // Unlock audio on the first gesture; never queue earlier hover sounds.
  function unlock(event) {
    if (event.target.closest(".sound") || !soundOn) return;
    try {
      audio ??= new AudioContext();
      if (audio.state !== "running") audio.resume().catch(() => {});
    } catch {}
    showSoundState();
  }
  document.addEventListener("click", unlock);
  document.addEventListener("keydown", unlock);

  for (const sleeve of shelf.querySelectorAll(".sleeve")) {
    function lift() {
      if (soundOn && (audio?.state === "running" || navigator.userActivation?.hasBeenActive)) rustle();
    }
    sleeve.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse" && !sleeve.matches(":focus-visible")) lift();
    });
    sleeve.addEventListener("focus", () => {
      if (sleeve.matches(":focus-visible") && !sleeve.matches(":hover")) lift();
    });
    sleeve.addEventListener("pointerdown", event => {
      if (event.pointerType !== "mouse") lift();
    });
  }
}

let travel;
document.addEventListener("click", event => {
  const link = event.target.closest(".sleeve, #next-collection, .collection-bar a");
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const needsClickSound = !link.matches(".sleeve") || !audio || audio.state !== "running";
  if (soundOn && (needsClickSound ? rustle() : true)) {
    event.preventDefault();
    clearTimeout(travel);
    travel = setTimeout(() => location.assign(link.href), 135);
  }
});
