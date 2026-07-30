import { defineConfig } from 'vite';

export default defineConfig({
  // 배포 대상에 따라 base가 다르다.
  // - Vercel: 루트에서 서빙하므로 '/'. 빌드 시 VERCEL=1 환경변수가 자동 주입된다.
  // - GitHub Pages: 저장소 이름과 일치해야 한다. 불일치하면 에셋 404가 난다.
  base: process.env.VERCEL ? '/' : '/party-3d/',
});
