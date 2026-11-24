const shelf = document.querySelector("#sleeves");
const gallery = document.querySelector("#gallery");

if (shelf) {
  document.querySelector("#shelf-count").textContent = collections.length + " collections";
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
  author: "In Progress Studio",
  description: post.note,
  date: post.date || "2026-11-23",
  tags: [],
  images: [{ src: `assets/gallery/${post.image}.jpg`, width: post.width || 412, height: post.height || 412, alt: post.alt }]
}))).sort((a, b) => b.date.localeCompare(a.date));

let database;
function openDatabase() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open("in-progress-publications", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("posts", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

function fillImage(img, picture) {
  img.width = picture.width;
  img.height = picture.height;
  img.alt = picture.alt;
  img.src = picture.src || URL.createObjectURL(picture.blob);
}

function thumbnail(post) {
  const link = document.createElement("a");
  const image = document.createElement("img");
  link.href = postUrl(post);
  link.setAttribute("aria-label", post.title);
  image.loading = "lazy";
  fillImage(image, post.images[0]);
  link.append(image);
  return link;
}

async function showRecent() {
  let local = [];
  try { local = await readLocalPosts(); } catch {}
  for (const post of [...local, ...samplePosts].slice(0, 4)) {
    const link = thumbnail(post);
    const title = document.createElement("strong");
    title.textContent = post.title;
    link.append(title);
    document.querySelector("#recent-ideas").append(link);
  }
}
if (shelf) showRecent();

async function showPublications() {
  const heading = document.querySelector("#collection-name");
  const description = document.querySelector("#collection-description");
  const setIntro = (name, text) => {
    heading.textContent = name;
    description.textContent = text;
    document.title = name + " — In Progress";
  };

  if (params.get("view") === "upload") {
    document.body.classList.add("upload-view");
    setIntro("Upload idea", "Saved in this browser profile, on this site.");
    gallery.hidden = true;
    setupUpload();
    return;
  }

  const collection = collections.find(item => item.id === params.get("id"));
  let localPosts = [];
  try { localPosts = await readLocalPosts(); }
  catch { document.querySelector("#notice").textContent = "Local storage is unavailable. Showing studio publications."; }
  const posts = [...localPosts, ...samplePosts];

  if (params.has("post")) {
    gallery.hidden = true;
    const post = posts.find(item => item.id === params.get("post") && item.category === collection?.id);
    if (!post) {
      setIntro("Idea not found", "Local ideas are available in the browser where they were published.");
      return;
    }
    setIntro(post.title, post.description);
    document.querySelector("#detail").hidden = false;
    const back = document.querySelector("#back-collection");
    back.href = collectionUrl(post.category);
    back.textContent = "Back to " + collection.name;
    const date = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(post.date));
    document.querySelector("#credits").textContent = [post.author, collection.name, date].join(" · ");
    document.querySelector("#tags").textContent = post.tags.map(tag => "#" + tag).join("  ");
    for (const picture of post.images) {
      const img = document.createElement("img");
      img.loading = "lazy";
      fillImage(img, picture);
      document.querySelector("#plates").append(img);
    }
    return;
  }

  const all = params.get("view") === "all";
  if (!all && !collection) {
    setIntro("Collection not found", "Return to the shelf to choose a collection.");
    return;
  }
  if (all) {
    document.body.classList.add("wall-view");
    setIntro("All ideas", "");
    const index = document.querySelector("#category-index");
    index.hidden = false;
    for (const group of collections) {
      const link = document.createElement("a");
      link.href = collectionUrl(group.id);
      link.textContent = group.name;
      index.append(link);
    }
  }
  else {
    setIntro(collection.name, collection.about);
    const next = collections[(collections.indexOf(collection) + 1) % collections.length];
    const link = document.querySelector("#next-collection");
    link.textContent = "Next: " + next.name;
    link.href = collectionUrl(next.id);
    link.hidden = collections.length < 2;
  }

  const template = document.querySelector("#publication");
  for (const post of posts.filter(item => all || item.category === collection.id)) {
    const card = template.content.cloneNode(true);
    card.querySelector("a").href = postUrl(post);
    fillImage(card.querySelector("img"), post.images[0]);
    card.querySelector("h2").textContent = post.title;
    card.querySelector("p").textContent = post.author;
    gallery.append(card);
  }
  if (all) arrangeWall();
}

function arrangeWall() {
  const cards = Array.from(gallery.children);
  let lastWidth = 0;
  function layout() {
    const width = gallery.clientWidth;
    if (!width || width === lastWidth) return;
    lastWidth = width;
    const count = Number(getComputedStyle(gallery).getPropertyValue("--wall-columns"));
    const stacks = Array.from({length: count}, () => document.createElement("div"));
    const heights = Array(count).fill(0);
    for (const card of cards) {
      const column = heights.indexOf(Math.min(...heights));
      const image = card.querySelector("img");
      stacks[column].append(card);
      heights[column] += width / count * image.getAttribute("height") / image.getAttribute("width") + 58;
    }
    gallery.replaceChildren(...stacks);
  }
  layout();
  new ResizeObserver(layout).observe(gallery);
}

function setupUpload() {
  const form = document.querySelector("#idea-form");
  const fields = form.elements;
  const previews = document.querySelector("#previews");
  const message = document.querySelector("#form-message");
  const submit = form.querySelector("button[type=submit]");
  form.hidden = false;
  document.querySelector("#inspiration").hidden = false;
  for (const id of ["alpine-hour", "concrete-arc", "linen-field", "sea-line"]) {
    const post = samplePosts.find(item => item.id === id);
    if (post) document.querySelector(".moodboard").append(thumbnail(post));
  }
  for (const category of collections.filter(item => ["ai-generated", "photo", "site-inspirations"].includes(item.id))) {
    fields.category.add(new Option(category.name, category.id));
  }
  fields.category.value = "photo";

  const pictures = [];
  let pending = 0;
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
          URL.revokeObjectURL(url);
        };
        img.alt = file.name;
        tile.append(img, remove);
        previews.append(tile);
      } catch {
        URL.revokeObjectURL(url);
        message.textContent = "Could not read " + file.name + ". Try a different image.";
      }
    }
    pending--;
    submit.disabled = pending > 0;
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
    try {
      const post = {
        id: crypto.randomUUID(), title, author, description,
        category: fields.category.value,
        date: new Date().toISOString(),
        tags: fields.tags.value.split(",").map(tag => tag.trim()).filter(Boolean),
        images: pictures.slice()
      };
      await savePost(post);
      location.assign(collectionUrl(post.category));
    } catch {
      message.textContent = "Could not save in this browser. Check available storage and try again.";
      submit.disabled = false;
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
