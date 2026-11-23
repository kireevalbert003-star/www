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

if (gallery) {
  // Один шаблон страницы обслуживает все адреса категорий.
  const id = new URLSearchParams(window.location.search).get("id");
  const collection = collections.find(item => item.id === id);
  const heading = document.querySelector("#collection-name");
  const description = document.querySelector("#collection-description");

  if (collection) {
    if (collections.length > 1) {
      const next = collections[(collections.indexOf(collection) + 1) % collections.length];
      const link = document.querySelector("#next-collection");
      link.textContent = "Next: " + next.name;
      link.href = "category.html?id=" + encodeURIComponent(next.id);
      link.hidden = false;
    }
    document.title = collection.name + " — In Progress";
    heading.textContent = collection.name;
    description.textContent = collection.about;
    const template = document.querySelector("#publication");

    for (const post of collection.posts) {
      const card = template.content.cloneNode(true);
      const image = card.querySelector("img");
      image.src = `assets/gallery/${post.image}.jpg`;
      image.alt = post.alt;
      card.querySelector("h2").textContent = post.title;
      card.querySelector("p").textContent = post.note;
      gallery.append(card);
    }
  } else {
    document.title = "Collection not found — In Progress";
    heading.textContent = "Collection not found";
    description.textContent = "Return to the shelf to choose a collection.";
  }
}

// A short burst of filtered noise sounds like a paper sleeve sliding.
let audio;
let soundOn = true;
try { soundOn = localStorage.getItem("shelf-sound") !== "off"; } catch {}
const soundButton = document.querySelector(".sound");

function showSoundState() {
  soundButton.textContent = soundOn ? "Sound on" : "Sound off";
  soundButton.setAttribute("aria-pressed", String(soundOn));
}

function rustle() {
  try {
    audio ??= new AudioContext();
    audio.resume().catch(() => {});
    const duration = 0.105;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const t = i / samples.length;
      samples[i] = (Math.random() * 2 - 1) * Math.min(1, t * 20) * (1 - t) ** 2;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2300;
    const gain = audio.createGain();
    gain.gain.value = 0.18;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
    return true;
  } catch { return false; }
}

showSoundState();
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  try { localStorage.setItem("shelf-sound", soundOn ? "on" : "off"); } catch {}
  showSoundState();
  if (soundOn) rustle();
});

let travel;
document.addEventListener("click", event => {
  const link = event.target.closest(".sleeve, #next-collection, .collection-bar a");
  if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (soundOn && rustle()) {
    event.preventDefault();
    clearTimeout(travel);
    travel = setTimeout(() => location.assign(link.href), 135);
  }
});
