import { mkdir, writeFile, rename } from "node:fs/promises";
import { collectStatus } from "./collect";
import { readConfig } from "./config";

async function main() {
  const snapshot = await collectStatus(readConfig());
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/infra-status.json.tmp",
    JSON.stringify(snapshot, null, 2),
    { mode: 0o600 },
  );
  await rename(".local/infra-status.json.tmp", ".local/infra-status.json");
  console.log(
    "읽기 전용 수집 결과를 .local/infra-status.json에 저장했습니다. 실제 응답은 공개 빌드에 포함하지 마세요.",
  );
}
main().catch(() => {
  console.error(
    "수집 설정을 확인해 주세요. 원본 오류와 인증 정보는 출력하지 않습니다.",
  );
  process.exitCode = 1;
});
