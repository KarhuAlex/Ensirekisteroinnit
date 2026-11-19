import { describe, expect, it } from 'vitest';
import { renderStaticPage, type StaticPage } from './staticPage';

const TEMPLATE = `<!doctype html>
<html lang="fi">
  <head>
    <meta
      name="description"
      content="Sivuston kuvaus"
    />
    <title>Sivusto</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const PAGE: StaticPage = {
  lang: 'en',
  head: { title: 'Audi – Site', description: 'Audi & more', heading: 'Audi <A>' },
  canonical: 'https://example.org/en/models/audi',
  nav: {
    label: 'Main',
    links: [{ href: '/fi/models/audi', label: 'Suomeksi', lang: 'fi' }],
  },
  sections: [
    { heading: 'Models', links: [{ href: '/en/models/audi-a4', label: 'Audi A4' }] },
    { heading: 'Nothing here', links: [] },
  ],
};

describe('renderStaticPage', () => {
  const html = renderStaticPage(TEMPLATE, PAGE);

  it('writes the page language, title and description into the head', () => {
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Audi – Site</title>');
    expect(html).toContain('<meta name="description" content="Audi &#38; more" />');
    expect(html).not.toContain('Sivuston kuvaus');
  });

  it('points the canonical link at the page itself', () => {
    expect(html).toContain('<link rel="canonical" href="https://example.org/en/models/audi" />');
    expect(html.indexOf('rel="canonical"')).toBeLessThan(html.indexOf('</head>'));
  });

  it('gives the body a heading, the description and plain links', () => {
    expect(html).toContain('<h1>Audi &#60;A&#62;</h1>');
    expect(html).toContain('<p>Audi &#38; more</p>');
    expect(html).toContain('<a href="/en/models/audi-a4">Audi A4</a>');
  });

  it('wraps the body so that a browser running the app can hide it until the app mounts', () => {
    expect(html).toContain('<div id="root"><div class="static-page"><nav');
  });

  it('marks a link to the other language', () => {
    expect(html).toContain('<a href="/fi/models/audi" hreflang="fi" lang="fi">Suomeksi</a>');
  });

  it('leaves out a section with no links', () => {
    expect(html).not.toContain('Nothing here');
  });

  it('keeps dollar signs in the text as written', () => {
    const page = { ...PAGE, head: { ...PAGE.head, title: "$' and $&" } };
    expect(renderStaticPage(TEMPLATE, page)).toContain('<title>$&#39; and $&#38;</title>');
  });

  it('refuses a template it cannot fill', () => {
    expect(() => renderStaticPage(TEMPLATE.replace('<div id="root"></div>', ''), PAGE)).toThrow(
      /root/,
    );
    expect(() =>
      renderStaticPage(TEMPLATE.replace('<title>', '<title>a</title><title>'), PAGE),
    ).toThrow(/title/);
  });
});
