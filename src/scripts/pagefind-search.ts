type SearchResult = {
  url: string;
  meta: { title?: string };
  excerpt: string;
};

type Pagefind = {
  search: (query: string) => Promise<{
    results: Array<{ data: () => Promise<SearchResult> }>;
  }>;
};

let pagefind: Pagefind | undefined;

async function getPagefind(): Promise<Pagefind> {
  if (pagefind) return pagefind;

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const moduleUrl = `${base}/pagefind/pagefind.js`;
  const module = (await import(/* @vite-ignore */ moduleUrl)) as Pagefind;
  if (typeof module.search !== 'function') {
    throw new Error('Pagefind search export is unavailable');
  }

  pagefind = module;
  return pagefind;
}

export function bindPagefindSearch({
  input,
  output,
  status,
  emptyMessage,
  limit,
}: {
  input: HTMLInputElement | null;
  output: HTMLElement | null;
  status: HTMLElement | null;
  emptyMessage: string;
  limit: number;
}) {
  if (!input || !output || !status) return;

  let timer: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const query = input.value.trim();
      output.replaceChildren();
      if (!query) {
        status.textContent = emptyMessage;
        return;
      }

      status.textContent = 'Searching...';
      try {
        const response = await (await getPagefind()).search(query);
        const results = await Promise.all(response.results.slice(0, limit).map((item) => item.data()));
        status.textContent = results.length
          ? `${results.length}${response.results.length > limit ? '+' : ''} results`
          : 'No matching posts.';

        for (const result of results) {
          const link = document.createElement('a');
          link.href = result.url;
          link.className = 'search-result';

          const title = document.createElement('span');
          title.className = 'search-result-title';
          title.textContent = result.meta.title ?? 'Untitled';

          const excerpt = document.createElement('p');
          excerpt.className = 'search-result-excerpt';
          excerpt.textContent = result.excerpt.replace(/<[^>]*>/g, '');
          link.append(title, excerpt);
          output.append(link);
        }
      } catch (error) {
        console.error('Pagefind search failed to load or run.', error);
        status.textContent = 'Search is available after a production build. Try `npm run build`, then preview the site.';
      }
    }, 120);
  });
}
