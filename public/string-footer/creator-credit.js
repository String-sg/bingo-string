// Local, bundled enhancement. Failure leaves the approved credit without a school.
export function mountCreatorCredits(root = document) {
  const controllers = [];
  for (const element of root.querySelectorAll('[data-string-creator]')) {
    const slug = element.getAttribute('data-string-creator');
    if (!/^[a-z0-9-]+$/.test(slug || '')) continue;
    const controller = new AbortController();
    controllers.push(controller);
    fetch(`https://id.string.sg/api/creation?slug=${encodeURIComponent(slug)}`, {
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    }).then(response => response.ok ? response.json() : Promise.reject()).then(data => {
      if (controller.signal.aborted || data.slug !== slug || typeof data.name !== 'string' || !data.name.trim()) return;
      const name = document.createElement('strong');
      name.textContent = data.name;
      const nodes = [];
      if (typeof data.profileUrl === 'string' && /^https:\/\/id\.string\.sg\/u\/[a-z0-9-]+$/.test(data.profileUrl)) {
        const link = document.createElement('a'); link.href = data.profileUrl; link.append(name); nodes.push(link);
      } else nodes.push(name);
      if (nodes[0]?.tagName === 'A' && typeof data.school === 'string' && data.school.trim()) nodes.push(document.createTextNode(` (${data.school.trim()})`));
      element.replaceChildren(...nodes);
    }).catch(() => {});
  }
  return () => controllers.forEach(controller => controller.abort());
}
