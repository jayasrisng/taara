/**
 * The post preview. One logo, one night number, one way in.
 *
 * The night is painted from the client's own clock so the card is never blank
 * in a feed, then reconciled with the server — which knows the night this post
 * was actually born under, so an archive post names its own sky rather than
 * tonight's. Same pattern as MainMenu, for the same reason.
 */

import { requestExpandedMode } from '@devvit/web/client';
import { nightNumberAt } from '../shared/nightSeed';
import { fetchInit } from './api';

const nightElement = document.getElementById('night') as HTMLParagraphElement;
const startButton = document.getElementById('start-button') as HTMLButtonElement;

startButton.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

nightElement.textContent = `TaaraNight #${Math.max(1, nightNumberAt(Date.now()))}`;

async function syncNight(): Promise<void> {
  const init = await fetchInit();
  if (init) nightElement.textContent = init.label;
}

void syncNight();
