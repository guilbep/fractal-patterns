// Grows Breed children off the main thread: a link in, a thumbnail and its tracking score out (breed.ts `grow`).
import { grow } from './breed.ts';
import { decodeStudio } from './studio-share.ts';

self.onmessage = (e: MessageEvent<{ id: number; link: string }>) => {
  self.postMessage({ id: e.data.id, ...grow(decodeStudio(e.data.link)) });
};
