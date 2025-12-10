import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    base: '/', // CRUCIAL: Garante caminhos absolutos no deploy
    plugins: [react()],
    define: {
      // Garante que a chave nunca seja undefined, evitando quebra do build
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    server: {
      host: true
    },
    build: {
      outDir: 'dist',
    }
  };
});