import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
spawnSync("pnpm -F noname... build", {
	shell: true,
	stdio: "inherit",
});

spawnSync("pnpm -F ./packages/extension/** build", {
	shell: true,
	stdio: "inherit",
});

console.log("合并打包结果");
await fs.rm("dist", { recursive: true, force: true });
await fs.mkdir("dist", { recursive: true });
// 先复制构建产物（较小），再移动大型静态资源（避免复制导致磁盘空间翻倍）
await fs.cp("apps/core/dist", "dist", { recursive: true });
await Promise.all([
	fs.rename("apps/core/audio", "dist/audio"),
	fs.rename("apps/core/image", "dist/image"),
	fs.rename("apps/core/extension", "dist/extension"),
	fs.cp("docs", "dist/docs", { recursive: true }),
	fs.cp(".nomedia", "dist/.nomedia"),
	fs.cp("LICENSE", "dist/LICENSE"),
	fs.cp("README.md", "dist/README.md")
]);
