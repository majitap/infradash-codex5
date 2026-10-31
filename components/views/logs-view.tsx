"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Search, RotateCcw } from "lucide-react";
import { useOperations } from "@/components/admin/operations-provider";
import { kstTime, logsSchema, type LogEntry } from "@/lib/operations";
import { filterLogs, levelNames, logBuckets, makeDemoLogs } from "@/lib/logs";

export function LogsView() {
  const { configured, integrations, api, session } = useOperations();
  const [demo, setDemo] = useState(false),
    [query, setQuery] = useState('{namespace="gitlab"}'),
    [minutes, setMinutes] = useState("15"),
    [entries, setEntries] = useState<LogEntry[]>([]),
    [range, setRange] = useState<[number, number] | null>(null),
    [service, setService] = useState("all"),
    [level, setLevel] = useState("all"),
    [text, setText] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [limited, setLimited] = useState(false),
    [queried, setQueried] = useState<string | null>(null),
    [expanded, setExpanded] = useState<string | null>(null);
  const requestId = useRef(0);
  const ready =
    configured &&
    integrations.loki &&
    session?.permissions.includes("logs:read");
  const services = Array.from(new Set(entries.map((e) => e.service))).sort();
  const filtered = filterLogs(entries, service, level, text),
    errors = entries.filter((e) => e.level === "error").length,
    warnings = entries.filter((e) => e.level === "warn").length;
  const buckets = range ? logBuckets(filtered, ...range) : [];
  const maximum = Math.max(1, ...buckets.map((b) => b.total));
  function showDemo() {
    const end = Date.now(),
      start = end - Number(minutes) * 60_000;
    requestId.current++;
    setLoading(false);
    setDemo(true);
    setEntries(makeDemoLogs(end, end - start));
    setRange([start, end]);
    setQueried(new Date(end).toISOString());
    setError(null);
    setLimited(false);
    setService("all");
    setLevel("all");
    setText("");
  }
  function leaveDemo() {
    requestId.current++;
    setLoading(false);
    setDemo(false);
    setEntries([]);
    setRange(null);
    setQueried(null);
    setError(null);
    setExpanded(null);
    setService("all");
    setLevel("all");
    setText("");
  }
  async function search() {
    if (demo) {
      showDemo();
      return;
    }
    if (!ready || loading) return;
    const id = ++requestId.current,
      end = Date.now(),
      start = end - Number(minutes) * 60_000;
    setLoading(true);
    setError(null);
    setEntries([]);
    setRange(null);
    setQueried(null);
    setExpanded(null);
    try {
      const p = new URLSearchParams({
        query,
        start: String(start),
        end: String(end),
        limit: "500",
      });
      const result = logsSchema.parse(await api(`/logs?${p}`));
      if (id !== requestId.current) return;
      setEntries(result.entries);
      setRange([start, end]);
      setLimited(result.limited);
      setQueried(result.queriedAt);
      setService("all");
      setLevel("all");
    } catch (e) {
      if (id === requestId.current)
        setError(
          e instanceof Error ? e.message : "로그를 조회하지 못했습니다.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  return (
    <div className="ops-stack logs-workspace">
      <section className="ops-panel logs-intro">
        <div>
          <p className="ops-eyebrow">OBSERVABILITY / LGTM</p>
          <h2>흩어진 로그에서, 문제의 실마리를.</h2>
          <p>Loki로 검색하고, 서비스와 심각도로 좁혀보세요.</p>
        </div>
        <div className="lgtm-status">
          {[
            ["Loki", integrations.loki],
            ["Grafana", integrations.grafana],
            ["Tempo", integrations.tempo],
            ["Mimir", integrations.mimir],
          ].map(([name, on]) => (
            <span key={String(name)}>
              <i className={on ? "ready" : ""} />
              {name}
            </span>
          ))}
        </div>
      </section>
      <div className={demo ? "ops-notice demo" : "ops-notice"}>
        <div>
          <strong>
            {demo
              ? "예시 로그를 보고 있습니다"
              : ready
                ? "Loki 조회 준비됨"
                : "LGTM 연결을 기다리고 있어요"}
          </strong>
          <p>
            {demo
              ? "96건의 모의 로그입니다. 실제 서비스 상태와 관계없습니다."
              : ready
                ? "검색은 읽기 전용이며 최대 6시간, 500건까지 조회합니다."
                : "운영 API에 Loki를 연결하면 실제 로그를 검색할 수 있습니다."}
          </p>
        </div>
        <div className="ops-inline">
          {demo ? (
            <button className="ops-button" onClick={leaveDemo}>
              예시 닫기
            </button>
          ) : (
            !ready && (
              <button className="ops-button" onClick={showDemo}>
                예시 로그로 둘러보기
              </button>
            )
          )}
          <Link className="ops-text-link" href="/admin/integrations">
            연동 설정 <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <section className="ops-panel logs-query-panel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <label htmlFor="logql-query">LogQL 쿼리</label>
          <div className="logql-query">
            <code aria-hidden="true">›</code>
            <input
              id="logql-query"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={2000}
              disabled={demo}
              aria-describedby="query-hint"
            />
            <select
              aria-label="로그 조회 기간"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            >
              <option value="15">최근 15분</option>
              <option value="60">최근 1시간</option>
              <option value="360">최근 6시간</option>
            </select>
            <button
              type="submit"
              className="ops-button primary"
              disabled={loading || (!ready && !demo) || !query.trim()}
            >
              <Search size={18} />
              {loading ? "조회 중…" : "로그 검색"}
            </button>
          </div>
          <p id="query-hint" className="ops-footnote">
            {demo
              ? "예시에서는 아래 필터를 사용해 로그를 탐색하세요. LogQL은 실제 Loki 연결 후 실행됩니다."
              : '스트림 선택자로 시작하세요. 예: {namespace="gitlab"} |= "error"'}
          </p>
        </form>
      </section>
      {error && (
        <p className="ops-notice error" role="alert">
          {error}
        </p>
      )}
      {!range ? (
        <section className="ops-panel ops-empty">
          <Search size={32} strokeWidth={1.3} />
          <h3>
            {loading ? "로그를 조회하고 있어요" : "분석할 로그를 검색해 주세요"}
          </h3>
          <p>
            {ready
              ? "쿼리와 기간을 선택하면 로그 분포와 상세 내용을 확인할 수 있습니다."
              : "Loki 연동을 준비하거나 예시 로그로 분석 화면을 체험하세요."}
          </p>
        </section>
      ) : (
        <>
          <section className="ops-panel logs-overview">
            <div className="logs-summary">
              <div>
                <span>조회된 로그{demo ? " · 예시" : ""}</span>
                <strong>
                  {entries.length.toLocaleString()}
                  <small>건</small>
                </strong>
              </div>
              <div>
                <span>오류</span>
                <strong className="ops-error-text">
                  {errors}
                  <small>건</small>
                </strong>
              </div>
              <div>
                <span>경고</span>
                <strong className="ops-warning">
                  {warnings}
                  <small>건</small>
                </strong>
              </div>
              <div>
                <span>서비스</span>
                <strong>
                  {services.length}
                  <small>개</small>
                </strong>
              </div>
            </div>
            <div
              className="log-histogram"
              role="img"
              aria-label={`필터 결과 ${filtered.length}건의 시간별 로그 분포. 오류는 보라색으로 표시됩니다.`}
            >
              {buckets.map((b, index) => (
                <div
                  key={index}
                  title={`${kstTime(new Date(range[0] + (index * (range[1] - range[0])) / 24).toISOString())} · ${b.total}건 / 오류 ${b.errors}건`}
                >
                  <span style={{ height: `${(b.total / maximum) * 100}%` }}>
                    <i
                      style={{
                        height: `${b.total ? (b.errors / b.total) * 100 : 0}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
            </div>
            <div className="log-chart-labels">
              <span>{kstTime(new Date(range[0]).toISOString())}</span>
              <span>조회 결과 내 분포 · 오류 포함</span>
              <span>{kstTime(new Date(range[1]).toISOString())}</span>
            </div>
          </section>
          <section className="ops-panel log-results">
            <div className="ops-panel-heading">
              <h2>
                로그 탐색 <span className="ops-muted">{filtered.length}건</span>
              </h2>
              <span className="ops-tag">
                {demo ? "예시 데이터" : "Loki 실제 로그"}
              </span>
            </div>
            <div className="log-filters">
              <label>
                <span>서비스</span>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value="all">전체 서비스</option>
                  {services.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>심각도</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="all">전체 심각도</option>
                  {Object.entries(levelNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="log-text-filter">
                <span>결과 내 검색</span>
                <input
                  placeholder="메시지 · 서비스 · 트레이스 ID"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <button
                className="ops-button subtle"
                aria-label="로그 필터 초기화"
                onClick={() => {
                  setService("all");
                  setLevel("all");
                  setText("");
                }}
              >
                <RotateCcw size={18} />
              </button>
            </div>
            {limited && (
              <p className="ops-notice">
                최대 500건에 도달했습니다. 더 좁은 기간이나 쿼리로 다시
                검색하세요.
              </p>
            )}
            {filtered.length === 0 ? (
              <div className="ops-empty compact">
                <h3>조건에 맞는 로그가 없어요</h3>
                <p>필터나 검색어를 조정해 보세요.</p>
              </div>
            ) : (
              <div className="log-stream">
                <div className="log-table-heading">
                  <span>시간 / 심각도</span>
                  <span>서비스</span>
                  <span>메시지</span>
                </div>
                {filtered.map((entry) => (
                  <div className="log-entry" key={entry.id}>
                    <button
                      className="log-entry-button"
                      aria-label={`${entry.service} ${levelNames[entry.level]} 로그 상세`}
                      aria-expanded={expanded === entry.id}
                      onClick={() =>
                        setExpanded(expanded === entry.id ? null : entry.id)
                      }
                    >
                      <span className="log-timestamp">
                        <time>
                          {new Intl.DateTimeFormat("ko-KR", {
                            timeZone: "Asia/Seoul",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false,
                          }).format(new Date(entry.timestamp))}
                        </time>
                        <span className={`log-level ${entry.level}`}>
                          {levelNames[entry.level]}
                        </span>
                      </span>
                      <strong>{entry.service}</strong>
                      <span className="log-line">{entry.message}</span>
                      <ChevronDown size={16} />
                    </button>
                    {expanded === entry.id && (
                      <div className="log-detail">
                        <dl>
                          <div>
                            <dt>발생 시각</dt>
                            <dd>{kstTime(entry.timestamp)}</dd>
                          </div>
                          <div>
                            <dt>트레이스 ID</dt>
                            <dd>{entry.traceId ?? "없음"}</dd>
                          </div>
                          <div>
                            <dt>레이블</dt>
                            <dd className="log-labels">
                              {Object.entries(entry.labels).map(([k, v]) => (
                                <code key={k}>
                                  {k}={v}
                                </code>
                              ))}
                            </dd>
                          </div>
                        </dl>
                        <pre>{entry.message}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="log-results-footer">
              <span>
                최근 조회 {queried && kstTime(queried)} · 결과 내 필터
              </span>
              {integrations.grafanaUrl && (
                <a
                  href={integrations.grafanaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Grafana 열기 <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
