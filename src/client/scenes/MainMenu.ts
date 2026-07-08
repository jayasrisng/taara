import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import type { Difficulty } from '../../shared/constellations';
import { nightNumberAt } from '../../shared/nightSeed';

interface DiffButton {
  container: GameObjects.Container;
  yFactor: number;
}

export class MainMenu extends Scene {
  private background: GameObjects.Image | null = null;
  private title: GameObjects.Text | null = null;
  private subtitle: GameObjects.Text | null = null;
  private buttons: DiffButton[] = [];

  constructor() {
    super('MainMenu');
  }

  /**
   * Reset cached references every time the scene starts, since Phaser reuses
   * the same Scene instance and the old GameObjects are destroyed on shutdown.
   */
  init(): void {
    this.background = null;
    this.title = null;
    this.subtitle = null;
    this.buttons = [];
  }

  create(): void {
    this.buildUi();
    this.refreshLayout();
    this.scale.on('resize', () => this.refreshLayout());

    // Debug key: press 'D' to view the constellation debug scene.
    this.input.keyboard?.on('keydown-D', () => this.scene.start('ConstellationDebug'));
  }

  private buildUi(): void {
    this.background = this.add.image(0, 0, 'background').setOrigin(0);

    this.title = this.add
      .text(0, 0, 'TaaraNight', {
        fontFamily: 'Arial Black',
        fontSize: '40px',
        color: '#f5f3ff',
        stroke: '#0b0f28',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5);

    const night = Math.max(1, nightNumberAt(Date.now()));
    this.subtitle = this.add
      .text(0, 0, `Tonight · TaaraNight #${night}\nChoose your night`, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#c9cff0',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5);

    const difficulties: { label: string; value: Difficulty; color: string }[] = [
      { label: 'Easy', value: 'easy', color: '#bfe6c9' },
      { label: 'Medium', value: 'medium', color: '#ffe3a3' },
      { label: 'Hard', value: 'hard', color: '#ffb3b3' },
    ];

    this.buttons = difficulties.map((d, i) => ({
      container: this.createButton(d.label, d.color, () => this.scene.start('Play', { difficulty: d.value })),
      yFactor: 0.62 + i * 0.12,
    }));
  }

  private createButton(label: string, color: string, onClick: () => void): GameObjects.Container {
    const width = 260;
    const height = 56;

    const bg = this.add.graphics();
    bg.fillStyle(0x20264f, 0.92);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    bg.lineStyle(1.5, 0xffe3a3, 0.35);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);

    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color,
      })
      .setOrigin(0.5);

    const container = this.add.container(0, 0, [bg, text]);
    container.setSize(width, height);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains
    );
    container.on('pointerover', () => container.setScale(1.04));
    container.on('pointerout', () => container.setScale(1));
    container.on('pointerup', onClick);
    return container;
  }

  private refreshLayout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);

    if (this.background) this.background.setDisplaySize(width, height);

    const scaleFactor = Math.min(Math.min(width / 1024, height / 768), 1);

    if (this.title) this.title.setPosition(width / 2, height * 0.2).setScale(scaleFactor);
    if (this.subtitle) this.subtitle.setPosition(width / 2, height * 0.34).setScale(scaleFactor);

    for (const btn of this.buttons) {
      btn.container.setPosition(width / 2, height * btn.yFactor);
      btn.container.setScale(scaleFactor);
    }
  }
}
