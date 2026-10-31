"use client";
import { Check, Clock3, LoaderCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { stageLabel } from "@/lib/localization";
import type { RecentPipeline } from "@/lib/mock-data";
import { pipelineStatus } from "./pipeline-status";
export function PipelineDetail({
  pipeline,
  onClose,
}: {
  pipeline: RecentPipeline | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={pipeline !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="pipeline-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>파이프라인 #{pipeline?.id}</DialogTitle>
          <DialogDescription>
            {pipeline?.project} · {pipeline?.ref}
          </DialogDescription>
        </DialogHeader>
        {pipeline && (
          <>
            <div className="pipeline-detail-status">
              <span className={`pipeline-status ${pipeline.status}`}>
                {pipelineStatus[pipeline.status].label}
              </span>
              <span>
                실행 시간 {Math.floor(pipeline.durationSeconds / 60)}분{" "}
                {pipeline.durationSeconds % 60}초
              </span>
            </div>
            <dl className="pipeline-detail-meta">
              <div>
                <dt>실행자</dt>
                <dd>{pipeline.triggeredBy.name}</dd>
              </div>
              <div>
                <dt>시작 시간</dt>
                <dd>{pipeline.startedAt.replace("T", " ").slice(0, 16)}</dd>
              </div>
            </dl>
            <div className="pipeline-stage-list">
              {(["build", "test", "lint", "security", "deploy"] as const).map(
                (stage, i) => {
                  const failed = pipeline.failedStage === stage;
                  const failedIndex = (
                    ["build", "test", "lint", "security", "deploy"] as const
                  ).findIndex((s) => s === pipeline.failedStage);
                  const waiting =
                    pipeline.status === "canceled" ||
                    pipeline.status === "pending" ||
                    (pipeline.status === "failed" && i > failedIndex) ||
                    (pipeline.status === "running" && i > 1);
                  return (
                    <div key={stage}>
                      <span
                        className={
                          failed ? "failed" : waiting ? "waiting" : "success"
                        }
                      >
                        {failed ? (
                          <X size={16} />
                        ) : waiting ? (
                          <Clock3 size={16} />
                        ) : pipeline.status === "running" && i === 1 ? (
                          <LoaderCircle size={16} />
                        ) : (
                          <Check size={16} />
                        )}
                      </span>
                      <strong>{stageLabel(stage)}</strong>
                      <span>
                        {failed
                          ? "실패"
                          : waiting
                            ? "대기"
                            : pipeline.status === "running" && i === 1
                              ? "실행 중"
                              : "완료"}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
            <p className="detail-note">
              데모 실행 내역입니다. 실제 로그와 재실행은 연결되어 있지 않습니다.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
