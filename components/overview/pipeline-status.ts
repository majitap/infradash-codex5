import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  X,
} from "lucide-react";
export const pipelineStatus = {
  success: { label: "성공", icon: CheckCircle2 },
  failed: { label: "실패", icon: CircleAlert },
  running: { label: "실행 중", icon: LoaderCircle },
  pending: { label: "대기", icon: Clock3 },
  canceled: { label: "취소", icon: X },
};
