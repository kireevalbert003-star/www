const shelf = document.querySelector("#sleeves");
const gallery = document.querySelector("#gallery");

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
