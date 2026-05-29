import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://brendankowitz.github.io',
  base: '/nexus-ide',
  integrations: [mdx(), sitemap()],
  output: 'static',
});
