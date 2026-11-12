import { createApp } from 'vue';
import '@/css/app.css';
import App from './App.vue';
import { initShare } from './state-share.ts';

createApp(App).mount('#app');
initShare();
