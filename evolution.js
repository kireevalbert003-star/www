// Existing images always form version 01, including publications saved before versioning.
function ideaVersions(post) {
  return [
    { id: post.id + ":original", date: post.date, note: post.description, images: post.images },
    ...(post.revisions || [])
  ];
}

function currentImages(post) {
  return post.revisions?.at(-1)?.images || post.images;
}

function versionUrl(post, version) {
  return postUrl(post) + "&version=" + encodeURIComponent(version.id);
}

function composeUrl(mode, post, version) {
  return "category.html?" + new URLSearchParams({ view: "upload", [mode]: post.id, version: version.id });
}

let localCreatorId;
function isOwned(post) {
  return Boolean(localCreatorId && (post.creatorId || localCreatorId) === localCreatorId);
}

class IdeaError extends Error {}

// Read permissions and write the change within one transaction, including across tabs.
async function writeFromSource(id, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("posts", "readwrite");
    const store = tx.objectStore("posts");
    let result, reason;
    const request = store.get(id);
    request.onsuccess = () => {
      const source = request.result || samplePosts.find(post => post.id === id);
      try {
        if (!source) throw new IdeaError("The source idea is no longer available.");
        result = action(store, source);
      } catch (error) {
        reason = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(reason || tx.error);
  });
}

function editOwnedIdea(id, change) {
  return writeFromSource(id, (store, post) => {
    if (!isOwned(post)) throw new IdeaError("Only the creating browser can edit this idea.");
    post.creatorId = localCreatorId;
    change(post);
    store.put(post);
    return post;
  });
}

function saveContinuation(post, sourceId, versionId) {
  return writeFromSource(sourceId, (store, source) => {
    if (!source.allowContinuation) throw new IdeaError("The author has closed this idea to continuations.");
    if (!ideaVersions(source).some(version => version.id === versionId)) throw new IdeaError("The source version is unavailable.");
    // Parent edges are immutable. Only a fresh publication can become a child.
    post.parent = { id: source.id, versionId, category: source.category, title: source.title,
      author: source.author, creatorId: source.creatorId || localCreatorId };
    post.root = source.root || post.parent;
    store.add(post);
  });
}

function sourceCaption(container, post, version) {
  const image = new Image();
  fillImage(image, version.images[0]);
  const link = document.createElement("a");
  link.href = versionUrl(post, version);
  const number = ideaVersions(post).findIndex(item => item.id === version.id) + 1;
  link.textContent = post.title + " · " + post.author + " · v" + String(number).padStart(2, "0");
  container.replaceChildren(image, link);
  container.hidden = false;
}

function setupEvolution(post, posts) {
  const versions = ideaVersions(post);
  const timeline = document.querySelector("#version-line");
  const more = document.querySelector("#add-version");
  const branch = document.querySelector("#continue-idea");
  const permission = document.querySelector("#edit-permission");
  const notice = document.querySelector("#notice");
  const tree = document.querySelector("#evolution-tree");
  let selected;

  function select(version, updateAddress) {
    selected = version;
    setupPhotoViewer(version.images);
    document.querySelector("#detail-description").textContent = version.note || post.description || "";
    branch.hidden = !post.allowContinuation;
    branch.href = composeUrl("continue", post, version);
    more.href = composeUrl("revise", post, version);
    for (const button of timeline.children) button.setAttribute("aria-pressed", String(button.dataset.version === version.id));
    if (updateAddress) history.replaceState(null, "", versionUrl(post, version));
    if (tree.open) drawEvolutionTree(tree.lastElementChild, posts, post, selected);
  }
  versions.forEach((version, index) => {
    const button = document.createElement("button");
    const label = index === 0 ? "Original" : index === versions.length - 1 ? "Current" : "Version";
    button.textContent = String(index + 1).padStart(2, "0") + " " + label;
    button.type = "button";
    button.dataset.version = version.id;
    button.title = new Date(version.date).toLocaleDateString("en");
    button.onclick = () => select(version, true);
    timeline.append(button);
  });
  const requested = versions.find(version => version.id === params.get("version"));
  if (params.has("version") && !requested) notice.textContent = "This version is unavailable. Showing the current version.";
  select(requested || versions.at(-1), false);
  more.hidden = !isOwned(post);
  permission.closest("label").hidden = !isOwned(post);
  permission.checked = Boolean(post.allowContinuation);
  permission.onchange = async () => {
    const enabled = permission.checked;
    permission.disabled = true;
    try {
      await editOwnedIdea(post.id, saved => { saved.allowContinuation = enabled; });
      post.allowContinuation = enabled;
      branch.hidden = !enabled;
    } catch {
      permission.checked = Boolean(post.allowContinuation);
      notice.textContent = "Could not update continuation permission.";
    } finally { permission.disabled = false; }
  };

  if (post.parent) {
    const parent = posts.find(item => item.id === post.parent.id);
    const lineage = document.querySelector("#lineage");
    lineage.hidden = false;
    lineage.textContent = "Continued from ";
    const credit = post.parent.title + " · " + post.parent.author;
    if (parent) {
      const link = document.createElement("a");
      link.href = versionUrl(parent, { id: post.parent.versionId });
      link.textContent = credit;
      lineage.append(link);
    } else lineage.append(credit + " (unavailable)");
  }
  tree.ontoggle = () => { if (tree.open) drawEvolutionTree(tree.lastElementChild, posts, post, selected); };
}

function drawEvolutionTree(container, posts, current, selected) {
  const byId = new Map(posts.map(post => [post.id, post]));
  const branches = new Map();
  for (const post of posts) {
    if (!post.parent) continue;
    const key = post.parent.versionId;
    if (!branches.has(key)) branches.set(key, []);
    branches.get(key).push(post);
  }
  let root = current;
  const visited = new Set();
  while (byId.has(root.parent?.id) && !visited.has(root.id)) {
    visited.add(root.id);
    root = byId.get(root.parent.id);
  }
  visited.clear();
  function addPublication(list, post) {
    if (visited.has(post.id)) return;
    visited.add(post.id);
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = (post.parent ? "Continuation · " : "") + post.title + " · " + post.author;
    li.append(title);
    for (const [index, version] of ideaVersions(post).entries()) {
      const row = document.createElement("div");
      const link = document.createElement("a");
      link.href = versionUrl(post, version);
      link.textContent = "Version " + String(index + 1).padStart(2, "0") + (index === 0 ? " · Original" : "");
      if (post.id === current.id && version.id === selected.id) link.setAttribute("aria-current", "page");
      row.append(link);
      const children = branches.get(version.id) || [];
      if (children.length) {
        const nested = document.createElement("ul");
        for (const child of children) addPublication(nested, child);
        row.append(nested);
      }
      li.append(row);
    }
    list.append(li);
  }
  container.replaceChildren();
  if (root.parent && !byId.has(root.parent.id)) {
    const credit = document.createElement("p");
    credit.textContent = "Source unavailable · " + root.parent.title + " · " + root.parent.author;
    container.append(credit);
  }
  const list = document.createElement("ul");
  addPublication(list, root);
  container.append(list);
}
