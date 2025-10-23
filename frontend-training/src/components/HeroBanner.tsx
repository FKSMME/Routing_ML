import type { NavigationKey } from "@store/workspaceStore";
import type { CSSProperties } from "react";

import heroImage from "../../../main/4.jpg";

interface HeroBannerProps {
  activeMenu: NavigationKey;
  onNavigate: (menuId: NavigationKey) => void;
}

export function HeroBanner({ activeMenu, onNavigate }: HeroBannerProps) {
  const backgroundStyle: CSSProperties = {
    backgroundImage: [
      "linear-gradient(115deg, color-mix(in oklch, var(--gradient-start) 88%, transparent) 0%, color-mix(in oklch, var(--surface-overlay) 96%, transparent) 38%, color-mix(in oklch, var(--surface-card) 94%, transparent) 100%)",
      "linear-gradient(115deg, color-mix(in oklch, var(--accent-soft) 45%, transparent) 0%, transparent 60%)",
      `url(${heroImage})`,
    ].join(", "),
  };

  const handleNavigate = (menuId: NavigationKey) => () => onNavigate(menuId);

  return (
    <section className="hero-banner" style={backgroundStyle} aria-label="Routing ML hero banner">
      <div className="hero-banner__content">
        <span className="hero-banner__badge">Routing ML · 실시간 협업</span>
        <h1 className="hero-banner__title">
          제조 라우팅을 더 빠르고, 더 정확하게
        </h1>
        <p className="hero-banner__lead">
          후보 공정 추천부터 ERP 연동까지 하나의 워크스페이스에서 처리하세요. 팀 전체가 동일한
          데이터와 시각화를 공유하고, 변경 이력은 자동으로 추적됩니다.
        </p>
        <div className="hero-banner__actions">
          <button
            type="button"
            className="hero-banner__cta hero-banner__cta--primary"
            data-active={activeMenu === "routing" ? "true" : undefined}
            onClick={handleNavigate("routing")}
          >
            라우팅 생성 살펴보기
          </button>
          <button
            type="button"
            className="hero-banner__cta hero-banner__cta--ghost"
            data-active={activeMenu === "master-data" ? "true" : undefined}
            onClick={handleNavigate("master-data")}
          >
            기준정보 워크스페이스
          </button>
        </div>
        <dl className="hero-banner__stats">
          <div>
            <dt>평균 생성 시간</dt>
            <dd>약 3분 → 45초</dd>
          </div>
          <div>
            <dt>추천 정확도</dt>
            <dd>92% Top-3</dd>
          </div>
          <div>
            <dt>자동화 커버리지</dt>
            <dd>40+ 공정 유형</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
