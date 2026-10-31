export type CollectorConfig = {
  gitlabBaseUrl?: string;
  gitlabReadToken?: string;
  awsRegion?: string;
  eksClusterName?: string;
  kubeContext?: string;
  namespaces: string[];
  components: string[];
  timeoutMs: number;
};
export function readConfig(
  env: Record<string, string | undefined> = process.env,
): CollectorConfig {
  const base = env.GITLAB_BASE_URL?.trim().replace(/\/+$/, "");
  if (base) {
    const url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error(
        "GITLAB_BASE_URL must be an HTTPS URL without credentials, query, or fragment",
      );
  }
  const namespaces = [
    ...new Set(
      (env.KUBE_NAMESPACES ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (
    namespaces.length > 10 ||
    namespaces.some(
      (n) => n.length > 63 || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(n),
    )
  )
    throw new Error(
      "KUBE_NAMESPACES must contain valid Kubernetes namespaces (maximum 10)",
    );
  const components = [
    ...new Set(
      (env.KUBE_COMPONENTS ?? "webservice,gitaly")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (
    !components.length ||
    components.length > 20 ||
    components.some((c) => !/^[a-z0-9][a-z0-9-]{0,63}$/.test(c))
  )
    throw new Error("KUBE_COMPONENTS must contain workload component names");
  const context = env.KUBE_CONTEXT?.trim();
  if (
    context &&
    (!/^[\w.@:/-]{1,256}$/.test(context) || context.startsWith("-"))
  )
    throw new Error("KUBE_CONTEXT is invalid");
  return {
    gitlabBaseUrl: base || undefined,
    gitlabReadToken: env.GITLAB_READ_TOKEN?.trim() || undefined,
    awsRegion: env.AWS_REGION?.trim(),
    eksClusterName: env.EKS_CLUSTER_NAME?.trim(),
    kubeContext: context,
    namespaces,
    components,
    timeoutMs: 5000,
  };
}
