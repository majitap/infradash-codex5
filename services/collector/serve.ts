import { startServer } from "./server";
try {
  startServer();
} catch {
  console.error(
    "수집기 설정이 올바르지 않습니다. 인증 정보는 출력하지 않습니다.",
  );
  process.exitCode = 1;
}
