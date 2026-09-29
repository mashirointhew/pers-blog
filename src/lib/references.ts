type Reference = { title: string; url: string };

export function getPostReferences(body: string, references: Reference[] = []): Reference[] {
  const found = new Map<string, Reference>();
  for (const reference of references) found.set(reference.url, reference);
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

  const inlineLink = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+[^)]*)?\)/g;
  for (const match of prose.matchAll(inlineLink)) {
    if (match.index !== undefined && prose[match.index - 1] === '!') continue;
    const url = match[2].replace(/[.,;:!?]+$/, '');
    if (!found.has(url)) found.set(url, { title: match[1].replace(/[*_`]/g, '').trim(), url });
  }

  const bareUrl = /https?:\/\/[^\s<>"')\]]+/g;
  for (const match of prose.matchAll(bareUrl)) {
    const url = match[0].replace(/[.,;:!?]+$/, '');
    if (!found.has(url)) found.set(url, { title: url, url });
  }

  return [...found.values()];
}
