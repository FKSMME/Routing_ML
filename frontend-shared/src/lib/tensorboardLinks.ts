export interface TensorboardLinkItem {
  label: string;
  href: string;
  description: string;
}

const PROJECTOR_VIEWER_DESCRIPTION = "TensorBoard web viewer";
const LOCAL_DIRECTORY_DESCRIPTION = "tensorboard_projector_dir";
const PROJECTOR_CONFIG_DESCRIPTION = "TensorBoard Projector config";
const VECTORS_DESCRIPTION = "Embedding vectors (vectors.tsv)";
const METADATA_DESCRIPTION = "Metadata (metadata.tsv)";

export function buildTensorboardLinks(rawPath: string | null | undefined): TensorboardLinkItem[] {
  if (typeof rawPath !== "string") {
    return [];
  }
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const normalized = trimmed.replace(/\\/g, "/");
  const sanitized = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  const links: TensorboardLinkItem[] = [];

  if (sanitized.startsWith("http://") || sanitized.startsWith("https://")) {
    const projectorBase = `${sanitized}/data/plugin/projector`;
    links.push({
      label: "TensorBoard Projector",
      href: sanitized,
      description: PROJECTOR_VIEWER_DESCRIPTION,
    });
    links.push({
      label: "projector_config.json",
      href: `${projectorBase}/projector_config.json`,
      description: PROJECTOR_CONFIG_DESCRIPTION,
    });
    links.push({
      label: "vectors.tsv",
      href: `${projectorBase}/vectors.tsv`,
      description: VECTORS_DESCRIPTION,
    });
    links.push({
      label: "metadata.tsv",
      href: `${projectorBase}/metadata.tsv`,
      description: METADATA_DESCRIPTION,
    });
    return links;
  }

  links.push({
    label: "Projector directory",
    href: sanitized,
    description: LOCAL_DIRECTORY_DESCRIPTION,
  });
  const base = sanitized;
  links.push({
    label: "projector_config.json",
    href: `${base}/projector_config.json`,
    description: PROJECTOR_CONFIG_DESCRIPTION,
  });
  links.push({
    label: "vectors.tsv",
    href: `${base}/vectors.tsv`,
    description: VECTORS_DESCRIPTION,
  });
  links.push({
    label: "metadata.tsv",
    href: `${base}/metadata.tsv`,
    description: METADATA_DESCRIPTION,
  });
  return links;
}

