import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pinboard · Tanweel',
    short_name: 'Pinboard',
    description: 'Tanweel projects, requests and tasks / مشاريع تنويل وطلباتها ومهامها',
    start_url: '/requests',
    scope: '/',
    display: 'standalone',
    background_color: '#f8f8f6',
    theme_color: '#8851f5',
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // The official square artwork already keeps the mark within the safe circle.
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
