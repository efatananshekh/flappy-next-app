"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

type GameStatus = "ready" | "playing" | "paused" | "gameover";

type GameApi = {
  flap: () => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
};

type SceneData = {
  onScore: (score: number) => void;
  onStatus: (status: GameStatus) => void;
};

const WORLD_WIDTH = 480;
const WORLD_HEIGHT = 720;
const PIPE_WIDTH = 78;
const GAP_SIZE = 188;
const BIRD_X = 120;

export default function FlappyGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const apiRef = useRef<GameApi | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [status, setStatus] = useState<GameStatus>("ready");

  useEffect(() => {
    const storedBest = Number(localStorage.getItem("flappy-best-score") ?? "0");
    setBest(Number.isFinite(storedBest) ? storedBest : 0);
  }, []);

  useEffect(() => {
    let active = true;

    async function mountGame() {
      const Phaser = await import("phaser");

      if (!active || !containerRef.current || gameRef.current) {
        return;
      }

      class FlappyScene extends Phaser.Scene {
        private bird!: import("phaser").Types.Physics.Arcade.SpriteWithDynamicBody;
        private pipes!: import("phaser").Physics.Arcade.Group;
        private ground!: import("phaser").GameObjects.TileSprite;
        private clouds: import("phaser").GameObjects.Ellipse[] = [];
        private score = 0;
        private gameStatus: GameStatus = "ready";
        private pipeSpeed = 190;
        private spawnTimer = 0;
        private readonly callbacks: SceneData;

        constructor() {
          super("flappy-scene");
          this.callbacks = {
            onScore: setScore,
            onStatus: setStatus,
          };
        }

        preload() {
          this.createTextures();
        }

        create() {
          this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT - 62);
          this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x87d9f7).setOrigin(0);
          this.add.rectangle(0, 500, WORLD_WIDTH, 220, 0xb9e3a3).setOrigin(0);
          this.add.rectangle(0, 545, WORLD_WIDTH, 175, 0x69bd75).setOrigin(0);

          this.clouds = [
            this.add.ellipse(92, 122, 126, 36, 0xffffff, 0.68),
            this.add.ellipse(320, 86, 154, 42, 0xffffff, 0.5),
            this.add.ellipse(420, 182, 106, 32, 0xffffff, 0.48),
          ];

          this.pipes = this.physics.add.group({ allowGravity: false, immovable: true });

          this.ground = this.add
            .tileSprite(0, WORLD_HEIGHT - 62, WORLD_WIDTH, 62, "ground")
            .setOrigin(0);
          this.physics.add.existing(this.ground, true);

          this.bird = this.physics.add.sprite(BIRD_X, 310, "bird");
          this.bird.setCircle(21, 7, 6);
          this.bird.setCollideWorldBounds(true);
          this.bird.setGravityY(860);
          this.bird.setVelocityY(0);
          this.bird.body.allowGravity = false;

          this.physics.add.collider(this.bird, this.pipes, this.endRun, undefined, this);
          this.physics.add.collider(this.bird, this.ground, this.endRun, undefined, this);

          this.input.on("pointerdown", () => this.flap());
          this.input.keyboard?.on("keydown-SPACE", () => this.flap());
          this.input.keyboard?.on("keydown-UP", () => this.flap());
          this.input.keyboard?.on("keydown-R", () => this.restartRun());
          this.input.keyboard?.on("keydown-P", () => this.togglePause());

          apiRef.current = {
            flap: () => this.flap(),
            restart: () => this.restartRun(),
            pause: () => this.pauseRun(),
            resume: () => this.resumeRun(),
          };

          this.setStatus("ready");
        }

        update(_: number, delta: number) {
          const seconds = delta / 1000;

          this.clouds.forEach((cloud, index) => {
            cloud.x -= (12 + index * 4) * seconds;
            if (cloud.x < -90) {
              cloud.x = WORLD_WIDTH + 90;
            }
          });

          if (this.gameStatus !== "playing") {
            this.bird.rotation = Math.sin(this.time.now / 240) * 0.08;
            return;
          }

          this.spawnTimer -= delta;
          this.ground.tilePositionX += this.pipeSpeed * seconds;
          this.pipeSpeed = Math.min(300, 190 + this.score * 4.5);

          if (this.spawnTimer <= 0) {
            this.spawnPipePair();
            this.spawnTimer = 1320;
          }

          Array.from(this.pipes.children).forEach((child) => {
            const pipe = child as import("phaser").Physics.Arcade.Image & { scored?: boolean };
            pipe.x -= this.pipeSpeed * seconds;

            if (!pipe.scored && pipe.getData("scorePipe") && pipe.x + PIPE_WIDTH / 2 < BIRD_X) {
              pipe.scored = true;
              this.setScore(this.score + 1);
            }

            if (pipe.x < -PIPE_WIDTH) {
              pipe.destroy();
            }

          });

          this.bird.rotation = Phaser.Math.Clamp(this.bird.body.velocity.y / 440, -0.48, 1.04);

          if (this.bird.y < 8 || this.bird.y > WORLD_HEIGHT - 78) {
            this.endRun();
          }
        }

        private createTextures() {
          const birdTexture = this.make.graphics({ x: 0, y: 0 });
          birdTexture.fillStyle(0xffd447, 1);
          birdTexture.fillEllipse(30, 28, 48, 38);
          birdTexture.fillStyle(0xff8f3d, 1);
          birdTexture.fillEllipse(18, 33, 24, 20);
          birdTexture.fillStyle(0xffffff, 1);
          birdTexture.fillCircle(43, 20, 9);
          birdTexture.fillStyle(0x1f2a44, 1);
          birdTexture.fillCircle(46, 20, 4);
          birdTexture.fillStyle(0xf45d48, 1);
          birdTexture.fillTriangle(54, 27, 68, 21, 68, 33);
          birdTexture.generateTexture("bird", 76, 58);
          birdTexture.destroy();

          const pipeTexture = this.make.graphics({ x: 0, y: 0 });
          pipeTexture.fillStyle(0x2aae64, 1);
          pipeTexture.fillRoundedRect(10, 0, 58, 320, 8);
          pipeTexture.fillStyle(0x49d17e, 1);
          pipeTexture.fillRoundedRect(0, 0, 78, 34, 8);
          pipeTexture.fillStyle(0x197547, 1);
          pipeTexture.fillRect(58, 34, 10, 286);
          pipeTexture.lineStyle(3, 0x14623d, 1);
          pipeTexture.strokeRoundedRect(1.5, 1.5, 75, 31, 7);
          pipeTexture.generateTexture("pipe", PIPE_WIDTH, 320);
          pipeTexture.destroy();

          const groundTexture = this.make.graphics({ x: 0, y: 0 });
          groundTexture.fillStyle(0xe7c575, 1);
          groundTexture.fillRect(0, 0, 96, 62);
          groundTexture.fillStyle(0x97c765, 1);
          groundTexture.fillRect(0, 0, 96, 16);
          groundTexture.fillStyle(0xc69b4e, 1);
          for (let i = 0; i < 96; i += 24) {
            groundTexture.fillRect(i, 32, 12, 4);
          }
          groundTexture.generateTexture("ground", 96, 62);
          groundTexture.destroy();
        }

        private startRun() {
          this.score = 0;
          this.pipeSpeed = 190;
          this.spawnTimer = 200;
          this.pipes.clear(true, true);
          this.bird.setPosition(BIRD_X, 310);
          this.bird.setVelocity(0, -330);
          this.bird.body.allowGravity = true;
          this.setScore(0);
          this.setStatus("playing");
        }

        private restartRun() {
          if (this.scene.isPaused()) {
            this.scene.resume();
          }

          this.startRun();
        }

        private flap() {
          if (this.gameStatus === "ready" || this.gameStatus === "gameover") {
            this.startRun();
            return;
          }

          if (this.gameStatus !== "playing") {
            return;
          }

          this.bird.setVelocityY(-345);
          this.tweens.add({
            targets: this.bird,
            y: this.bird.y - 2,
            duration: 70,
            yoyo: true,
          });
        }

        private togglePause() {
          if (this.gameStatus === "paused") {
            this.resumeRun();
          } else {
            this.pauseRun();
          }
        }

        private pauseRun() {
          if (this.gameStatus !== "playing") {
            return;
          }

          this.setStatus("paused");
          this.scene.pause();
        }

        private resumeRun() {
          if (this.gameStatus !== "paused") {
            return;
          }

          this.setStatus("playing");
          this.scene.resume();
        }

        private endRun() {
          if (this.gameStatus !== "playing") {
            return;
          }

          this.bird.setVelocityY(140);
          this.bird.body.allowGravity = false;
          this.setStatus("gameover");
          Array.from(this.pipes.children).forEach((child) => {
            const pipe = child as import("phaser").Physics.Arcade.Image;
            pipe.setVelocityX(0);
          });
        }

        private spawnPipePair() {
          const gapCenter = Phaser.Math.Between(168, WORLD_HEIGHT - 230);
          const topY = gapCenter - GAP_SIZE / 2 - 160;
          const bottomY = gapCenter + GAP_SIZE / 2 + 160;
          const topPipe = this.pipes.create(WORLD_WIDTH + PIPE_WIDTH, topY, "pipe") as import("phaser").Physics.Arcade.Image;
          const bottomPipe = this.pipes.create(WORLD_WIDTH + PIPE_WIDTH, bottomY, "pipe") as import("phaser").Physics.Arcade.Image;

          topPipe.setFlipY(true);
          topPipe.setData("scorePipe", true);
          bottomPipe.setData("scorePipe", false);

          [topPipe, bottomPipe].forEach((pipe) => {
            pipe.setImmovable(true);
            pipe.refreshBody();
          });
        }

        private setScore(nextScore: number) {
          this.score = nextScore;
          this.callbacks.onScore(nextScore);

          const currentBest = Number(localStorage.getItem("flappy-best-score") ?? "0");
          if (nextScore > currentBest) {
            localStorage.setItem("flappy-best-score", String(nextScore));
            setBest(nextScore);
          }
        }

        private setStatus(nextStatus: GameStatus) {
          this.gameStatus = nextStatus;
          this.callbacks.onStatus(nextStatus);
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        backgroundColor: "#87d9f7",
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        physics: {
          default: "arcade",
          arcade: {
            gravity: { y: 0, x: 0 },
            debug: false,
          },
        },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
        },
        scene: FlappyScene,
      });
    }

    mountGame();

    return () => {
      active = false;
      apiRef.current = null;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const helperText =
    status === "ready"
      ? "Tap, click, or press Space to start."
      : status === "gameover"
        ? "Run ended. Restart and beat your best."
        : status === "paused"
          ? "Paused."
          : "Stay between the pipes.";

  return (
    <section className="min-h-dvh w-full bg-[#f8fbf8] text-slate-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-4 md:grid md:grid-cols-[280px_1fr] md:items-center md:gap-6 md:px-6">
        <aside className="flex flex-col gap-4 md:gap-5">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">Flappy Next</p>
            <h1 className="mt-1 text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">
              Fly the gap.
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Score</p>
              <p className="mt-1 text-4xl font-black tabular-nums text-slate-950">{score}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-slate-500">Best</p>
              <p className="mt-1 text-4xl font-black tabular-nums text-slate-950">{best}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Restart game"
              title="Restart game"
              onClick={() => apiRef.current?.restart()}
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <RotateCcw size={20} />
            </button>
            <button
              type="button"
              aria-label={status === "paused" ? "Resume game" : "Pause game"}
              title={status === "paused" ? "Resume game" : "Pause game"}
              onClick={() =>
                status === "paused" ? apiRef.current?.resume() : apiRef.current?.pause()
              }
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-950 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {status === "paused" ? <Play size={20} /> : <Pause size={20} />}
            </button>
            <div className="min-w-0 pl-2">
              <p className="text-sm font-semibold capitalize text-slate-900">{status}</p>
              <p className="text-sm leading-5 text-slate-600">{helperText}</p>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-[520px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-[#d9f4ff] shadow-xl md:min-h-[calc(100dvh-3rem)]">
          <div ref={containerRef} className="h-full min-h-[520px] w-full" />
          <button
            type="button"
            onClick={() => apiRef.current?.flap()}
            aria-label="Flap"
            className="absolute inset-0 cursor-pointer bg-transparent focus:outline-none"
          />
          {status !== "playing" && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 w-[min(84%,320px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/60 bg-white/88 px-5 py-4 text-center shadow-lg backdrop-blur">
              <p className="text-xl font-black text-slate-950">
                {status === "gameover" ? "Game over" : status === "paused" ? "Paused" : "Ready"}
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-700">{helperText}</p>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
