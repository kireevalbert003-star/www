const cloudConfig = window.ideaCloudConfig;
const cloudEnabled = Boolean(cloudConfig?.url && cloudConfig?.key);
let cloudClient;
let cloudUser;
const imageBucket = "idea-images";

async function connectCloud() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  cloudClient = createClient(cloudConfig.url, cloudConfig.key);
  const { data, error } = await cloudClient.auth.getSession();
  if (error) throw error;
  cloudUser = data.session?.user;
  const panel = document.querySelector("#cloud-account");
  panel.hidden = false;
  const form = panel.querySelector("form");
  const signOut = panel.querySelector("[data-sign-out]");
  const status = panel.querySelector("[role=status]");
  form.hidden = Boolean(cloudUser);
  signOut.hidden = !cloudUser;
  form.onsubmit = async event => {
    event.preventDefault();
    const credentials = { email: form.elements.email.value, password: form.elements.password.value };
    const method = event.submitter?.value === "register" ? "signUp" : "signInWithPassword";
    form.inert = true;
    try {
      if (method === "signUp") credentials.options = { emailRedirectTo: location.origin + location.pathname };
      const { data, error } = await cloudClient.auth[method](credentials);
      if (error) throw error;
      if (data.session) location.reload();
      else status.textContent = "Check your email to confirm your account.";
    } catch (error) { status.textContent = error.message; }
    finally { form.inert = false; }
  };
  signOut.onclick = async () => {
    const { error } = await cloudClient.auth.signOut();
    if (error) status.textContent = error.message;
    else location.reload();
  };
}

function cloudImage(path) {
  if (typeof path !== "string" || !/^[a-f0-9-]{36}\/[a-f0-9]{64}\.(jpeg|png|webp|gif|avif)$/.test(path)) {
    return "assets/gallery/alpine-hour.jpg";
  }
  return cloudClient.storage.from(imageBucket).getPublicUrl(path).data.publicUrl;
}

function decodeCloudPost(row) {
  const decode = picture => ({
    ...picture, src: cloudImage(picture.path),
    originalSrc: picture.originalPath ? cloudImage(picture.originalPath) : null
  });
  const post = row.body;
  return {
    ...post, id: row.id, creatorId: row.owner, cloud: true,
    images: post.images.map(decode),
    revisions: (post.revisions || []).map(version => ({ ...version, images: version.images.map(decode) }))
  };
}

async function readCloudPosts() {
  const posts = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await cloudClient.from("ideas").select("*").order("id").range(offset, offset + 99);
    if (error) throw error;
    posts.push(...data.map(decodeCloudPost));
    if (data.length < 100) return posts;
  }
}

async function uploadCloudImage(blob) {
  if (blob.size > 10 * 1024 * 1024) throw new IdeaError("Each image, including its original, must be 10 MB or smaller.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  const hash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  const path = cloudUser.id + "/" + hash + "." + blob.type.slice(6);
  const { error } = await cloudClient.storage.from(imageBucket).upload(path, blob);
  if (error && String(error.statusCode) !== "409" && error.message !== "The resource already exists") throw error;
  return path;
}

async function encodeCloudPictures(pictures) {
  const result = [];
  for (const picture of pictures) {
    const { blob, originalBlob, src, originalSrc, ...record } = picture;
    if (blob) record.path = await uploadCloudImage(blob);
    if (originalBlob) record.originalPath = await uploadCloudImage(originalBlob);
    result.push(record);
  }
  return result;
}

async function saveCloudPost(post) {
  if (!cloudUser) throw new IdeaError("Sign in to publish.");
  const { cloud, ...body } = post;
  body.images = await encodeCloudPictures(body.images);
  if (body.revisions) {
    body.revisions = await Promise.all(body.revisions.map(async version => ({
      ...version, images: await encodeCloudPictures(version.images)
    })));
  }
  const { error } = await cloudClient.from("ideas").insert({ id: post.id, body });
  if (error) throw new IdeaError(error.message);
}

async function editCloudPost(id, change) {
  const { data: row, error } = await cloudClient.from("ideas").select("*").eq("id", id).single();
  if (error || row.owner !== cloudUser?.id) throw new IdeaError("Only the author can edit this idea.");
  change(row.body);
  if (row.body.revisions) {
    row.body.revisions = await Promise.all(row.body.revisions.map(async version => ({
      ...version, images: await encodeCloudPictures(version.images)
    })));
  }
  const result = await cloudClient.from("ideas").update({ body: row.body }).eq("id", id)
    .eq("generation", row.generation).select("id");
  if (result.error) throw new IdeaError(result.error.message);
  if (!result.data.length) throw new IdeaError("This idea was updated in another tab. Reload and try again.");
}

function offerLocalImport(localPosts, cloudPosts) {
  if (!cloudUser) return;
  const available = new Set([...cloudPosts, ...samplePosts].map(post => post.id));
  const pending = localPosts.filter(post => !available.has(post.id));
  if (!pending.length) return;
  const panel = document.querySelector("#cloud-account");
  const button = panel.querySelector("[data-import]");
  const status = panel.querySelector("[role=status]");
  button.hidden = false;
  button.onclick = async () => {
    if (!confirm("Publish " + pending.length + " local ideas and their original images to the public gallery?")) return;
    button.disabled = true;
    let remaining = pending.slice();
    let migrated = 0;
    let failure;
    while (remaining.length) {
      const ready = remaining.filter(post => !post.parent || available.has(post.parent.id));
      if (!ready.length) break;
      remaining = remaining.filter(post => !ready.includes(post));
      for (const post of ready) {
        try {
          await saveCloudPost(post);
          available.add(post.id);
          migrated++;
        } catch (error) { failure = error.message; }
      }
    }
    if (migrated === pending.length) location.reload();
    else status.textContent = migrated + " of " + pending.length + " published. " +
      (failure || "Some parent ideas were unavailable.") + " Your local copies are still available.";
  };
}
