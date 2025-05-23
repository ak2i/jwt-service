#!/usr/bin/env -S deno run --allow-env --allow-read --allow-run

/**
 * JWT Serviceノード情報JSON生成ツール
 *
 * 使用方法:
 *   - AWS ECS用:   deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts aws-ecs [引数]
 *   - Fly.io用:    deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts flyio [引数]
 *   - Cloud Run用: deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts cloud-run [引数]
 *
 * 詳細なヘルプ:
 *   deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts help
 */

async function main() {
  const args = Deno.args;

  if (args.length === 0 || args[0] === "help") {
    printHelp();
    return;
  }

  const deploymentType = args[0];
  const deploymentArgs = args.slice(1);

  try {
    let scriptPath = "";

    switch (deploymentType) {
      case "aws-ecs":
        scriptPath = "./generate-nodes-json/aws-ecs.ts";
        break;
      case "flyio":
        scriptPath = "./generate-nodes-json/flyio.ts";
        break;
      case "cloud-run":
        scriptPath = "./generate-nodes-json/cloud-run.ts";
        break;
      default:
        throw new Error(`不明なデプロイタイプ: ${deploymentType}`);
    }

    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "--allow-env", "--allow-net", scriptPath, ...deploymentArgs],
      stdout: "piped",
      stderr: "piped",
    });

    const { stdout, stderr, code } = await command.output();

    if (code !== 0) {
      throw new Error(new TextDecoder().decode(stderr));
    }

    console.log(new TextDecoder().decode(stdout));
  } catch (error) {
    console.error("Error:", error.message);
    Deno.exit(1);
  }
}

function printHelp() {
  console.log(`
JWT Serviceノード情報JSON生成ツール

使用方法:
  deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts <デプロイタイプ> [引数]

デプロイタイプ:
  aws-ecs    - AWS ECSデプロイ用のJSON生成
  flyio      - Fly.ioデプロイ用のJSON生成
  cloud-run  - Google Cloud Runデプロイ用のJSON生成
  help       - このヘルプメッセージを表示

例:
  # AWS ECS用のJSON生成
  deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts aws-ecs --region ap-northeast-1,us-west-2 --host-prefix jwt-service-ecs --count 2

  # Fly.io用のJSON生成
  deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts flyio --region nrt,fra,syd --host jwt-service.fly.dev

  # Google Cloud Run用のJSON生成
  deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts cloud-run --region us-central1,asia-northeast1 --host-template jwt-service-REGION.run.app

詳細なオプションについては、各デプロイタイプのヘルプを参照してください:
  deno run --allow-env cli/generate-nodes-json/aws-ecs.ts --help
  deno run --allow-env cli/generate-nodes-json/flyio.ts --help
  deno run --allow-env cli/generate-nodes-json/cloud-run.ts --help
`);
}

if (import.meta.main) {
  main();
}
