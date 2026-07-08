/**
 * Debug scene to visualize constellation data
 * This helps verify that star positions and connections look correct
 */

import { Scene, GameObjects } from 'phaser';
import {
  loadConstellations,
  getConstellationByIndex,
  getConstellationCount,
} from '../../shared/constellationLoader';
import type { Constellation } from '../../shared/constellations';

export class ConstellationDebug extends Scene {
  private currentIndex = 0;
  private constellation: Constellation | null = null;
  private stars: GameObjects.Arc[] = [];
  private lines: GameObjects.Line[] = [];
  private titleText: GameObjects.Text | null = null;
  private difficultyText: GameObjects.Text | null = null;
  private storyText: GameObjects.Text | null = null;
  private instructionsText: GameObjects.Text | null = null;

  constructor() {
    super('ConstellationDebug');
  }

  init(): void {
    // Reset state
    this.stars = [];
    this.lines = [];
    this.titleText = null;
    this.difficultyText = null;
    this.storyText = null;
    this.instructionsText = null;
  }

  create() {
    // Validate constellation data on load
    try {
      loadConstellations();
    } catch (error) {
      console.error('Constellation validation failed:', error);
      this.add
        .text(this.scale.width / 2, this.scale.height / 2, 'ERROR: Invalid constellation data\nCheck console for details', {
          fontSize: '24px',
          color: '#ff0000',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    this.showConstellation(this.currentIndex);
    this.setupControls();
    this.scale.on('resize', () => this.refreshLayout());
  }

  private showConstellation(index: number): void {
    this.constellation = getConstellationByIndex(index);

    // Clear previous visualization
    this.stars.forEach((star) => star.destroy());
    this.lines.forEach((line) => line.destroy());
    this.stars = [];
    this.lines = [];

    this.drawConstellation();
    this.updateText();
  }

  private drawConstellation(): void {
    if (!this.constellation) return;

    const { width, height } = this.scale;

    // Define the constellation drawing area (centered, with padding)
    const padding = 100;
    const drawAreaSize = Math.min(width - padding * 2, height - padding * 2, 600);
    const offsetX = (width - drawAreaSize) / 2;
    const offsetY = 80; // Leave room for title at top

    // Draw background for constellation area
    this.add.rectangle(
      width / 2,
      offsetY + drawAreaSize / 2,
      drawAreaSize,
      drawAreaSize,
      0x000011,
      0.8
    );

    // Draw connections first (so they appear behind stars)
    this.constellation.connections.forEach((conn) => {
      const star1 = this.constellation!.stars[conn.from];
      const star2 = this.constellation!.stars[conn.to];

      if (!star1 || !star2) return;

      const x1 = offsetX + star1.x * drawAreaSize;
      const y1 = offsetY + star1.y * drawAreaSize;
      const x2 = offsetX + star2.x * drawAreaSize;
      const y2 = offsetY + star2.y * drawAreaSize;

      const line = this.add.line(0, 0, x1, y1, x2, y2, 0x4488ff, 0.6);
      line.setLineWidth(2);
      this.lines.push(line);
    });

    // Draw stars
    this.constellation.stars.forEach((star, index) => {
      const x = offsetX + star.x * drawAreaSize;
      const y = offsetY + star.y * drawAreaSize;

      // Star glow
      const glow = this.add.arc(x, y, 8, 0, 360, false, 0xffffff, 0.3);
      this.stars.push(glow);

      // Star core
      const core = this.add.arc(x, y, 4, 0, 360, false, 0xffffff, 1.0);
      this.stars.push(core);

      // Star index label (for debugging)
      const label = this.add.text(x + 10, y - 10, `${index}`, {
        fontSize: '12px',
        color: '#888888',
      });
      this.stars.push(label as any);
    });
  }

  private updateText(): void {
    if (!this.constellation) return;

    const { width } = this.scale;

    // Title
    if (!this.titleText) {
      this.titleText = this.add
        .text(width / 2, 30, '', {
          fontSize: '28px',
          color: '#ffffff',
          fontFamily: 'Arial',
        })
        .setOrigin(0.5);
    }
    this.titleText.setText(`${this.constellation.name}`);

    // Difficulty badge
    if (!this.difficultyText) {
      this.difficultyText = this.add
        .text(width / 2, 60, '', {
          fontSize: '16px',
          color: '#aaaaaa',
          fontFamily: 'Arial',
        })
        .setOrigin(0.5);
    }
    const difficultyColor =
      this.constellation.difficulty === 'easy'
        ? '#00ff00'
        : this.constellation.difficulty === 'medium'
          ? '#ffaa00'
          : '#ff0000';
    this.difficultyText.setText(
      `${this.constellation.difficulty.toUpperCase()} | ${this.constellation.stars.length} stars | ${this.constellation.connections.length} connections`
    );
    this.difficultyText.setColor(difficultyColor);

    // Story preview (bottom of screen)
    if (!this.storyText) {
      this.storyText = this.add
        .text(width / 2, this.scale.height - 80, '', {
          fontSize: '14px',
          color: '#cccccc',
          fontFamily: 'Arial',
          align: 'center',
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5);
    }
    const storyPreview =
      this.constellation.story.length > 200
        ? this.constellation.story.substring(0, 200) + '...'
        : this.constellation.story;
    this.storyText.setText(storyPreview);

    // Navigation instructions
    if (!this.instructionsText) {
      this.instructionsText = this.add
        .text(width / 2, this.scale.height - 20, '', {
          fontSize: '12px',
          color: '#888888',
          fontFamily: 'Arial',
        })
        .setOrigin(0.5);
    }
    const totalCount = getConstellationCount();
    this.instructionsText.setText(
      `[${this.currentIndex + 1}/${totalCount}] Click/tap to cycle through constellations · ESC to return to menu`
    );
  }

  private setupControls(): void {
    // Keyboard controls
    this.input.keyboard?.on('keydown-LEFT', () => this.previousConstellation());
    this.input.keyboard?.on('keydown-RIGHT', () => this.nextConstellation());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'));

    // Mouse/touch controls
    this.input.on('pointerdown', () => this.nextConstellation());
  }

  private nextConstellation(): void {
    const totalCount = getConstellationCount();
    this.currentIndex = (this.currentIndex + 1) % totalCount;
    this.showConstellation(this.currentIndex);
  }

  private previousConstellation(): void {
    const totalCount = getConstellationCount();
    this.currentIndex = (this.currentIndex - 1 + totalCount) % totalCount;
    this.showConstellation(this.currentIndex);
  }

  private refreshLayout(): void {
    this.scene.restart();
  }
}
