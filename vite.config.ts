import path from 'node:path';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import {studioApi} from './tooling/dev-server/studio-api';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), studioApi({env})],
    server: {host: '127.0.0.1', port: 4178},
    appType: 'mpa',
    build: {
      rollupOptions: {
        input: {
          studio: path.resolve('index.html'),
          operations: path.resolve('operations.html'),
          motion: path.resolve('editor.html'),
          documents: path.resolve('documents.html'),
          identity: path.resolve('apps/identity/identity-lab.html'),
          amaviDocumentExample: path.resolve('examples/documents/amavi-technical-specification.html'),
        },
      },
    },
  };
});
