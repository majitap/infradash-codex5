"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useOperations } from "./operations-provider";
import { kstTime } from "@/lib/operations";

export function AdminView() {
  const ops = useOperations();
  const { maintenance, configured, adminMode } = ops;
  return (
    <div className="ops-stack">
      <section className="ops-panel admin-mode-panel">
        <div>
          <p className="ops-eyebrow">WORKSPACE ACCESS</p>
          <h2>필요할 때만, 관리자 모드</h2>
          <p>운영 상태를 확인하고 변경 사항을 신중하게 적용하세요.</p>
          <span className="ops-tag">
            {configured
              ? ops.session
                ? `${ops.session.actor.name} · ${ops.session.actor.role === "admin" ? "관리자" : "조회 전용"}`
                : "인증 대기"
              : "데모 워크스페이스"}{" "}
            · 최대 15분
          </span>
        </div>
        <div className="admin-mode-action">
          <ShieldCheck size={32} strokeWidth={1.4} />
          <strong>{adminMode ? "관리자 모드 사용 중" : "조회 모드"}</strong>
          <button
            className={adminMode ? "ops-button" : "ops-button primary"}
            onClick={adminMode ? ops.exitAdmin : ops.enterAdmin}
          >
            {adminMode
              ? "관리자 모드 종료"
              : configured
                ? "관리자 모드 시작"
                : "데모 관리자 모드 시작"}
          </button>
        </div>
      </section>
      {!configured && (
        <p className="ops-notice">
          현재는 데모입니다. 변경은 새로고침하면 초기화되며 실제 GitLab에
          적용되지 않습니다.
        </p>
      )}
      {ops.error && (
        <div className="ops-notice error" role="alert">
          {ops.error}
          <button className="ops-text-link" onClick={() => void ops.refresh()}>
            다시 조회
          </button>
        </div>
      )}
      <MaintenanceForm key={maintenance?.revision ?? "unknown"} />
      <div className="ops-two-columns">
        <section className="ops-panel">
          <div className="ops-panel-heading">
            <h2>이 세션의 변경 기록</h2>
            <span className="ops-muted">{ops.audit.length}건</span>
          </div>
          {ops.audit.length === 0 ? (
            <div className="ops-empty compact">
              <p>아직 변경한 설정이 없어요.</p>
              <span>메인터넌스 설정을 적용하면 이곳에 표시됩니다.</span>
            </div>
          ) : (
            <ol className="ops-audit">
              {ops.audit.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.action}</strong>
                    <span className="ops-tag">
                      {item.source === "demo" ? "데모" : "실제 변경"}
                    </span>
                  </div>
                  <p>{item.reason}</p>
                  <time>{kstTime(item.at)}</time>
                </li>
              ))}
            </ol>
          )}
          <p className="ops-footnote">
            브라우저 세션 기록입니다. 실제 변경의 감사 기록은 운영 API 서버에
            별도 보관됩니다.
          </p>
        </section>
        <section className="ops-panel">
          <h2>워크스페이스 관리</h2>
          <div className="ops-resource-links">
            <Link href="/admin/license">
              <div>
                <strong>라이선스</strong>
                <span>보유 좌석과 사용량, 만료일</span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
            <Link href="/admin/integrations">
              <div>
                <strong>연동 설정</strong>
                <span>GitLab API와 LGTM 연결 상태</span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
            <Link href="/upgrade">
              <div>
                <strong>버전 업그레이드</strong>
                <span>업그레이드 경로와 점검 항목</span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
function MaintenanceForm() {
  const {
    maintenance,
    configured,
    adminMode,
    saving,
    loading,
    applyMaintenance,
    refresh,
  } = useOperations();
  const [enabled, setEnabled] = useState(maintenance?.enabled ?? false),
    [message, setMessage] = useState(maintenance?.message ?? ""),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState<string | null>(null);
  const editable =
    adminMode &&
    !loading &&
    !!maintenance &&
    (!configured || maintenance.canWrite);
  const changed =
    maintenance &&
    (maintenance.enabled !== enabled || maintenance.message !== message.trim());
  async function apply() {
    setError(null);
    try {
      await applyMaintenance(enabled, message.trim(), reason.trim());
      setConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설정을 적용하지 못했습니다.");
      setConfirm(false);
    }
  }
  return (
    <section className="ops-panel maintenance-panel">
      <div className="ops-panel-heading">
        <div>
          <p className="ops-eyebrow">GITLAB SELF-MANAGED</p>
          <h2>메인터넌스 모드</h2>
        </div>
        <span className={maintenance?.enabled ? "ops-tag warning" : "ops-tag"}>
          {!maintenance
            ? "상태 확인 불가"
            : maintenance.source === "demo"
              ? `데모 · ${maintenance.enabled ? "켜짐" : "꺼짐"}`
              : maintenance.enabled
                ? "켜짐"
                : "꺼짐"}
        </span>
      </div>
      <p className="ops-description">
        점검 중 Git push, 머지 요청 생성 등 대부분의 쓰기 작업을 제한합니다.
        조회는 유지되며, 이미 실행 중인 작업은 계속될 수 있습니다.
      </p>
      <div className="maintenance-toggle-row">
        <div>
          <strong>메인터넌스 사용</strong>
          <p>
            {enabled
              ? "쓰기 작업을 제한하도록 설정합니다."
              : "일반 운영 상태로 설정합니다."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="GitLab 메인터넌스 사용"
          className="ops-switch"
          disabled={!editable || saving}
          onClick={() => setEnabled(!enabled)}
        >
          <span />
        </button>
      </div>
      <div className="ops-form-grid">
        <label>
          사용자에게 표시할 메시지
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!editable || saving}
            rows={3}
            maxLength={500}
            placeholder="점검 사유와 예상 종료 시간을 안내해 주세요."
          />
          <span className="ops-field-hint">
            최대 500자 · {message.length}/500
          </span>
        </label>
        <label>
          변경 사유
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!editable || saving}
            maxLength={240}
            placeholder="예: 정기 업데이트를 위한 점검"
          />
          <span className="ops-field-hint">
            감사 기록에 남길 사유를 3자 이상 입력하세요.
          </span>
        </label>
      </div>
      {error && (
        <p className="ops-notice error" role="alert">
          {error}
        </p>
      )}
      <div className="ops-form-footer">
        <p>
          {!adminMode
            ? "관리자 모드를 시작하면 설정을 변경할 수 있습니다."
            : !editable
              ? "운영 API의 읽기·쓰기 권한과 감사 기록 설정이 필요합니다."
              : configured
                ? "GitLab Premium / Ultimate · 관리자 권한 필요"
                : "데모 설정만 변경합니다. 실제 인프라에는 영향이 없습니다."}
        </p>
        <div className="ops-inline">
          {configured && (
            <button
              className="ops-button subtle"
              onClick={() => void refresh()}
              disabled={saving}
            >
              상태 재조회
            </button>
          )}
          <button
            className="ops-button primary"
            disabled={
              !editable || !changed || reason.trim().length < 3 || saving
            }
            onClick={() => setConfirm(true)}
          >
            {saving ? "적용 확인 중…" : "변경 검토"}
          </button>
        </div>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={(value) => {
          if (!saving) setConfirm(value);
        }}
      >
        <DialogContent className="ops-dialog" showCloseButton={!saving}>
          <DialogTitle>
            {enabled
              ? "메인터넌스 모드를 켤까요?"
              : "메인터넌스 설정을 변경할까요?"}
          </DialogTitle>
          <DialogDescription>
            {configured
              ? "실제 GitLab에 적용되는 변경입니다."
              : "이 브라우저의 데모 설정에만 적용합니다."}
          </DialogDescription>
          <div className="ops-confirm-summary">
            <span>변경 후 상태</span>
            <strong>{enabled ? "메인터넌스 켜짐" : "메인터넌스 꺼짐"}</strong>
            <span>변경 사유</span>
            <p>{reason}</p>
            <span>안내 메시지</span>
            <p>{message.trim() || "메시지 없음"}</p>
          </div>
          <p className="ops-description">
            {enabled
              ? "대부분의 쓰기 작업이 제한됩니다. 작업 중인 사용자에게 점검 일정을 먼저 공유해 주세요."
              : "모드를 끄면 GitLab 쓰기 작업을 다시 허용합니다."}
          </p>
          <div className="ops-inline ops-dialog-actions">
            <button
              className="ops-button"
              disabled={saving}
              onClick={() => setConfirm(false)}
            >
              취소
            </button>
            <button
              className="ops-button primary"
              disabled={saving || !editable}
              onClick={() => void apply()}
            >
              {saving
                ? "확인 중…"
                : configured
                  ? "실제 GitLab에 적용"
                  : "데모에 적용"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
