"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  infraSnapshotSchema,
  isStale,
  type InfraSnapshot,
} from "@/lib/infra-status";

export function useInfraStatus() {
  // This is a non-secret URL to a protected, read-only API. Credentials never enter the browser bundle.
  const endpoint = process.env.NEXT_PUBLIC_INFRA_STATUS_URL ?? "";
  const [snapshot, setSnapshot] = useState<InfraSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (!endpoint || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.protocol !== "https:" &&
          !(
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1"].includes(url.hostname)
          ))
      )
        throw new Error("configuration");
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setError(
          response.status === 401 || response.status === 403
            ? "접근 권한 또는 SSO 로그인을 확인해 주세요."
            : "수집기 응답을 확인하지 못했어요. 정상 여부를 판정할 수 없습니다.",
        );
        return;
      }
      const data = infraSnapshotSchema.parse(await response.json());
      if (active.current !== controller) return;
      setSnapshot(data);
      setStale(isStale(data));
      setError(null);
    } catch {
      if (active.current === controller)
        setError(
          "수집기에 연결할 수 없거나 응답 형식이 올바르지 않아요. 정상 여부를 판정할 수 없습니다.",
        );
    } finally {
      clearTimeout(timer);
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
  }, [endpoint]);
  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const poll = setInterval(() => void refresh(), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);
  useEffect(() => {
    if (!snapshot) return;
    const timer = setInterval(() => setStale(isStale(snapshot)), 5_000);
    return () => clearInterval(timer);
  }, [snapshot]);
  return { configured: !!endpoint, snapshot, loading, stale, error, refresh };
}
