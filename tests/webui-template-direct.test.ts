import { describe, expect, it } from 'vitest';
import { renderWebUiHtml } from '../src/webui/template.js';

describe('renderWebUiHtml direct source coverage', () => {
  it('embeds the nonce in every executable/style block and the capability in the API client', () => {
    const html = renderWebUiHtml('nonce-value', 'capability-value');
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>BlankDrive · Secure Vault</title>');
    expect(html).toContain('<style nonce="nonce-value">');
    expect(html).toContain('<script type="module" nonce="nonce-value">');
    expect(html).toContain('const UI_CAPABILITY="capability-value";');
    expect(html).toContain('h.set(\'X-BlankDrive-UI\',UI_CAPABILITY)');
    expect(html).toContain('src="/api/brand/logo"');
    expect(html).toContain("el.videoPlayer.src='/api/files/'+encodeURIComponent(s.selectedId)+'/stream?ts='");
    expect(html.match(/nonce="nonce-value"/g)).toHaveLength(2);
  });

  it('JSON-escapes capability values and preserves the supplied nonce literally', () => {
    const html = renderWebUiHtml('N+/=', 'x";window.injected=true;//');
    expect(html).toContain('<style nonce="N+/=">');
    expect(html).toContain('<script type="module" nonce="N+/=">');
    expect(html).toContain('const UI_CAPABILITY="x\\";window.injected=true;\/\/";');
    expect(html).not.toContain('const UI_CAPABILITY="x";window.injected=true;//";');
  });
});
