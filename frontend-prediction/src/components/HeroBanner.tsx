import type { CSSProperties } from "react";

import type { NavigationKey } from "@store/workspaceStore";

import ModelViewer from "./ModelViewer";
import heroImage from "../../../main/4.jpg";

interface HeroBannerProps {
  activeMenu: NavigationKey;
  onNavigate: (menuId: NavigationKey) => void;
}

const DEFAULT_MODEL_URL = "/models/background.glb";

export function HeroBanner({ activeMenu, onNavigate }: HeroBannerProps) {
  const heroModelUrl = import.meta.env.VITE_HERO_MODEL_URL ?? DEFAULT_MODEL_URL;

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
      <div className="hero-banner__layout">
        <div className="hero-banner__content">
          <span className="hero-banner__badge">Routing ML 를 위한 워크플로우</span>
          <h1 className="hero-banner__title">생산 계획부터 라우팅까지, 더 정확하게</h1>
          <p className="hero-banner__lead">
            추천 라우팅과 ERP 데이터를 하나의 캔버스에서 처리하세요. 모델 기반 추천과 상세 지표를 실시간으로 확인하고, 팀과 공유할 수 있습니다.
          </p>
          <div className="hero-banner__actions">
            <button
              type="button"
              className="hero-banner__cta hero-banner__cta--primary"
              data-active={activeMenu === "routing" ? "true" : undefined}
              onClick={handleNavigate("routing")}
            >
              라우팅 생성 바로가기
            </button>
            <button
              type="button"
              className="hero-banner__cta hero-banner__cta--ghost"
              data-active={activeMenu === "master-data" ? "true" : undefined}
              onClick={handleNavigate("master-data")}
            >
              기준정보 대시보드
            </button>
          </div>
          <dl className="hero-banner__stats">
            <div>
              <dt>추천 소요 시간</dt>
              <dd>평균 3분 45초</dd>
            </div>
            <div>
              <dt>추천 정확도</dt>
              <dd>92% Top-3</dd>
            </div>
            <div>
              <dt>자동화 커버리지</dt>
              <dd>40+ 공정 그룹</dd>
            </div>
          </dl>
        </div>
        <div className="hero-banner__visual" aria-hidden="true">
          <ModelViewer
            url={heroModelUrl}
            width={360}
            height={360}
            enableManualRotation={false}
            enableManualZoom={false}
            enableHoverRotation={false}
            enableMouseParallax={false}
            showScreenshotButton={false}
            autoRotate
            autoRotateSpeed={0.32}
            ambientIntensity={0.4}
            keyLightIntensity={1.1}
            fillLightIntensity={0.6}
            rimLightIntensity={0.9}
          />
        </div>
      </div>
    </section>
  );
}
