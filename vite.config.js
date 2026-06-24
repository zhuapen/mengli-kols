import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 自定义插件：将模块脚本移到 legacy 脚本之后
function moveModuleScriptPlugin() {
  return {
    name: 'move-module-script',
    enforce: 'post',
    transformIndexHtml(html) {
      const moduleScriptMatch = html.match(/<script type="module"[^>]*><\/script>/);
      if (!moduleScriptMatch) return html;
      const moduleScript = moduleScriptMatch[0];
      html = html.replace(moduleScript, '');
      const lastScriptClose = html.lastIndexOf('</script>');
      if (lastScriptClose !== -1) {
        const insertPos = lastScriptClose + '</script>'.length;
        html = html.slice(0, insertPos) + '\n' + moduleScript + html.slice(insertPos);
      }
      return html;
    }
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public-assets',

  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8891',
      '/admin': 'http://localhost:8891',
      '/permissions': 'http://localhost:8891',
      '/history': 'http://localhost:8891',
      '/assets': 'http://localhost:8891',
      '/brands': 'http://localhost:8891',
      '/templates': 'http://localhost:8891',
      '/preferences': 'http://localhost:8891',
      '/feedback': 'http://localhost:8891',
      '/plugin-feedback': 'http://localhost:8891',
      '/plugins': 'http://localhost:8891',
      '/upload': 'http://localhost:8891',
      '/rest': 'http://localhost:8891',
      '/api': {
        target: 'http://localhost:8890',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        entryFileNames: 'static/[name]-[hash].js',
        chunkFileNames: 'static/[name]-[hash].js',
        assetFileNames: 'static/[name]-[hash].[ext]',
        manualChunks(id) {
          if (id.includes('node_modules/vue')) return 'vendor-vue';
          if (id.includes('src/vue/')) return 'vue-app';
        },
      },
    },
    sourcemap: false,
    modulePreload: false,
  },

  css: {
    devSourcemap: true,
  },

  resolve: {
    alias: {
      '@': '/src',
    },
  },

  plugins: [
    vue(),
    moveModuleScriptPlugin(),
  ],
});
