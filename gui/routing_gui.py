"""
Beautiful Tkinter GUI for FKSM Routing‑ML – **2025‑06 Korean Fixed Layout Edition**
────────────────────────────────────────────────────────────────────────────
🚀 ML 모델 최적화 버전 - Enhanced 예측 시스템
• Fixed 1400x800 layout optimized for desktop use
• 3-column layout: Control Panel | Results | Logs
• ML-based prediction with similarity weighting
• Advanced time scenario settings with real-time adjustment
• 🎯 Similarity Threshold (유사도 임계값) setting
• Modern glass-morphism design with smooth gradients
• Professional Korean typography and color scheme
• Top‑k candidates with double‑click interaction
• Real-time system monitoring with visual indicators
• 📊 Enhanced 품질 분석 기능 - ML 모델 메타데이터 포함
• ✨ NEW: Enhanced Model Manager 지원
"""

from __future__ import annotations

import logging
import threading
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import tkinter.font as tkFont
from datetime import datetime
import os
import re
import time
from typing import Dict, List, Tuple, Optional, Any
import pandas as pd
import psutil
import numpy as np
from pathlib import Path
from backend.feature_weights import FeatureWeightManager

# GUI 컴포넌트 임포트
from .gui_components import (
    safe_text, safe_log, KoreanThemeColors, SafeModernTextHandler,
    StatisticalConfigWidget, EnhancedTreeview
)

# 백엔드 모듈 - Enhanced 버전 추가
from backend.predictor_ml import (
    # Enhanced 버전 추가
    predict_single_item_with_ml_enhanced,
    EnhancedModelManager,
    validate_prediction_quality_enhanced,
    # 기존 imports
    predict_single_item_with_ml_optimized,
    predict_items_with_ml_optimized,
    TimeScenarioConfig,
    get_scenario_config,
    set_scenario_config,
    reset_scenario_config,
    filter_by_similarity_threshold,
    apply_similarity_weights,
    predict_single_item_with_ml,
    predict_items_with_ml,
)

from backend.database import (
    fetch_item_master, 
    fetch_routing_for_item, 
    fetch_single_item, 
    fetch_routings_for_items, 
    fetch_items_batch,
    check_item_has_routing,
)

from backend.trainer_ml import (
    train_model_with_ml_optimized,
    train_model_with_ml_improved,
    save_optimized_model,
    load_optimized_model,
)

from common.logger import get_logger

logger = get_logger("gui")

# ────────────────────────────────────────────────
# 🚀 Main GUI Class - KOREAN FIXED LAYOUT VERSION with Enhanced ML
# ────────────────────────────────────────────────
class RoutingGUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.is_fullscreen = False
        
        self._setup_window()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self._setup_fonts()
        
        # Model objects
        self.searcher = self.encoder = self.scaler = None
        self.feature_columns: list[str] = []
        self.feature_manager = None
        self.model_dir: str | None = None
        self.stop_training = threading.Event()
        
        # Enhanced model support
        self.model_manager: Optional[EnhancedModelManager] = None
        self.current_model_info: Dict[str, Any] = {}  # 추가: 모델 정보 저장

        # Current results
        self.current_routing: pd.DataFrame = pd.DataFrame()
        self.current_candidates: pd.DataFrame = pd.DataFrame()

        # UI variables
        self.topk_var = tk.IntVar(value=20)
        self.prediction_mode_var = tk.StringVar(value="detailed")
        self.routing_selection_var = tk.StringVar(value="latest")
        self.similarity_threshold_var = tk.DoubleVar(value=0.3)
        self.training_progress = 0
        
        # 성능 개선을 위한 추가 변수들
        self.is_processing = False
        self.current_progress_task = None
        self.progressive_results = {}
        self.last_click_time = 0  # 더블클릭 디바운싱용
        
        # Enhanced Treeview objects
        self.enhanced_routing_table = None
        self.enhanced_candidate_table = None

        # 고정 레이아웃 빌드
        self._build_fixed_layout()
        self._install_log_handler()
        self._start_resource_monitoring()
        
        # 전체 화면 단축키 바인딩
        self._bind_fullscreen_keys()
        
        # 초기 모드 설정
        self._on_mode_change()

    def _setup_window(self) -> None:
        self.root.title(safe_text("[FKSM] FKSM Routing‑ML"))
        self.root.geometry("1400x800")
        self.root.configure(bg=KoreanThemeColors.LIGHT_GRAY)
        self.root.resizable(False, False)
        
        self._center_window()

    def _setup_fonts(self) -> None:
        try:
            self.fonts = {
                "title": tkFont.Font(family="Malgun Gothic", size=20, weight="bold"),
                "heading": tkFont.Font(family="Malgun Gothic", size=12, weight="bold"),
                "body": tkFont.Font(family="Malgun Gothic", size=10),
                "code": tkFont.Font(family="Consolas", size=9),
                "small": tkFont.Font(family="Malgun Gothic", size=9),
                "tab": tkFont.Font(family="Malgun Gothic", size=11, weight="bold")
            }
        except:
            self.fonts = {
                "title": tkFont.Font(family="Segoe UI", size=20, weight="bold"),
                "heading": tkFont.Font(family="Segoe UI", size=12, weight="bold"),
                "body": tkFont.Font(family="Segoe UI", size=10),
                "code": tkFont.Font(family="Consolas", size=9),
                "small": tkFont.Font(family="Segoe UI", size=9),
                "tab": tkFont.Font(family="Segoe UI", size=11, weight="bold")
            }

    def _on_mode_change(self, event=None):
        """예측 모드 변경 처리 - 상세 라우팅 vs 시간 시나리오"""
        mode = self.prediction_mode_var.get()
        if mode == "detailed":
            self._update_status("상세 라우팅 모드: 공정별 상세 정보를 표시합니다")
            logger.info(safe_log("[설정] 예측 모드 변경: 상세 라우팅 테이블 (다중 행)"))
            if hasattr(self, 'notebook') and hasattr(self, 'routing_tab_id'):
                self.notebook.tab(self.routing_tab_id, text="[라우팅] 상세 라우팅")
        else:
            self._update_status("시간 시나리오 모드: 시간 시나리오 요약을 표시합니다")
            logger.info(safe_log("[설정] 예측 모드 변경: 시간 시나리오 요약 (단일 행)"))
            if hasattr(self, 'notebook') and hasattr(self, 'routing_tab_id'):
                self.notebook.tab(self.routing_tab_id, text="[시나리오] 시간 시나리오")

    def _on_similarity_change(self, event=None):
        """유사도 임계값 변경 처리"""
        threshold = self.similarity_threshold_var.get()
        self._update_status(f"유사도 임계값: {threshold:.0%} 이상의 품목만 고려합니다")
        logger.info(safe_log(f"[유사도] 임계값 변경: {threshold:.1%}"))

    def _get_current_prediction_mode(self) -> str:
        return self.prediction_mode_var.get()
    
    def _get_current_similarity_threshold(self) -> float:
        return self.similarity_threshold_var.get()

    def _build_fixed_layout(self) -> None:
        """고정 레이아웃 구축 - 1400x800"""
        # 메인 컨테이너
        main_container = tk.Frame(self.root, bg=KoreanThemeColors.LIGHT_GRAY)
        main_container.pack(fill=tk.BOTH, expand=True)
        
        # 헤더
        self._create_header(main_container)
        
        # 콘텐츠 영역
        content_area = tk.Frame(main_container, bg=KoreanThemeColors.LIGHT_GRAY)
        content_area.pack(fill=tk.BOTH, expand=True, padx=10, pady=(5, 5))
        
        # 3단 레이아웃: 좌측(제어+입력) | 중앙(결과) | 우측(로그)
        left_column = tk.Frame(content_area, bg=KoreanThemeColors.LIGHT_GRAY, width=400)
        left_column.pack(side=tk.LEFT, fill=tk.BOTH, padx=(0, 5))
        left_column.pack_propagate(False)
        
        middle_column = tk.Frame(content_area, bg=KoreanThemeColors.LIGHT_GRAY, width=580)
        middle_column.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        middle_column.pack_propagate(False)
        
        right_column = tk.Frame(content_area, bg=KoreanThemeColors.LIGHT_GRAY, width=400)
        right_column.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(5, 0))
        right_column.pack_propagate(False)
        
        # 좌측 컬럼: 제어판 + 입력
        self._create_control_panel(left_column)
        self._create_input_section(left_column)
        
        # 중앙 컬럼: 결과
        self._create_results_section(middle_column)
        
        # 우측 컬럼: 로그
        self._create_logs_section(right_column)
        
        # 하단 액션바
        self._create_action_bar(main_container)

    def _create_header(self, parent):
        """헤더 생성"""
        header = tk.Frame(parent, bg=KoreanThemeColors.PRIMARY, height=55)
        header.pack(fill=tk.X)
        header.pack_propagate(False)

        header_content = tk.Frame(header, bg=KoreanThemeColors.PRIMARY)
        header_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=8)

        title_frame = tk.Frame(header_content, bg=KoreanThemeColors.PRIMARY)
        title_frame.pack(side=tk.LEFT, fill=tk.Y)

        tk.Label(
            title_frame, text=safe_text("[FKSM] FKSM Routing-ML"),
            font=self.fonts["title"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
        ).pack(anchor="w")
        
        tk.Label(
            title_frame, text="Enhanced ML 기반 제조 라우팅 예측 시스템",
            font=self.fonts["body"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
        ).pack(anchor="w")

        monitor_frame = tk.Frame(header_content, bg=KoreanThemeColors.PRIMARY)
        monitor_frame.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 전체 화면 버튼 추가
        self.fullscreen_btn = tk.Button(
            monitor_frame, text="[F11] 전체화면", font=self.fonts["small"],
            bg=KoreanThemeColors.PRIMARY_DARK, fg=KoreanThemeColors.WHITE,
            bd=0, relief="flat", padx=10, pady=3, cursor="hand2",
            command=self._toggle_fullscreen
        )
        self.fullscreen_btn.pack(side=tk.RIGHT, padx=(10, 20))
        
        # 호버 효과
        def on_enter(e):
            if self.fullscreen_btn:
                self.fullscreen_btn.config(bg=KoreanThemeColors.PRIMARY)
        
        def on_leave(e):
            if self.fullscreen_btn:
                self.fullscreen_btn.config(bg=KoreanThemeColors.PRIMARY_DARK)
        
        self.fullscreen_btn.bind("<Enter>", on_enter)
        self.fullscreen_btn.bind("<Leave>", on_leave)
        
        self.cpu_indicator = tk.Frame(monitor_frame, bg=KoreanThemeColors.SUCCESS, width=50, height=6)
        self.cpu_indicator.pack(side=tk.RIGHT, padx=5)
        self.cpu_label = tk.Label(
            monitor_frame, text="CPU: --", font=self.fonts["small"],
            bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
        )
        self.cpu_label.pack(side=tk.RIGHT, padx=5)

        self.ram_indicator = tk.Frame(monitor_frame, bg=KoreanThemeColors.SUCCESS, width=50, height=6)
        self.ram_indicator.pack(side=tk.RIGHT, padx=5)
        self.ram_label = tk.Label(
            monitor_frame, text="RAM: --", font=self.fonts["small"],
            bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
        )
        self.ram_label.pack(side=tk.RIGHT, padx=5)

    def _create_control_panel(self, parent):
        """제어판 생성"""
        control_card = self._create_card_frame(parent, "제어판")
        control_card.pack(fill=tk.X, pady=(0, 10))
        
        # 헤더
        header_frame = tk.Frame(control_card, bg=KoreanThemeColors.WHITE)
        header_frame.pack(fill=tk.X, padx=10, pady=(5, 0))
        
        tk.Label(
            header_frame, text="모델 관리",
            font=self.fonts["heading"], bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK
        ).pack(side=tk.LEFT, pady=5)
        
        # 통계 설정 버튼
        stats_btn = tk.Button(header_frame, text="통계 설정")
        self._configure_korean_button(stats_btn, "secondary")
        stats_btn.configure(command=self._open_statistics_popup)
        stats_btn.pack(side=tk.RIGHT, pady=5)
        
        # Feature weights 버튼
        feature_weights_btn = tk.Button(header_frame, text="⚖️ 가중치")
        self._configure_korean_button(feature_weights_btn, "info")
        feature_weights_btn.configure(command=self._open_feature_weights_viewer)
        feature_weights_btn.pack(side=tk.RIGHT, pady=5, padx=(0, 5))
        
        # 모델 정보 버튼
        model_info_btn = tk.Button(header_frame, text="🧠 모델 정보")
        self._configure_korean_button(model_info_btn, "info")
        model_info_btn.configure(command=self._open_model_info)
        model_info_btn.pack(side=tk.RIGHT, pady=5, padx=(0, 5))
        
        # 컨텐츠
        content_frame = tk.Frame(control_card, bg=KoreanThemeColors.WHITE)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(5, 10))
        
        # 버튼 섹션
        buttons_frame = tk.Frame(content_frame, bg=KoreanThemeColors.WHITE)
        buttons_frame.pack(fill=tk.X, pady=(0, 10))
        
        # 첫 번째 줄: 모델 관리 버튼
        row1 = tk.Frame(buttons_frame, bg=KoreanThemeColors.WHITE)
        row1.pack(fill=tk.X, pady=(0, 5))

        self.train_btn = tk.Button(row1, text="학습 시작")
        self._configure_korean_button(self.train_btn, "primary")
        self.train_btn.configure(command=self._train_model)
        self.train_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.stop_btn = tk.Button(row1, text="중지")
        self._configure_korean_button(self.stop_btn, "error")
        self.stop_btn.configure(command=self.stop_training.set)
        self.stop_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.save_btn = tk.Button(row1, text="모델 저장")
        self._configure_korean_button(self.save_btn, "success")
        self.save_btn.configure(command=self._save_model)
        self.save_btn.pack(side=tk.LEFT, padx=(0, 5))

        self.load_btn = tk.Button(row1, text="모델 불러오기")
        self._configure_korean_button(self.load_btn, "warning")
        self.load_btn.configure(command=self._load_model)
        self.load_btn.pack(side=tk.LEFT)

        # 두 번째 줄: 설정
        row2 = tk.Frame(buttons_frame, bg=KoreanThemeColors.WHITE)
        row2.pack(fill=tk.X, pady=5)
        
        # 예측 모드
        tk.Label(
            row2, text="예측 모드:", font=self.fonts["body"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        ).pack(side=tk.LEFT, padx=(0, 5))
        
        mode_combo = ttk.Combobox(
            row2, 
            values=["상세 라우팅", "시간 요약"], 
            state="readonly", width=10,
            font=self.fonts["body"]
        )
        mode_combo.set("상세 라우팅")
        mode_combo.pack(side=tk.LEFT, padx=(0, 15))
        
        def on_mode_change(event):
            selected = mode_combo.get()
            if selected == "상세 라우팅":
                self.prediction_mode_var.set("detailed")
            else:
                self.prediction_mode_var.set("summary")
            self._on_mode_change()
        
        mode_combo.bind("<<ComboboxSelected>>", on_mode_change)
        
        # 라우팅 선택 추가
        tk.Label(
            row2, text="라우팅 선택:", font=self.fonts["body"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        ).pack(side=tk.LEFT, padx=(0, 5))
        
        routing_combo = ttk.Combobox(
            row2,
            values=["최신 라우팅", "최다 사용"],
            state="readonly", width=10,
            font=self.fonts["body"]
        )
        routing_combo.set("최신 라우팅")
        routing_combo.pack(side=tk.LEFT, padx=(0, 15))
        
        def on_routing_selection_change(event):
            selected = routing_combo.get()
            if selected == "최신 라우팅":
                self.routing_selection_var.set("latest")
            else:
                self.routing_selection_var.set("most_used")
            self._on_routing_selection_change()
        
        routing_combo.bind("<<ComboboxSelected>>", on_routing_selection_change)
        
        mode_combo.bind("<<ComboboxSelected>>", on_mode_change)
        
        # 세 번째 줄: 유사도 및 Top-k
        row3 = tk.Frame(buttons_frame, bg=KoreanThemeColors.WHITE)
        row3.pack(fill=tk.X, pady=5)
        
        # 유사도 임계값
        tk.Label(
            row3, text="유사도 임계값:", font=self.fonts["body"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        ).pack(side=tk.LEFT, padx=(0, 5))
        
        similarity_scale = tk.Scale(
            row3, from_=0.1, to=1.0, resolution=0.05,
            orient=tk.HORIZONTAL, variable=self.similarity_threshold_var,
            length=100, font=self.fonts["small"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK,
            highlightthickness=0, bd=0, troughcolor=KoreanThemeColors.LIGHT_GRAY,
            command=lambda val: self._on_similarity_change()
        )
        similarity_scale.pack(side=tk.LEFT, padx=(0, 5))
        
        self.similarity_label = tk.Label(
            row3, text=f"{self.similarity_threshold_var.get():.0%}",
            font=self.fonts["body"], bg=KoreanThemeColors.LIGHT_GRAY,
            fg=KoreanThemeColors.BLACK, relief="solid", bd=1, width=5
        )
        self.similarity_label.pack(side=tk.LEFT, padx=(0, 15))
        
        def update_similarity_label(val=None):
            threshold = self.similarity_threshold_var.get()
            self.similarity_label.config(text=f"{threshold:.0%}")
            self._on_similarity_change()
        
        similarity_scale.config(command=lambda val: update_similarity_label(val))
        
        # Top-k
        tk.Label(
            row3, text="유사 품목 수:", font=self.fonts["body"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        ).pack(side=tk.LEFT, padx=(0, 5))
        
        tk.Spinbox(
            row3, from_=1, to=50, textvariable=self.topk_var,
            width=5, font=self.fonts["body"],
            relief="solid", bd=1, highlightthickness=0
        ).pack(side=tk.LEFT)
        
        # 진행률
        progress_frame = tk.Frame(content_frame, bg=KoreanThemeColors.WHITE)
        progress_frame.pack(fill=tk.X, pady=(0, 10))
        
        tk.Label(
            progress_frame, text="진행률:", font=self.fonts["body"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        ).pack(side=tk.LEFT, padx=(0, 10))
        
        self.progress = ttk.Progressbar(
            progress_frame, length=200, mode="determinate"
        )
        self.progress.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        
        self.progress_label = tk.Label(
            progress_frame, text="0%", width=5, font=self.fonts["small"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        )
        self.progress_label.pack(side=tk.RIGHT)
        
        # 모델 상태
        status_frame = tk.Frame(content_frame, bg=KoreanThemeColors.WHITE)
        status_frame.pack(fill=tk.BOTH, expand=True)
        
        tk.Label(
            status_frame, text="모델 분석", font=self.fonts["heading"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK
        ).pack(anchor="w", pady=(0, 5))
        
        text_frame = tk.Frame(status_frame, bg=KoreanThemeColors.WHITE)
        text_frame.pack(fill=tk.BOTH, expand=True)
        
        self.model_status_text = tk.Text(
            text_frame, height=4, font=self.fonts["small"],
            bg=KoreanThemeColors.LIGHT_GRAY, fg=KoreanThemeColors.BLACK,
            relief="solid", bd=1, wrap=tk.WORD
        )
        self.model_status_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        status_scroll = tk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.model_status_text.yview)
        status_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.model_status_text.config(yscrollcommand=status_scroll.set)
        
        self.model_status_text.insert("1.0", "모델이 로드되지 않았습니다.\n학습하거나 모델을 로드해주세요.")

    def _on_routing_selection_change(self, event=None):
        """라우팅 선택 모드 변경 처리"""
        mode = self.routing_selection_var.get()
        if mode == "latest":
            self._update_status("최신 라우팅 모드: 가장 최근에 등록된 라우팅을 사용합니다")
            logger.info(safe_log("[설정] 라우팅 선택 변경: 최신 라우팅 사용"))
        else:
            self._update_status("최다 사용 모드: 가장 많이 사용된 라우팅을 사용합니다")
            logger.info(safe_log("[설정] 라우팅 선택 변경: 최다 사용 라우팅 사용"))
            
        
    def _get_current_routing_selection(self) -> str:
        """현재 라우팅 선택 모드 반환"""
        return self.routing_selection_var.get()

    def _create_input_section(self, parent):
        """입력 섹션 생성"""
        input_card = self._create_card_frame(parent, "품목 코드 입력")
        input_card.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        
        content = tk.Frame(input_card, bg=KoreanThemeColors.WHITE)
        content.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)
        
        tk.Label(
            content, text="품목 코드를 입력하세요 (한 줄에 하나씩):",
            font=self.fonts["body"], bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY
        ).pack(anchor="w", pady=(0, 5))
        
        text_frame = tk.Frame(content, bg=KoreanThemeColors.WHITE)
        text_frame.pack(fill=tk.BOTH, expand=True)
        
        self.item_text = tk.Text(
            text_frame, height=12, font=self.fonts["code"], relief="solid", bd=1,
            highlightthickness=0, bg=KoreanThemeColors.LIGHT_GRAY, fg=KoreanThemeColors.BLACK,
            insertbackground=KoreanThemeColors.PRIMARY, selectbackground=KoreanThemeColors.PRIMARY_LIGHT
        )
        self.item_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        text_scroll = tk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.item_text.yview)
        text_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.item_text.config(yscrollcommand=text_scroll.set)
        
        button_frame = tk.Frame(content, bg=KoreanThemeColors.WHITE)
        button_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.batch_btn = tk.Button(button_frame, text="일괄 예측")
        self._configure_korean_button(self.batch_btn, "primary")
        self.batch_btn.configure(command=self._run_batch_prediction_ml)
        self.batch_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        self.single_btn = tk.Button(button_frame, text="단일 예측")
        self._configure_korean_button(self.single_btn, "secondary")
        self.single_btn.configure(command=self._predict_single_item_ml)
        self.single_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        self.clear_input_btn = tk.Button(button_frame, text="삭제")
        self._configure_korean_button(self.clear_input_btn, "error")
        self.clear_input_btn.configure(command=lambda: self.item_text.delete("1.0", tk.END))
        self.clear_input_btn.pack(side=tk.LEFT)

    def _create_results_section(self, parent):
        """결과 섹션 생성 - Enhanced Treeview 적용"""
        results_card = self._create_card_frame(parent, "예측 결과")
        results_card.pack(fill=tk.BOTH, expand=True)
        
        content = tk.Frame(results_card, bg=KoreanThemeColors.WHITE)
        content.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 8))
        
        # 통계 정보
        info_frame = tk.Frame(content, bg=KoreanThemeColors.WHITE)
        info_frame.pack(fill=tk.X, pady=(8, 5))
        
        self.stats_label = tk.Label(
            info_frame, text="[통계] 결과: 0개 품목, 0개 라우팅 단계 / 0개 후보",
            font=self.fonts["small"], bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.INFO, anchor="w"
        )
        self.stats_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        self.quality_btn = tk.Button(info_frame, text="결과 분석")
        self._configure_korean_button(self.quality_btn, "secondary")
        self.quality_btn.configure(command=self._show_quality_analysis)
        self.quality_btn.pack(side=tk.RIGHT)
        
        # 탭
        style = ttk.Style()
        style.configure('Results.TNotebook', background=KoreanThemeColors.WHITE)
        style.configure('Results.TNotebook.Tab', padding=[12, 6], font=self.fonts["tab"])
        
        self.notebook = ttk.Notebook(content, style='Results.TNotebook')
        self.notebook.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        # 라우팅 테이블
        routing_frame = tk.Frame(self.notebook, bg=KoreanThemeColors.WHITE)
        routing_container = tk.Frame(routing_frame, bg=KoreanThemeColors.WHITE)
        routing_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.routing_table = ttk.Treeview(routing_container, show="headings")
        self._add_scrollbars(self.routing_table, routing_container)
        self.routing_table.pack(fill=tk.BOTH, expand=True)
        
        # Enhanced Treeview 적용
        self.enhanced_routing_table = EnhancedTreeview(self.routing_table, self)
        
        self.notebook.add(routing_frame, text="예측 결과")
        self.routing_tab_id = 0
        
        # 후보 테이블
        candidates_frame = tk.Frame(self.notebook, bg=KoreanThemeColors.WHITE)
        candidates_container = tk.Frame(candidates_frame, bg=KoreanThemeColors.WHITE)
        candidates_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.candidate_table = ttk.Treeview(candidates_container, show="headings")
        self._add_scrollbars(self.candidate_table, candidates_container)
        self.candidate_table.pack(fill=tk.BOTH, expand=True)
        self.candidate_table.bind("<Double-1>", self._on_candidate_double_click)
        
        # Enhanced Treeview 적용
        self.enhanced_candidate_table = EnhancedTreeview(self.candidate_table, self)
        
        self.notebook.add(candidates_frame, text="유사 품목")

    def _create_logs_section(self, parent):
        """로그 섹션 생성"""
        log_card = self._create_card_frame(parent, "실시간 로그")
        log_card.pack(fill=tk.BOTH, expand=True)
        
        content = tk.Frame(log_card, bg=KoreanThemeColors.WHITE)
        content.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 8))
        
        log_container = tk.Frame(content, bg=KoreanThemeColors.WHITE)
        log_container.pack(fill=tk.BOTH, expand=True, pady=(8, 0))
        
        self.log_text = tk.Text(
            log_container, bg="#2d2d2d", fg="#e5e7eb", 
            font=("Consolas", 9), relief="solid", bd=1, highlightthickness=0,
            insertbackground=KoreanThemeColors.SUCCESS,
            selectbackground=KoreanThemeColors.DARK_GRAY, wrap=tk.WORD
        )
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        log_scroll = tk.Scrollbar(log_container, orient=tk.VERTICAL, command=self.log_text.yview)
        log_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.config(yscrollcommand=log_scroll.set)

    def _create_action_bar(self, parent):
        """하단 액션바 생성"""
        action_bar = tk.Frame(
            parent, bg=KoreanThemeColors.LIGHT_GRAY, relief="solid", bd=1,
            highlightbackground=KoreanThemeColors.GRAY, highlightthickness=1, height=45
        )
        action_bar.pack(side=tk.BOTTOM, fill=tk.X, padx=10, pady=(5, 5))
        action_bar.pack_propagate(False)
        
        # 좌측 정보
        left_info = tk.Frame(action_bar, bg=KoreanThemeColors.LIGHT_GRAY)
        left_info.pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=8)
        
        status_container = tk.Frame(left_info, bg=KoreanThemeColors.LIGHT_GRAY)
        status_container.pack(anchor="w")
        
        self.status_label = tk.Label(
            status_container, text=safe_text("[ML] Enhanced ML 기반 라우팅 예측 준비 완료"),
            font=self.fonts["body"], bg=KoreanThemeColors.LIGHT_GRAY, fg=KoreanThemeColors.DARK_GRAY
        )
        self.status_label.pack(side=tk.LEFT)
        
        tk.Label(
            status_container, text=" | F11: 전체화면 | Ctrl+C: 복사 | Ctrl+A: 전체선택",
            font=self.fonts["small"], bg=KoreanThemeColors.LIGHT_GRAY, fg=KoreanThemeColors.DARK_GRAY
        ).pack(side=tk.LEFT, padx=(10, 0))
        
        # 우측 액션
        right_actions = tk.Frame(action_bar, bg=KoreanThemeColors.LIGHT_GRAY)
        right_actions.pack(side=tk.RIGHT, fill=tk.Y, padx=10, pady=6)
        
        # 모델 정보 버튼
        self.model_info_btn = tk.Button(right_actions, text="🧠 정보")
        self._configure_korean_button(self.model_info_btn, "info")
        self.model_info_btn.configure(command=self._open_model_info)
        self.model_info_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        self.save_csv_btn = tk.Button(right_actions, text="[저장] CSV")
        self._configure_korean_button(self.save_csv_btn, "success")
        self.save_csv_btn.configure(command=self._save_to_csv)
        self.save_csv_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        self.clear_results_btn = tk.Button(right_actions, text="[삭제]")
        self._configure_korean_button(self.clear_results_btn, "error")
        self.clear_results_btn.configure(command=self._clear_results)
        self.clear_results_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        self.refresh_btn = tk.Button(right_actions, text="[새로고침]")
        self._configure_korean_button(self.refresh_btn, "secondary")
        self.refresh_btn.configure(command=self._refresh_view)
        self.refresh_btn.pack(side=tk.RIGHT, padx=(5, 0))
        
        self.emergency_reset_btn = tk.Button(right_actions, text="[긴급]")
        self._configure_korean_button(self.emergency_reset_btn, "error")
        self.emergency_reset_btn.configure(command=self._emergency_reset)
        self.emergency_reset_btn.pack(side=tk.RIGHT, padx=(5, 0))
        

    def _configure_korean_button(self, btn: tk.Button, style: str = "primary"):
        """한국어 UI에 최적화된 버튼 스타일 설정"""
        styles = {
            "primary": {
                "bg": KoreanThemeColors.PRIMARY, "fg": KoreanThemeColors.WHITE,
                "activebackground": KoreanThemeColors.PRIMARY_LIGHT,
            },
            "success": {
                "bg": KoreanThemeColors.SUCCESS, "fg": KoreanThemeColors.WHITE,
                "activebackground": "#059669",
            },
            "warning": {
                "bg": KoreanThemeColors.WARNING, "fg": KoreanThemeColors.WHITE,
                "activebackground": "#d97706",
            },
            "error": {
                "bg": KoreanThemeColors.ERROR, "fg": KoreanThemeColors.WHITE,
                "activebackground": "#dc2626",
            },
            "secondary": {
                "bg": KoreanThemeColors.GRAY, "fg": KoreanThemeColors.BLACK,
                "activebackground": KoreanThemeColors.DARK_GRAY,
            },
            "info": {
                "bg": KoreanThemeColors.INFO, "fg": KoreanThemeColors.WHITE,
                "activebackground": "#2563eb",
            }
        }
        
        config = styles.get(style, styles["primary"])
        config.update({
            "font": self.fonts["body"], "relief": "flat", "bd": 0,
            "cursor": "hand2", "padx": 12, "pady": 5
        })
        btn.configure(**config)
    
    def _open_model_info(self):
        """모델 정보 뷰어 열기 - Enhanced 모델 정보 포함"""
        if not self.model_dir:
            messagebox.showwarning("모델 없음", 
                                "모델이 로드되지 않았습니다.\n"
                                "먼저 모델을 학습하거나 로드해주세요.")
            return
        
        try:
            import sys
            import os
            
            current_dir = os.path.dirname(os.path.abspath(__file__))
            parent_dir = os.path.dirname(current_dir)
            if parent_dir not in sys.path:
                sys.path.insert(0, parent_dir)
            
            from gui.model_info_viewer import open_model_info_viewer
            
            # Enhanced 모델 정보 전달
            extra_info = {}
            if self.model_manager and self.current_model_info:
                extra_info = {
                    'is_enhanced': self.current_model_info.get('is_enhanced', False),
                    'has_pca': self.current_model_info.get('has_pca', False),
                    'has_variance_selector': self.current_model_info.get('has_variance_selector', False),
                    'has_feature_weights': self.current_model_info.get('has_feature_weights', False),
                    'model_metadata': self.current_model_info
                }
            
            self.model_viewer = open_model_info_viewer(
                self.root,
                self.model_dir,
                searcher=self.searcher,
                encoder=self.encoder,
                scaler=self.scaler,
                feature_columns=self.feature_columns,
                extra_info=extra_info,  # Enhanced 정보 전달
                feature_manager=self.feature_manager
            )
            
            logger.info(safe_log("🧠 Enhanced 모델 정보 뷰어가 열렸습니다"))
            self._update_status("Enhanced 모델 정보 뷰어가 열렸습니다")
            
        except ImportError as e:
            logger.error(safe_log(f"모듈 임포트 오류: {e}"))
            messagebox.showerror("모듈 오류", 
                            "model_info_viewer.py 파일이 필요합니다.\n"
                            "파일이 프로젝트 루트 디렉토리에 있는지 확인해주세요.")
        except Exception as e:
            logger.error(safe_log(f"모델 정보 뷰어 오류: {e}"))
            messagebox.showerror("오류", 
                            f"모델 정보를 표시하는 중 오류가 발생했습니다:\n{str(e)}")

    def _create_card_frame(self, parent: tk.Widget, title: str = "") -> tk.Frame:
        card = tk.Frame(
            parent, bg=KoreanThemeColors.WHITE, relief="solid", bd=1,
            highlightbackground=KoreanThemeColors.GRAY, highlightthickness=1
        )
        
        if title:
            title_frame = tk.Frame(card, bg=KoreanThemeColors.WHITE, height=35)
            title_frame.pack(fill=tk.X, padx=10, pady=(8, 0))
            title_frame.pack_propagate(False)
            
            tk.Label(
                title_frame, text=safe_text(title), font=self.fonts["heading"],
                bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK
            ).pack(anchor="w", pady=5)
            
            separator = tk.Frame(card, height=1, bg=KoreanThemeColors.GRAY)
            separator.pack(fill=tk.X, padx=10)
        
        return card

    def _add_scrollbars(self, tree: ttk.Treeview, container: tk.Frame):
        """스크롤바 추가"""
        try:
            style = ttk.Style()
            style.configure("Modern.Treeview", 
                           background=KoreanThemeColors.WHITE, foreground=KoreanThemeColors.BLACK,
                           fieldbackground=KoreanThemeColors.LIGHT_GRAY, font=self.fonts["body"])
            style.configure("Modern.Treeview.Heading",
                           background=KoreanThemeColors.GRAY, foreground=KoreanThemeColors.BLACK,
                           font=self.fonts["heading"])
            
            tree.configure(style="Modern.Treeview")
            
            v_scrollbar = ttk.Scrollbar(container, orient=tk.VERTICAL, command=tree.yview)
            v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            
            h_scrollbar = ttk.Scrollbar(container, orient=tk.HORIZONTAL, command=tree.xview)
            h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)
            
            tree.configure(yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)
            
            def _on_tree_mousewheel(event):
                try:
                    if tree.winfo_exists():
                        tree.yview_scroll(int(-1*(event.delta/120)), "units")
                except tk.TclError:
                    pass
            
            def _on_tree_shift_mousewheel(event):
                try:
                    if tree.winfo_exists():
                        tree.xview_scroll(int(-1*(event.delta/120)), "units")
                except tk.TclError:
                    pass
            
            tree.bind("<MouseWheel>", _on_tree_mousewheel)
            tree.bind("<Shift-MouseWheel>", _on_tree_shift_mousewheel)
            
        except Exception as e:
            logger.error(safe_log(f"스크롤바 설정 오류: {e}"))

    def _install_log_handler(self, log_capacity: int = 1000) -> None:
        try:
            main_handler = SafeModernTextHandler(self.log_text, capacity=log_capacity)
            root_logger = logging.getLogger()
            if not any(isinstance(x, SafeModernTextHandler) and x.widget is main_handler.widget for x in root_logger.handlers):
                root_logger.addHandler(main_handler)
        except Exception as e:
            print(f"로그 핸들러 설치 실패: {e}")

    def _toggle_ui(self, state: str) -> None:
        try:
            for btn in [self.train_btn, self.save_btn, self.load_btn]:
                btn.config(state=state)
        except Exception as e:
            logger.error(safe_log(f"UI 토글 오류: {e}"))

    def _update_progress(self, pct: int) -> None:
        try:
            self.progress["value"] = pct
            self.progress_label.config(text=f"{pct}%")
            
            style = ttk.Style()
            if pct < 30:
                color = KoreanThemeColors.ERROR
            elif pct < 70:
                color = KoreanThemeColors.WARNING
            else:
                color = KoreanThemeColors.SUCCESS
            
            style.configure("Modern.Horizontal.TProgressbar", background=color)
            self.root.update_idletasks()
        except Exception as e:
            logger.error(safe_log(f"진행률 업데이트 오류: {e}"))

    def _emergency_reset(self) -> None:
        """긴급 상황 복구 - 처리 상태 강제 리셋"""
        try:
            self.is_processing = False
            self._update_progress(0)
            self._update_status(safe_text("[긴급] 긴급 복구 완료 - 다시 사용할 수 있습니다"))
            logger.warning(safe_log("[긴급] 긴급 복구 실행: 처리 상태가 강제로 초기화되었습니다"))
            
            messagebox.showinfo("긴급 복구", 
                              "[긴급] 처리 상태가 초기화되었습니다!\n\n"
                              "이제 다시 예측을 실행할 수 있습니다.")
            
        except Exception as e:
            logger.error(safe_log(f"긴급 복구 실패: {e}"))
            messagebox.showerror("복구 실패", f"긴급 복구 중 오류: {str(e)}")

    def _clear_results(self) -> None:
        try:
            self.routing_table.delete(*self.routing_table.get_children())
            self.candidate_table.delete(*self.candidate_table.get_children())
            self.current_routing = pd.DataFrame()
            self.current_candidates = pd.DataFrame()
            self.current_model_info = {}  # 모델 정보도 초기화
            self._update_stats()
            self._update_status("결과가 지워졌습니다")
            logger.info(safe_log("[삭제] 결과가 성공적으로 지워졌습니다"))
        except Exception as e:
            logger.error(safe_log(f"결과 지우기 오류: {e}"))

    
    def _update_stats(self) -> None:
        """통계 정보 업데이트 - 기존 라우팅과 ML 예측 구분"""
        try:
            if self.current_routing.empty:
                routing_str = "0개 품목, 0개 라우팅 단계"
            else:
                # ITEM_CD 또는 INPUT_ITEM_CD 사용
                item_col = None
                if 'INPUT_ITEM_CD' in self.current_routing.columns:
                    item_col = 'INPUT_ITEM_CD'
                elif 'ITEM_CD' in self.current_routing.columns:
                    item_col = 'ITEM_CD'
                
                if item_col:
                    unique_items = self.current_routing[item_col].nunique()
                    total_rows = len(self.current_routing)
                    
                    # 예측 타입별 통계
                    if 'PREDICTION_TYPE' in self.current_routing.columns:
                        existing_items = self.current_routing[
                            self.current_routing['PREDICTION_TYPE'] == 'EXISTING'
                        ][item_col].nunique()
                        ml_items = self.current_routing[
                            self.current_routing['PREDICTION_TYPE'] == 'ML_BASED'
                        ][item_col].nunique()
                        
                        if existing_items > 0 and ml_items == 0:
                            type_info = " (기존 라우팅)"
                        elif existing_items == 0 and ml_items > 0:
                            type_info = " (ML 예측)"
                        else:
                            type_info = f" (기존: {existing_items}개, ML: {ml_items}개)"
                    else:
                        type_info = ""
                    
                    mode = self._get_current_prediction_mode()
                    if mode == "detailed" and 'PROC_SEQ' in self.current_routing.columns:
                        routing_str = f"{unique_items}개 품목{type_info}, {total_rows}개 공정 단계"
                        
                        if unique_items > 0:
                            avg_processes = total_rows / unique_items
                            routing_str += f" (평균 {avg_processes:.1f}공정/품목)"
                    else:
                        routing_str = f"{unique_items}개 품목{type_info}, {total_rows}개 시나리오"
                else:
                    total_rows = len(self.current_routing)
                    routing_str = f"1개 품목, {total_rows}개 라우팅 단계"
            
            cand_cnt = len(self.current_candidates)
            
            # 후보 중 라우팅 있는 것 카운트
            routing_available_cnt = 0
            if not self.current_candidates.empty and 'HAS_ROUTING' in self.current_candidates.columns:
                routing_available_cnt = len(
                    self.current_candidates[self.current_candidates['HAS_ROUTING'].str.contains('있음', na=False)]
                )
            
            stats_text = f"[통계] 결과: {routing_str}"
            
            # ML 예측인 경우에만 후보 정보 표시
            if not self.current_routing.empty and 'PREDICTION_TYPE' in self.current_routing.columns:
                if self.current_routing['PREDICTION_TYPE'].iloc[0] == 'ML_BASED':
                    stats_text += f" / {cand_cnt}개 후보"
                    if routing_available_cnt > 0:
                        stats_text += f" (라우팅有: {routing_available_cnt}개)"
            
            # 시간 정보
            if not self.current_routing.empty:
                time_cols = ['STANDARD_TIME', 'SETUP_TIME', 'RUN_TIME']
                for col in time_cols:
                    if col in self.current_routing.columns:
                        total_time = self.current_routing[col].sum()
                        if total_time > 0:
                            stats_text += f" | 총 {col.replace('_', ' ').lower()}: {total_time:.1f}분"
                            break
            
            # 신뢰도 정보 (ML 예측인 경우)
            if not self.current_routing.empty and 'CONFIDENCE' in self.current_routing.columns:
                ml_routing = self.current_routing[
                    self.current_routing.get('PREDICTION_TYPE', '') == 'ML_BASED'
                ]
                if not ml_routing.empty:
                    avg_confidence = ml_routing['CONFIDENCE'].mean()
                    stats_text += f" | ML 신뢰도: {avg_confidence:.1%}"
            
            # 유사도 임계값 (ML 예측인 경우에만)
            if not self.current_routing.empty and 'PREDICTION_TYPE' in self.current_routing.columns:
                if self.current_routing['PREDICTION_TYPE'].iloc[0] == 'ML_BASED':
                    similarity_threshold = self._get_current_similarity_threshold()
                    stats_text += f" | 유사도: {similarity_threshold:.0%}+"
            
            # Enhanced 모델 정보
            if self.current_model_info.get('is_enhanced'):
                stats_text += " | Enhanced"
            
            self.stats_label.config(text=safe_text(stats_text))
            
            logger.debug(f"[통계] 업데이트: {stats_text}")
            
        except Exception as e:
            logger.error(safe_log(f"통계 업데이트 오류: {e}"))
            self.stats_label.config(text=safe_text("[통계] 결과: 통계 계산 오류"))

    def _update_status(self, message: str) -> None:
        try:
            if hasattr(self, 'status_label'):
                self.status_label.config(text=safe_text(message))
        except Exception as e:
            logger.error(safe_log(f"상태 업데이트 오류: {e}"))

    def _refresh_view(self) -> None:
        try:
            self._update_stats()
            self._update_status("화면이 새로고침되었습니다")
            logger.info(safe_log("[새로고침] 화면이 새로고침되었습니다"))
        except Exception as e:
            logger.error(safe_log(f"화면 새로고침 오류: {e}"))

    def _show_quality_analysis(self):
        """예측 품질 분석 - 기존 라우팅과 ML 예측 구분"""
        if self.current_routing.empty:
            messagebox.showwarning("분석 오류", "분석할 결과가 없습니다.")
            return
        
        try:
            # 예측 타입 확인
            is_existing = False
            is_ml_based = False
            
            if 'PREDICTION_TYPE' in self.current_routing.columns:
                pred_types = self.current_routing['PREDICTION_TYPE'].unique()
                is_existing = 'EXISTING' in pred_types
                is_ml_based = 'ML_BASED' in pred_types
            
            if is_existing and not is_ml_based:
                # 기존 라우팅만 있는 경우
                analysis_text = f"""
    📊 기존 라우팅 데이터 분석
    ════════════════════════════════════════

    🎯 라우팅 요약:
    • 데이터 타입: 기존 라우팅 (DB 저장값)
    • 품목 수: {self.current_routing['ITEM_CD'].nunique()}개
    • 총 공정 수: {len(self.current_routing)}개
    
    ⏱️ 시간 정보:"""
                
                if 'SETUP_TIME' in self.current_routing.columns:
                    analysis_text += f"""
    • 총 Setup 시간: {self.current_routing['SETUP_TIME'].sum():.1f}분
    • 평균 Setup 시간: {self.current_routing['SETUP_TIME'].mean():.1f}분"""
                
                if 'RUN_TIME' in self.current_routing.columns:
                    analysis_text += f"""
    • 총 Run 시간: {self.current_routing['RUN_TIME'].sum():.1f}분
    • 평균 Run 시간: {self.current_routing['RUN_TIME'].mean():.1f}분"""
                
                analysis_text += """

    📌 참고사항:
    • 이 데이터는 데이터베이스에 저장된 실제 라우팅입니다
    • ML 예측이 아닌 기존 설정값입니다
    • 신뢰도 및 유사도 정보는 해당사항 없습니다
                """
                
            else:
                # ML 예측이 포함된 경우 (기존 분석)
                metrics = validate_prediction_quality_enhanced(
                    self.current_routing, 
                    self.current_model_info
                )
                
                analysis_text = f"""
    📊 Enhanced ML 기반 예측 품질 분석
    ════════════════════════════════════════

    🎯 예측 요약:
    • 품질 등급: {metrics.get('quality_grade', 'N/A')}
    • 평균 신뢰도: {metrics.get('avg_confidence', 0):.1%}
    • 평균 유사도: {metrics.get('avg_similarity', 0):.1%}
    • 모델 품질 점수: {metrics.get('model_quality_score', 0):.2f}
    
    🔍 유사품 활용:
    • 평균 사용 품목 수: {metrics.get('avg_similar_items', 0):.1f}개
    • 높은 신뢰도 비율: {metrics.get('high_confidence_ratio', 0):.1%}
    
    ⏱️ 시간 예측:
    • 총 Setup 시간: {metrics.get('total_setup_time', 0):.1f}분
    • 총 Run 시간: {metrics.get('total_run_time', 0):.1f}분
    
    🧠 Enhanced 모델 정보:
    • Enhanced 모델: {'예' if self.current_model_info.get('is_enhanced') else '아니오'}
    • PCA 적용: {'예' if self.current_model_info.get('has_pca') else '아니오'}
    • 분산 선택기: {'예' if self.current_model_info.get('has_variance_selector') else '아니오'}
    • Feature 가중치: {'예' if self.current_model_info.get('has_feature_weights') else '아니오'}
    
    💡 개선 제안:
    """
                
                # 개선 제안 추가
                suggestions = metrics.get('improvement_suggestions', [])
                for suggestion in suggestions:
                    analysis_text += f"\n   • {suggestion}"
                
                # 품질 등급별 추가 제안
                avg_confidence = metrics.get('avg_confidence', 0)
                avg_similarity = metrics.get('avg_similarity', 0)
                
                if avg_confidence < 0.7:
                    analysis_text += """
    • 신뢰도가 낮습니다 (70% 미만)
    • 유사도 임계값을 낮춰 더 많은 유사품 활용
    • Top-K 값을 증가시켜 더 많은 참조 데이터 확보"""
                    
                    if avg_similarity < 0.8:
                        analysis_text += """
    • 평균 유사도도 낮음 - 품목 특성 데이터 보완 필요
    • ML 모델 재학습 고려"""
                else:
                    analysis_text += """
    • 현재 설정이 적절함
    • 높은 신뢰도의 예측 결과"""
                    
                    if avg_similarity > 0.9:
                        analysis_text += """
    • 매우 높은 유사도 - 우수한 예측 품질"""
                
                # Enhanced 모델 최적화 제안
                if not self.current_model_info.get('is_enhanced'):
                    analysis_text += """
    • Enhanced 모델로 재학습하면 더 나은 성능 기대"""
            
            # ML 모델 정보 추가 (ML 예측인 경우에만)
            if is_ml_based and self.model_dir:
                analysis_text += f"""

    📂 ML 모델 정보:
    • 모델 경로: {self.model_dir}
    • 특성 수: {len(self.feature_columns) if self.feature_columns else 'N/A'}개
    • 유사도 임계값: {self._get_current_similarity_threshold():.0%}
    • Top-K: {self.topk_var.get()}개"""
                
                # Enhanced 모델 추가 정보
                if self.current_model_info.get('vector_dimension'):
                    analysis_text += f"""
    • 벡터 차원: {self.current_model_info['vector_dimension']}"""
                if self.current_model_info.get('total_items'):
                    analysis_text += f"""
    • 학습 품목 수: {self.current_model_info['total_items']}개"""
            
            # 예측 모드 정보
            mode = self._get_current_prediction_mode()
            analysis_text += f"""
    • 예측 모드: {'상세 라우팅' if mode == 'detailed' else '시간 요약'}"""
            
            # 창 생성
            analysis_window = tk.Toplevel(self.root)
            if is_existing and not is_ml_based:
                analysis_window.title(safe_text("[통계] 기존 라우팅 데이터 분석"))
            else:
                analysis_window.title(safe_text("[통계] Enhanced ML 기반 예측 품질 분석"))
            
            analysis_window.geometry("700x650")
            analysis_window.configure(bg=KoreanThemeColors.WHITE)
            
            # 헤더
            header_frame = tk.Frame(analysis_window, bg=KoreanThemeColors.PRIMARY, height=50)
            header_frame.pack(fill=tk.X)
            header_frame.pack_propagate(False)
            
            header_text = "📊 기존 라우팅 데이터 분석" if (is_existing and not is_ml_based) else "📊 Enhanced ML 기반 예측 품질 분석"
            tk.Label(
                header_frame, text=safe_text(header_text),
                font=self.fonts["heading"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
            ).pack(pady=15)
            
            # 내용
            content_frame = tk.Frame(analysis_window, bg=KoreanThemeColors.WHITE)
            content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
            
            text_widget = tk.Text(
                content_frame, font=self.fonts["code"], wrap=tk.WORD,
                bg=KoreanThemeColors.LIGHT_GRAY, fg=KoreanThemeColors.BLACK,
                relief="solid", bd=1
            )
            text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            
            scroll = tk.Scrollbar(content_frame, orient=tk.VERTICAL, command=text_widget.yview)
            scroll.pack(side=tk.RIGHT, fill=tk.Y)
            text_widget.config(yscrollcommand=scroll.set)
            
            text_widget.insert("1.0", safe_text(analysis_text))
            text_widget.config(state=tk.DISABLED)
            
            # 버튼
            button_frame = tk.Frame(analysis_window, bg=KoreanThemeColors.WHITE)
            button_frame.pack(fill=tk.X, padx=20, pady=(0, 20))
            
            close_btn = tk.Button(button_frame, text="[완료] 닫기")
            self._configure_korean_button(close_btn, "primary")
            close_btn.configure(command=analysis_window.destroy)
            close_btn.pack(side=tk.RIGHT)
            
            # CSV 저장 버튼
            def save_analysis():
                filename = filedialog.asksaveasfilename(
                    title="품질 분석 저장",
                    defaultextension=".txt",
                    filetypes=[("텍스트 파일", "*.txt"), ("모든 파일", "*.*")]
                )
                if filename:
                    with open(filename, 'w', encoding='utf-8') as f:
                        f.write(analysis_text)
                    messagebox.showinfo("저장 완료", f"분석 결과가 저장되었습니다:\n{filename}")
            
            save_analysis_btn = tk.Button(button_frame, text="[저장] 분석 저장")
            self._configure_korean_button(save_analysis_btn, "success")
            save_analysis_btn.configure(command=save_analysis)
            save_analysis_btn.pack(side=tk.RIGHT, padx=(0, 5))
            
        except Exception as e:
            logger.error(safe_log(f"품질 분석 실패: {e}"))
            messagebox.showerror("분석 오류", f"품질 분석 중 오류가 발생했습니다:\n{str(e)}")

    def _on_close(self):
        """창을 닫을 때 호출된다."""
        try:
            if getattr(self, "_after_id", None):
                try:
                    self.root.after_cancel(self._after_id)
                except tk.TclError:
                    pass
        finally:
            self.root.destroy()

    def _start_resource_monitoring(self) -> None:
        """CPU / RAM 사용률을 2초 주기로 갱신한다."""
        def update():
            try:
                cpu = psutil.cpu_percent(interval=None)
                ram = psutil.virtual_memory().percent

                self.cpu_label.config(text=f"CPU: {cpu:.1f}%")
                self.cpu_indicator.config(bg=self._get_status_color(cpu))

                self.ram_label.config(text=f"RAM: {ram:.1f}%")
                self.ram_indicator.config(bg=self._get_status_color(ram))

                if cpu > 90 or ram > 90:
                    logger.warning(
                        safe_log(f"[시스템] 높은 리소스 사용량: CPU {cpu:.1f}%, RAM {ram:.1f}%")
                    )

            except Exception as e:
                logger.debug(safe_log(f"리소스 모니터링 오류: {e}"))
                self.cpu_label.config(text="CPU: --")
                self.ram_label.config(text="RAM: --")
                self.cpu_indicator.config(bg=KoreanThemeColors.GRAY)
                self.ram_indicator.config(bg=KoreanThemeColors.GRAY)

            self._after_id = self.root.after(2000, update)
        
        update()

    def _get_status_color(self, percentage: float) -> str:
        if percentage < 50:
            return KoreanThemeColors.SUCCESS
        elif percentage < 80:
            return KoreanThemeColors.WARNING
        else:
            return KoreanThemeColors.ERROR

    def _lighten_color(self, color: str, factor: float = 0.3) -> str:
        """색상을 밝게 만드는 헬퍼 함수
        
        Args:
            color: #RRGGBB 형식의 색상 코드
            factor: 밝기 증가 비율 (0.0 ~ 1.0)
        
        Returns:
            밝아진 색상 코드
        """
        try:
            # 특수 색상 처리
            if color in [KoreanThemeColors.PRIMARY, KoreanThemeColors.SUCCESS, 
                        KoreanThemeColors.WARNING, KoreanThemeColors.ERROR,
                        KoreanThemeColors.INFO]:
                # 미리 정의된 색상들의 밝은 버전
                color_map = {
                    KoreanThemeColors.PRIMARY: "#5a8ad8",
                    KoreanThemeColors.SUCCESS: "#52c76f",
                    KoreanThemeColors.WARNING: "#ffc751",
                    KoreanThemeColors.ERROR: "#ff6b6b",
                    KoreanThemeColors.INFO: "#5fa3f5"
                }
                return color_map.get(color, color)
            
            # # 제거
            if color.startswith("#"):
                color = color[1:]
            
            # RGB로 변환
            r = int(color[0:2], 16)
            g = int(color[2:4], 16)
            b = int(color[4:6], 16)
            
            # 밝기 증가
            r = min(255, int(r + (255 - r) * factor))
            g = min(255, int(g + (255 - g) * factor))
            b = min(255, int(b + (255 - b) * factor))
            
            # 다시 색상 코드로 변환
            return f"#{r:02x}{g:02x}{b:02x}"
            
        except Exception as e:
            logger.debug(f"색상 변환 오류: {color}, {e}")
            return color  # 오류 시 원래 색상 반환

    def _bind_fullscreen_keys(self):
        """전체 화면 단축키 바인딩"""
        self.root.bind("<F11>", self._toggle_fullscreen)
        self.root.bind("<Escape>", self._exit_fullscreen)
        
        self.fullscreen_btn = None
    
    def _center_window(self):
        """창을 화면 중앙에 배치"""
        self.root.update_idletasks()
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x = (screen_width // 2) - (1400 // 2)
        y = (screen_height // 2) - (800 // 2)
        
        if x < 0: x = 0
        if y < 0: y = 0
        if x + 1400 > screen_width: x = screen_width - 1400
        if y + 800 > screen_height: y = screen_height - 800
        
        self.root.geometry(f"1400x800+{x}+{y}")
    
    def _toggle_fullscreen(self, event=None):
        """전체 화면 토글"""
        self.is_fullscreen = not self.is_fullscreen
        self.root.attributes("-fullscreen", self.is_fullscreen)
        
        if self.is_fullscreen:
            logger.info(safe_log("[전체화면] 전체 화면 모드 활성화 (ESC로 해제)"))
            self._update_status("전체 화면 모드 - ESC 키로 해제")
            self.root.resizable(True, True)
            if self.fullscreen_btn:
                self.fullscreen_btn.config(text="[ESC] 일반화면")
        else:
            logger.info(safe_log("[전체화면] 전체 화면 모드 해제"))
            self._update_status("일반 화면 모드")
            self.root.resizable(False, False)
            self.root.geometry("1400x800")
            self._center_window()
            if self.fullscreen_btn:
                self.fullscreen_btn.config(text="[F11] 전체화면")
        
        return "break"
    
    def _exit_fullscreen(self, event=None):
        """전체 화면 해제"""
        if self.is_fullscreen:
            self.is_fullscreen = False
            self.root.attributes("-fullscreen", False)
            self.root.resizable(False, False)
            self.root.geometry("1400x800")
            self._center_window()
            logger.info(safe_log("[전체화면] ESC 키로 전체 화면 해제"))
            self._update_status("일반 화면 모드")
            if self.fullscreen_btn:
                self.fullscreen_btn.config(text="[F11] 전체화면")
        return "break"

    def _open_statistics_popup(self):
        popup = tk.Toplevel(self.root)
        popup.title(safe_text(" ML 통계 설정"))
        popup.geometry("900x600")
        popup.configure(bg=KoreanThemeColors.WHITE)
        popup.resizable(False, False)
        popup.transient(self.root)
        popup.grab_set()
        
        popup.update_idletasks()
        x = (popup.winfo_screenwidth() // 2) - (900 // 2)
        y = (popup.winfo_screenheight() // 2) - (600 // 2)
        popup.geometry(f"900x600+{x}+{y}")
        
        header = tk.Frame(popup, bg=KoreanThemeColors.PRIMARY, height=60)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        
        header_content = tk.Frame(header, bg=KoreanThemeColors.PRIMARY)
        header_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=15)
        
        tk.Label(
            header_content, text=safe_text(" ML 시나리오 통계 설정"),
            font=self.fonts["title"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
        ).pack(anchor="w")
        
        tk.Label(
            header_content, text="ML 예측 정확도를 위한 고급 통계 매개변수 조정",
            font=self.fonts["body"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
        ).pack(anchor="w")
        
        main_frame = tk.Frame(popup, bg=KoreanThemeColors.WHITE)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        canvas = tk.Canvas(main_frame, bg=KoreanThemeColors.WHITE, highlightthickness=0)
        scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=KoreanThemeColors.WHITE)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        def _on_popup_mousewheel(event):
            try:
                if canvas.winfo_exists():
                    canvas.yview_scroll(int(-1*(event.delta/120)), "units")
            except tk.TclError:
                pass
        
        canvas.bind("<MouseWheel>", _on_popup_mousewheel)
        scrollable_frame.bind("<MouseWheel>", _on_popup_mousewheel)
        
        def on_popup_close():
            popup.destroy()
        
        StatisticalConfigWidget(scrollable_frame, self.fonts)
        
        bottom_frame = tk.Frame(popup, bg=KoreanThemeColors.LIGHT_GRAY, height=50)
        bottom_frame.pack(side=tk.BOTTOM, fill=tk.X, padx=15, pady=10)
        bottom_frame.pack_propagate(False)
        
        close_btn = tk.Button(bottom_frame, text="완료")
        self._configure_korean_button(close_btn, "primary")
        close_btn.configure(command=on_popup_close)
        close_btn.pack(side=tk.RIGHT, pady=10)

    # ═══════════════════════════════════════════════
    # 모델 관리 메서드들 - Enhanced 지원
    # ═══════════════════════════════════════════════
    def _train_model(self) -> None:
        def task():
            try:
                self._toggle_ui("disabled")
                self._update_status("Enhanced 모델을 학습하고 있습니다...")
                self.stop_training.clear()
                logger.info(safe_log("[시작] Access → 품목 마스터 로딩…"))
                df = fetch_item_master()
                if df.empty:
                    raise RuntimeError("학습 데이터가 비었습니다.")
                logger.info(safe_log(f"로딩된 데이터: {len(df)}행"))

                if not self.model_dir:
                    self.model_dir = "./models/default"

                # Enhanced 모델 학습
                res = train_model_with_ml_improved(
                    df=df, 
                    progress_cb=self._update_progress, 
                    stop_flag=self.stop_training,
                    save_dir=self.model_dir,
                    save_metadata=True,  # Enhanced 메타데이터 저장
                    optimize_for_seal=True,
                    auto_feature_weights=True,
                    variance_threshold=0.001,
                    balance_dimensions=True,
                )
                if res is None:
                    logger.warning(safe_log("[중단] 사용자가 학습을 취소했습니다"))
                    self._update_status("학습이 취소되었습니다")
                    return

                (self.searcher, self.encoder, self.scaler, self.feature_columns) = res
                logger.info(safe_log(f"[완료] Enhanced 학습 성공 – 특성 차원: {len(self.feature_columns)}개"))
                
                # Feature manager 초기화
                self.feature_manager = FeatureWeightManager(Path(self.model_dir))
                if self.feature_manager.feature_importance:
                    logger.info(safe_log("[완료] Feature importance 분석 완료"))
                
                # Enhanced model manager 초기화
                self.model_manager = EnhancedModelManager(self.model_dir)
                self.model_manager.load()
                self.current_model_info = self.model_manager.get_model_info()
                
                status_text = f"""[완료] Enhanced ML 모델 학습 완료
        - 특성 수: {len(self.feature_columns)}개 차원
        - 데이터 샘플: {len(df)}개 품목
        - 학습 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        - Enhanced 모델: {'예' if self.current_model_info.get('is_enhanced') else '아니오'}
        - PCA 적용: {'예' if self.current_model_info.get('has_pca') else '아니오'}
        - 씰 제조 최적화: 적용됨
        - 상태: Enhanced ML 기반 라우팅 예측 준비 완료"""
                
                self.model_status_text.delete("1.0", tk.END)
                self.model_status_text.insert("1.0", status_text)
                
                self._update_status("Enhanced 학습이 성공적으로 완료되었습니다")
            except RuntimeError as e:
                logger.exception(safe_log(f"[오류] 학습 중 런타임 오류 발생: {str(e)}"))
                messagebox.showerror("학습 실패", f"학습 중 오류 발생: {str(e)}")
                self._update_status("학습이 실패했습니다")
            except Exception as e:
                logger.exception(safe_log(f"[오류] 학습 중 예외 발생: {str(e)}"))
                messagebox.showerror("학습 실패", f"예상치 못한 오류: {str(e)}")
                self._update_status("학습이 실패했습니다")
            finally:
                self._toggle_ui("normal")
                self._update_progress(0)
        threading.Thread(target=task, daemon=True).start()

    def _save_model(self):
        if not all([self.searcher, self.encoder, self.scaler, self.feature_columns]):
            messagebox.showwarning("저장 오류", "저장할 모델이 없습니다. 먼저 학습을 완료하세요.")
            return
        path = filedialog.askdirectory(title="모델 저장 폴더 선택")
        if not path:
            return
        try:
            save_optimized_model(self.searcher, self.encoder, self.scaler, self.feature_columns, path)
            logger.info(safe_log(f"[완료] Enhanced 모델 저장: {path}"))
            messagebox.showinfo("저장 완료", f"Enhanced 모델이 저장되었습니다:\n{path}")
            self._update_status("Enhanced 모델이 성공적으로 저장되었습니다")
        except Exception as e:
            logger.exception(safe_log("[오류] 모델 저장 실패"))
            messagebox.showerror("저장 실패", "모델 저장 중 오류가 발생했습니다.")
            self._update_status("모델 저장이 실패했습니다")

    def _load_model(self):
        """Enhanced 모델 로드"""
        path = filedialog.askdirectory(title="모델 폴더 선택")
        if not path:
            return
        try:
            self.model_dir = path
            
            # Enhanced Model Manager 사용
            self.model_manager = EnhancedModelManager(path)
            self.model_manager.load()
            
            # 모델 컴포넌트 추출
            self.searcher = self.model_manager.model_components['searcher']
            self.encoder = self.model_manager.model_components['encoder']
            self.scaler = self.model_manager.model_components['scaler']
            self.feature_columns = self.model_manager.model_components['feature_columns']
            
            # 모델 정보 저장
            self.current_model_info = self.model_manager.get_model_info()
            
            logger.info(safe_log(f"[완료] Enhanced 모델 로드: {path}"))
            logger.info(safe_log(f"[정보] Enhanced: {self.current_model_info.get('is_enhanced')}, "
                              f"PCA: {self.current_model_info.get('has_pca')}, "
                              f"Features: {len(self.feature_columns)}개"))
            
            # Feature manager 초기화
            self.feature_manager = FeatureWeightManager(Path(self.model_dir))
            
            status_text = f"""[완료] Enhanced ML 모델 로드 성공
    • 모델 경로: {path}
    • 특성 수: {len(self.feature_columns)}개 차원
    • Enhanced 모델: {'예' if self.current_model_info.get('is_enhanced') else '아니오'}
    • PCA 적용: {'예' if self.current_model_info.get('has_pca') else '아니오'}
    • Feature 가중치: {'예' if self.current_model_info.get('has_feature_weights') else '아니오'}
    • 로드 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    • 상태: Enhanced ML 기반 라우팅 예측 준비 완료"""
            
            self.model_status_text.delete("1.0", tk.END)
            self.model_status_text.insert("1.0", status_text)
            
            messagebox.showinfo("로드 완료", 
                              f"Enhanced 모델이 로드되었습니다:\n{path}\n\n"
                              f"모델 타입: {'Enhanced' if self.current_model_info.get('is_enhanced') else 'Basic'}")
            self._update_status("Enhanced 모델이 성공적으로 로드되었습니다")
            
        except Exception as e:
            logger.exception(safe_log("[오류] Enhanced 모델 로드 실패"))
            # 기본 모델 로드 시도
            try:
                logger.info(safe_log("[시도] 기본 모델 로드 중..."))
                (self.searcher, self.encoder, self.scaler, self.feature_columns) = load_optimized_model(path)
                self.current_model_info = {'is_enhanced': False}
                
                # Feature manager 초기화
                self.feature_manager = FeatureWeightManager(Path(self.model_dir))
                
                messagebox.showinfo("로드 완료", 
                                  f"기본 모델이 로드되었습니다:\n{path}\n\n"
                                  f"(Enhanced 기능은 사용할 수 없습니다)")
                self._update_status("기본 모델이 로드되었습니다")
                
            except Exception as e2:
                logger.exception(safe_log("[오류] 기본 모델 로드도 실패"))
                messagebox.showerror("로드 실패", 
                                   f"모델 로드 중 오류가 발생했습니다:\n{str(e)}")
                self._update_status("모델 로드가 실패했습니다")

    # ═══════════════════════════════════════════════
    # 🎯 Enhanced ML 예측 함수들
    # ═══════════════════════════════════════════════
    
    
    def _predict_single_item_ml(self):
        """Enhanced ML 단일 품목 예측 - 플래그 관리 개선"""
        try:
            # 이미 처리 중인지 확인
            if self.is_processing:
                logger.warning(safe_log("[경고] 이미 예측이 진행 중입니다."))
                messagebox.showwarning("처리 중", "예측이 진행 중입니다.\n잠시 기다려주세요.")
                return
            
            # 입력값 확인
            text_content = self.item_text.get("1.0", tk.END).strip()
            if not text_content:
                messagebox.showwarning("입력 필요", "예측할 ITEM_CD를 입력하세요.")
                return
                
            code = text_content.splitlines()[0].strip() if text_content else ""
            if not code:
                messagebox.showwarning("입력 필요", "예측할 ITEM_CD를 입력하세요.")
                return
                
            if self.model_dir is None:
                messagebox.showwarning("모델 필요", "먼저 모델을 로드하세요.")
                return
            
            # 처리 시작
            self.is_processing = True
            logger.info(safe_log(f"[예측] 처리 시작: {code}, is_processing = True"))
            self._update_status(f"[처리중] {code} 예측 중...")
            
            def ml_single_task():
                try:
                    mode = self._get_current_prediction_mode()
                    pred_mode = "detailed" if mode == "detailed" else "summary"
                    routing_selection = self._get_current_routing_selection()
                    
                    self._update_status(safe_text(f"[ML] {code} Enhanced 분석 시작... (모드: {pred_mode})"))
                    logger.info(safe_log(f"[예측] Enhanced ML 기반 예측 시작 - 품목: {code}, 모드: {pred_mode}"))
                    
                    self.root.after(0, lambda: self._update_progress(20))
                    
                    # Enhanced ML 예측 실행
                    routing_df, cand_df, model_info = predict_single_item_with_ml_enhanced(
                        code, 
                        self.model_dir, 
                        top_k=self.topk_var.get(),
                        config=get_scenario_config(),
                        mode=pred_mode,
                        routing_selection=routing_selection 
                    )
                    
                    # 모델 정보 저장
                    self.current_model_info = model_info
                    
                    self.root.after(0, lambda: self._update_progress(80))
                    
                    # 결과 처리
                    if not routing_df.empty:
                        # 기존 라우팅인지 ML 예측인지 확인
                        is_existing = 'PREDICTION_TYPE' in routing_df.columns and \
                                    routing_df['PREDICTION_TYPE'].iloc[0] == 'EXISTING'
                        
                        if is_existing:
                            logger.info(safe_log(f"[완료] {code} 기존 라우팅 표시: {len(routing_df)}개 공정"))
                        else:
                            if pred_mode == "detailed":
                                process_count = len(routing_df)
                                total_time = routing_df['STANDARD_TIME'].sum() if 'STANDARD_TIME' in routing_df.columns else 0
                                logger.info(safe_log(f"[완료] {code} ML 예측 상세 라우팅: {process_count}개 공정, 총 {total_time:.1f}분"))
                            else:
                                if 'STANDARD_TIME' in routing_df.columns and len(routing_df) > 0:
                                    total_time = routing_df['STANDARD_TIME'].iloc[0]
                                    confidence = routing_df['CONFIDENCE'].iloc[0] if 'CONFIDENCE' in routing_df.columns else 0
                                    logger.info(safe_log(f"[완료] {code} ML 예측 시간 시나리오: {total_time:.1f}분 (신뢰도: {confidence:.1%})"))
                        
                        self.root.after(0, lambda: self._finalize_single_ml(routing_df, cand_df))
                    else:
                        # 결과가 없는 경우
                        self.root.after(0, lambda: self._finalize_single_ml(routing_df, cand_df))
                        self.root.after(0, lambda: messagebox.showwarning(
                            "예측 실패", 
                            f"품목 {code}의 라우팅을 찾을 수 없습니다.\n\n"
                            f"가능한 원인:\n"
                            f"• 품목 정보가 없음\n"
                            f"• 기존 라우팅 데이터가 없음\n"
                            f"• 유사 품목을 찾을 수 없음"
                        ))
                        
                except Exception as e:
                    logger.exception(safe_log(f"Enhanced ML 예측 오류: {e}"))
                    error_msg = str(e)
                    # 오류 발생 시 반드시 UI 스레드에서 플래그 해제
                    self.root.after(0, lambda: self._handle_prediction_error(error_msg))
                finally:
                    # finally 블록에서 확실하게 플래그 해제
                    self.root.after(0, lambda: self._ensure_processing_complete())
            
            # 백그라운드 스레드에서 실행
            threading.Thread(target=ml_single_task, daemon=True).start()
            
        except Exception as e:
            logger.error(safe_log(f"예측 시작 오류: {e}"))
            self.is_processing = False
            self._update_progress(0)
            self._update_status("예측 시작 오류")
            messagebox.showerror("오류", f"예측을 시작할 수 없습니다:\n{str(e)}")
    
    def _handle_prediction_error(self, error_msg: str):
        """예측 오류 처리 - UI 스레드에서 실행"""
        try:
            messagebox.showerror("예측 오류", f"예측 중 오류가 발생했습니다:\n{error_msg}")
        finally:
            self.is_processing = False
            self._update_progress(0)
            self._update_status("예측 오류 발생")
               


    def _run_batch_prediction_ml(self):
        """Enhanced ML 배치 예측"""
        if self.is_processing:
            messagebox.showwarning("처리 중", "예측이 진행 중입니다.")
            return
        
        raw = self.item_text.get("1.0", tk.END)
        codes = []
        for line in raw.splitlines():
            for token in re.split(r"[,\s]+", line.strip()):
                if token:
                    codes.append(token)
        codes = list(dict.fromkeys(codes))
        
        if not codes:
            messagebox.showwarning("입력 필요", "예측할 ITEM_CD를 입력하세요.")
            return
        if self.model_dir is None:
            messagebox.showwarning("모델 필요", "먼저 모델을 로드하세요.")
            return

        mode = self._get_current_prediction_mode()
        similarity_threshold = self._get_current_similarity_threshold()
        
        if len(codes) > 50:
            if mode == "detailed":
                estimated_time = max(30, len(codes) // 1)
                mode_desc = "상세 라우팅 (공정별 다중 행)"
            else:
                estimated_time = max(15, len(codes) // 2)
                mode_desc = "시간 시나리오 (요약 단일 행)"
                
            model_type = "Enhanced" if self.current_model_info.get('is_enhanced') else "Basic"
                
            if not messagebox.askyesno("대량 처리", 
                                    f"[ML] {len(codes)}개 품목을 처리합니다.\n"
                                    f"[모드] {mode_desc}\n"
                                    f"[모델] {model_type} ML 모델\n"
                                    f"[유사도] {similarity_threshold:.0%} 이상 필터링\n"
                                    f"[예상] 소요시간: 약 {estimated_time}초\n\n"
                                    f"계속하시겠습니까?"):
                return

        self.is_processing = True
        
        def ml_batch_task():
            start_time = time.time()
            
            try:
                pred_mode = "detailed" if mode == "detailed" else "summary"
                routing_selection = self._get_current_routing_selection()
                logger.info(safe_log(f"[ML] Enhanced 배치 예측 시작: {len(codes)}개 품목, 모드: {pred_mode}"))
                
                self._update_status(safe_text(f"[ML] {len(codes)}개 품목 Enhanced 분석 중..."))
                self.root.after(0, lambda: self._update_progress(10))
                
                # 배치 처리를 위한 개별 예측 및 결합
                all_routing = []
                all_candidates = []
                
                existing_count = 0  # 기존 라우팅 카운트
                ml_count = 0       # ML 예측 카운트
                
                for i, code in enumerate(codes):
                    # Enhanced ML 예측
                    routing_df, cand_df, model_info = predict_single_item_with_ml_enhanced(
                        code, 
                        self.model_dir, 
                        top_k=self.topk_var.get(),
                        config=get_scenario_config(),
                        mode=pred_mode,
                        routing_selection=routing_selection
                    )
                    
                    # 첫 번째 품목의 모델 정보 저장
                    if i == 0:
                        self.current_model_info = model_info
                    
                    if not routing_df.empty:
                        # 기존 라우팅인지 ML 예측인지 확인
                        if 'PREDICTION_TYPE' in routing_df.columns:
                            if routing_df['PREDICTION_TYPE'].iloc[0] == 'EXISTING':
                                existing_count += 1
                                # 기존 라우팅에 시간 계산 컬럼 추가
                                if 'STANDARD_TIME' not in routing_df.columns:
                                    routing_df['STANDARD_TIME'] = routing_df['SETUP_TIME'] + routing_df['RUN_TIME']
                                if 'OPTIMAL_TIME' not in routing_df.columns:
                                    routing_df['OPTIMAL_TIME'] = routing_df['STANDARD_TIME']
                                if 'SAFE_TIME' not in routing_df.columns:
                                    routing_df['SAFE_TIME'] = routing_df['STANDARD_TIME'] * 1.2
                            else:
                                ml_count += 1
                        
                        all_routing.append(routing_df)
                    
                    if not cand_df.empty:
                        # ITEM_CD 추가
                        cand_df['ITEM_CD'] = code
                        all_candidates.append(cand_df)
                    
                    # 진행률 업데이트
                    progress = min(10 + int((i / len(codes)) * 70), 80)
                    self.root.after(0, lambda p=progress: self._update_progress(p))
                
                # 결과 결합
                if all_routing:
                    final_routing_df = pd.concat(all_routing, ignore_index=True)
                else:
                    final_routing_df = pd.DataFrame()
                
                if all_candidates:
                    final_candidates_df = pd.concat(all_candidates, ignore_index=True)
                else:
                    final_candidates_df = pd.DataFrame()
                
                self.root.after(0, lambda: self._update_progress(90))
                
                # 결과 처리
                if not final_routing_df.empty:
                    total_time = time.time() - start_time
                    
                    # 성능 통계
                    if pred_mode == "detailed":
                        # ITEM_CD 또는 INPUT_ITEM_CD 사용
                        item_col = 'INPUT_ITEM_CD' if 'INPUT_ITEM_CD' in final_routing_df.columns else 'ITEM_CD'
                        unique_items = final_routing_df[item_col].nunique()
                        total_processes = len(final_routing_df)
                        avg_processes = total_processes / unique_items if unique_items > 0 else 0
                        
                        performance_msg = (f"Enhanced 상세 라우팅 예측 완료!\n\n"
                                        f"[ML] Enhanced ML 기반 예측\n"
                                        f"[모델] {'Enhanced' if self.current_model_info.get('is_enhanced') else 'Basic'}\n"
                                        f"[통계] 처리 시간: {total_time:.1f}초\n"
                                        f"[분석] 처리된 품목: {unique_items}개\n"
                                        f"  - 기존 라우팅: {existing_count}개\n"
                                        f"  - ML 예측: {ml_count}개\n"
                                        f"[공정] 총 공정 수: {total_processes}개\n"
                                        f"[평균] 품목당 공정: {avg_processes:.1f}개\n"
                                        f"[유사도] {similarity_threshold:.0%}+ 필터링")
                    else:
                        unique_items = len(final_routing_df)
                        
                        # STANDARD_TIME이 있는지 확인
                        if 'STANDARD_TIME' in final_routing_df.columns:
                            total_predicted_time = final_routing_df['STANDARD_TIME'].sum()
                        else:
                            # SETUP_TIME + RUN_TIME으로 계산
                            total_predicted_time = (final_routing_df.get('SETUP_TIME', 0).sum() + 
                                                final_routing_df.get('RUN_TIME', 0).sum())
                        
                        # CONFIDENCE가 있는지 확인 (ML 예측만)
                        if 'CONFIDENCE' in final_routing_df.columns:
                            ml_routing = final_routing_df[
                                final_routing_df.get('PREDICTION_TYPE', '') == 'ML_BASED'
                            ]
                            if not ml_routing.empty:
                                avg_confidence = ml_routing['CONFIDENCE'].mean()
                            else:
                                avg_confidence = 1.0  # 모두 기존 라우팅인 경우
                        else:
                            avg_confidence = 1.0
                        
                        performance_msg = (f"Enhanced 시간 시나리오 예측 완료!\n\n"
                                        f"[ML] Enhanced ML 기반 예측\n"
                                        f"[모델] {'Enhanced' if self.current_model_info.get('is_enhanced') else 'Basic'}\n"
                                        f"[통계] 처리 시간: {total_time:.1f}초\n"
                                        f"[분석] 처리된 품목: {unique_items}개\n"
                                        f"  - 기존 라우팅: {existing_count}개\n"
                                        f"  - ML 예측: {ml_count}개\n"
                                        f"[예상] 총 시간: {total_predicted_time:.1f}분\n"
                                        f"[신뢰도] 평균: {avg_confidence:.1%}\n"
                                        f"[유사도] {similarity_threshold:.0%}+ 필터링")
                    
                    self.root.after(0, lambda: self._finalize_batch_ml(final_routing_df, final_candidates_df))
                    self.root.after(0, lambda: messagebox.showinfo("처리 완료", performance_msg))
                else:
                    self.root.after(0, lambda: messagebox.showwarning(
                        "결과 없음", 
                        f"처리된 결과가 없습니다.\n\n"
                        f"가능한 원인:\n"
                        f"• 입력 품목들의 정보가 없음\n"
                        f"• 유사도 임계값 {similarity_threshold:.0%}가 너무 높음\n"
                        f"• 유사 품목들에 라우팅 데이터가 없음"
                    ))
                    
            except Exception as e:
                logger.exception(safe_log(f"Enhanced 배치 처리 오류: {e}"))
                error_msg = str(e)  # 변수를 미리 캡처
                self.root.after(0, lambda: messagebox.showerror("처리 실패", f"배치 처리 중 오류: {error_msg}"))
            finally:
                self.is_processing = False
                self.root.after(0, lambda: self._update_progress(0))

        threading.Thread(target=ml_batch_task, daemon=True).start()

    def _finalize_single_ml(self, routing_df: pd.DataFrame, cand_df: pd.DataFrame):
        """Enhanced ML 단일 예측 완료 처리 - 개선"""
        try:
            self._update_progress(100)
            
            # 결과 저장
            self.current_routing = routing_df
            self.current_candidates = cand_df
            
            # ITEM_CD를 INPUT_ITEM_CD로 복사 (호환성 유지)
            if not routing_df.empty:
                if 'ITEM_CD' in routing_df.columns and 'INPUT_ITEM_CD' not in routing_df.columns:
                    routing_df['INPUT_ITEM_CD'] = routing_df['ITEM_CD']
            
            # 빈 결과 확인
            if routing_df.empty:
                logger.warning(safe_log("[경고] 예측 결과가 없습니다"))
                
                if not cand_df.empty:
                    self._refresh_table(self.candidate_table, cand_df, cand_mode=True)
                    
                    if 'MESSAGE' in routing_df.columns and len(routing_df) > 0:
                        error_msg = routing_df['MESSAGE'].iloc[0]
                        messagebox.showwarning("예측 실패", error_msg)
                
                self._update_status(safe_text("[경고] 예측 실패 - 라우팅 데이터 없음"))
            else:
                # 정상 처리
                self._refresh_table(self.routing_table, routing_df)
                
                # 후보 테이블은 ML 예측인 경우에만 표시
                if 'PREDICTION_TYPE' in routing_df.columns and \
                routing_df['PREDICTION_TYPE'].iloc[0] == 'ML_BASED':
                    self._refresh_table(self.candidate_table, cand_df, cand_mode=True)
                else:
                    # 기존 라우팅인 경우 후보 테이블 초기화
                    self.candidate_table.delete(*self.candidate_table.get_children())
                
                # 완료 메시지
                mode = self._get_current_prediction_mode()
                
                if 'PREDICTION_TYPE' in routing_df.columns:
                    pred_type = routing_df['PREDICTION_TYPE'].iloc[0]
                    if pred_type == 'EXISTING':
                        self._update_status(safe_text(f"[완료] 기존 라우팅 표시 완료"))
                    else:
                        model_type = "Enhanced" if self.current_model_info.get('is_enhanced') else "Basic"
                        if mode == "detailed":
                            self._update_status(safe_text(f"[완료] {model_type} ML 기반 상세 라우팅 예측 완료"))
                        else:
                            self._update_status(safe_text(f"[완료] {model_type} ML 기반 시간 시나리오 예측 완료"))
                else:
                    self._update_status(safe_text("[완료] 라우팅 예측 완료"))
            
            # 통계 업데이트
            self._update_stats()
            
        except Exception as e:
            logger.error(safe_log(f"단일 예측 완료 처리 오류: {e}"))
            self._update_status(safe_text("[오류] 예측 완료 처리 실패"))
        finally:
            # 처리 완료 후 플래그 해제 (중요!)
            self.is_processing = False
            self._update_progress(0)
            logger.info(safe_log("[예측] 처리 완료, is_processing = False"))
    
    
    def _ensure_processing_complete(self):
        """처리 완료 보장 함수 - 더 강력하게"""
        try:
            if self.is_processing:
                logger.info(safe_log("[보장] is_processing 플래그 강제 해제"))
                self.is_processing = False
            
            # 프로그레스바 초기화
            if hasattr(self, 'progress'):
                self._update_progress(0)
            
            # 버튼 상태 복원
            if hasattr(self, 'single_btn'):
                self.single_btn.config(state="normal")
            if hasattr(self, 'batch_btn'):
                self.batch_btn.config(state="normal")
            
            # 상태 메시지 업데이트
            self._update_status("준비됨")
            
        except Exception as e:
            logger.error(safe_log(f"처리 완료 보장 중 오류: {e}"))

    # 긴급 복구 버튼 기능도 개선
    def _emergency_reset(self) -> None:
        """긴급 상황 복구 - 처리 상태 강제 리셋"""
        try:
            # 모든 처리 플래그 초기화
            self.is_processing = False
            self.stop_training.clear()
            self._update_progress(0)
            
            # UI 상태 초기화
            self._toggle_ui("normal")
            self._update_status(safe_text("[긴급] 긴급 복구 완료 - 다시 사용할 수 있습니다"))
            
            logger.warning(safe_log("[긴급] 긴급 복구 실행: 처리 상태가 강제로 초기화되었습니다"))
        
            messagebox.showinfo("긴급 복구", 
                            "[긴급] 처리 상태가 초기화되었습니다!\n\n"
                            "이제 다시 예측을 실행할 수 있습니다.")
        
        except Exception as e:
            logger.error(safe_log(f"긴급 복구 실패: {e}"))
            messagebox.showerror("복구 실패", f"긴급 복구 중 오류: {str(e)}")



    def _finalize_batch_ml(self, routing_df: pd.DataFrame, candidates_df: pd.DataFrame):
        """Enhanced ML 배치 예측 완료 처리"""
        try:
            start_time = time.time()
            
            # 데이터 저장
            self.current_routing = routing_df
            self.current_candidates = candidates_df
            
            # ITEM_CD를 INPUT_ITEM_CD로 복사 (호환성 유지)
            if not routing_df.empty:
                if 'ITEM_CD' in routing_df.columns and 'INPUT_ITEM_CD' not in routing_df.columns:
                    routing_df['INPUT_ITEM_CD'] = routing_df['ITEM_CD']
            
            # 빈 결과 확인
            if routing_df.empty:
                logger.warning(safe_log("[경고] 예측 결과가 없습니다"))
                
                if not candidates_df.empty:
                    self._refresh_table(self.candidate_table, candidates_df, cand_mode=True)
                    
                    if 'SIMILARITY_SCORE' in candidates_df.columns:
                        max_sim = candidates_df['SIMILARITY_SCORE'].max()
                        avg_sim = candidates_df['SIMILARITY_SCORE'].mean()
                        
                        msg = (f"예측 실패 - 라우팅 데이터 없음\n\n"
                            f"원인:\n"
                            f"• 최고 유사도: {max_sim:.1%} (임계값: {self._get_current_similarity_threshold():.0%})\n"
                            f"• 평균 유사도: {avg_sim:.1%}\n"
                            f"• 유사품 중 라우팅 데이터가 없음\n\n"
                            f"해결 방법:\n"
                            f"• 유사도 임계값을 낮춰보세요 (현재: {self._get_current_similarity_threshold():.0%})\n"
                            f"• Top-K를 늘려보세요 (현재: {self.topk_var.get()}개)\n"
                            f"• 다른 품목으로 시도해보세요")
                        
                        messagebox.showwarning("예측 실패", msg)
                
                self._update_stats()
                self._update_status(safe_text("[경고] 예측 결과 없음 - 유사품에 라우팅 데이터가 없습니다"))
                
            else:
                # 정상 처리
                total_items = len(routing_df)
                
                # 라우팅 테이블 업데이트
                self._update_status(safe_text(f"[렌더링] 라우팅 테이블 업데이트 중... ({total_items}행)"))
                self.root.update_idletasks()
                
                self._refresh_table(self.routing_table, routing_df)
                logger.info(safe_log(f"[렌더링] 라우팅 테이블 완료: {total_items}행"))
                
                # 후보 테이블 업데이트
                if not candidates_df.empty:
                    self._update_status(safe_text(f"[렌더링] 후보 테이블 업데이트 중... ({len(candidates_df)}행)"))
                    self.root.update_idletasks()
                    
                    self._refresh_table(self.candidate_table, candidates_df, cand_mode=True)
                    logger.info(safe_log(f"[렌더링] 후보 테이블 완료: {len(candidates_df)}행"))
                
                # 통계 업데이트
                self._update_stats()
                
                # 완료
                finish_time = time.time() - start_time
                model_type = "Enhanced" if self.current_model_info.get('is_enhanced') else "Basic"
                self._update_status(safe_text(f"[완료] {model_type} ML 배치 예측 완료: {total_items}개 품목 분석 완료"))
                
                logger.info(safe_log(f"[종료] {model_type} ML 배치 예측 완료: {total_items}개 품목, UI: {finish_time:.2f}초"))
            
        except Exception as e:
            logger.error(safe_log(f"배치 완료 처리 오류: {e}"))
            self._update_status(safe_text("[오류] 배치 완료 처리 실패"))
            messagebox.showerror("처리 오류", f"결과 표시 중 오류:\n{str(e)}")

    # ═══════════════════════════════════════════════
    # 결과 관리 메서드들
    # ═══════════════════════════════════════════════
    
    def _refresh_table(self, tree: ttk.Treeview, df: pd.DataFrame, *, cand_mode=False):
        """테이블 렌더링 - 기존 라우팅과 ML 예측 구분 표시"""
        try:
            # 현재 모드 확인
            current_mode = self._get_current_prediction_mode()
            
            # 표시용 DataFrame 생성 (원본 보존)
            if not cand_mode and not df.empty:
                # 라우팅 테이블인 경우 특정 컬럼 제거
                display_df = df.copy()
                for col in ['ROUT_NO', 'INPUT_ITEM_CD']:
                    if col in display_df.columns:
                        display_df = display_df.drop(columns=[col])
                df = display_df
            
            # 기존 데이터 삭제
            tree.delete(*tree.get_children())
            if df.empty:
                return
            
            columns = list(df.columns)
            
            # 후보 테이블이 아니고 PREDICTION_TYPE이 있으면 스타일 적용 준비
            has_prediction_type = not cand_mode and 'PREDICTION_TYPE' in columns
            
            # 모드에 따른 컬럼 처리
            if not cand_mode:
                if current_mode == "summary":
                    # 시간 요약 모드: 시간 관련 컬럼만 표시
                    summary_cols = [
                        'ITEM_CD', 'PREDICTION_TYPE', 'SETUP_TIME', 'RUN_TIME', 
                        'STANDARD_TIME', 'OPTIMAL_TIME', 'SAFE_TIME',
                        'CONFIDENCE', 'AVG_SIMILARITY', 'SIMILAR_ITEMS_USED',
                        'TIME_CV', 'SCENARIO', 'MESSAGE'
                    ]
                    # 존재하는 컬럼만 필터링
                    columns = [col for col in summary_cols if col in columns]
                    df = df[columns]
                    
                    logger.info(f"[렌더링] 시간 요약 모드: {len(columns)}개 컬럼 표시")
                    
                elif current_mode == "detailed" and 'PROC_SEQ' in columns:
                    # 상세 라우팅 모드: 모든 공정 정보 표시
                    important_routing_cols = [
                        'PREDICTION_TYPE', 'ITEM_CD', 'PROC_SEQ', 'INSIDE_FLAG', 'JOB_CD', 'JOB_NM', 
                        'RES_CD', 'RES_DIS', 'TIME_UNIT', 'SETUP_TIME', 'RUN_TIME',
                        'STANDARD_TIME', 'OPTIMAL_TIME', 'SAFE_TIME', 'CONFIDENCE',
                        'REFERENCE_ITEM', 'SIMILARITY_SCORE', 'SAMPLES_USED', 'MESSAGE',
                        'AVG_SIMILARITY', 'SIMILAR_ITEMS_USED', 'TIME_CV', 'SCENARIO',
                        'SOURCE_ITEMS'
                    ]
                    
                    # 존재하는 컬럼만 필터링
                    display_cols = [col for col in important_routing_cols if col in columns]
                    
                    # 추가로 누락된 중요 컬럼들 확인
                    remaining_cols = [col for col in columns if col not in display_cols]
                    
                    # 최대 25개 컬럼까지 표시
                    if len(display_cols) < 25:
                        additional_cols = remaining_cols[:25 - len(display_cols)]
                        display_cols.extend(additional_cols)
                    
                    columns = display_cols
                    df = df[columns]
                    
                    logger.info(f"[렌더링] 상세 라우팅 모드: {len(columns)}개 컬럼 표시")
            
            # 일반적인 컬럼 수 제한 (성능 향상)
            elif len(columns) > 20:
                logger.warning(safe_log(f"컬럼 수가 많음: {len(columns)}개 → 20개로 제한"))
                important_cols = []
                for col in columns:
                    if any(keyword in col.upper() for keyword in 
                        ['ROUT_NO', 'INPUT_ITEM', 'ITEM_CD', 'PREDICTION_TYPE', 'PROC_SEQ', 'JOB_CD', 'JOB_NM', 'RES_CD', 
                        'SETUP_TIME', 'RUN_TIME', 'STANDARD_TIME', 'OPTIMAL_TIME', 'SAFE_TIME',
                        'CONFIDENCE', 'SIMILARITY', 'CANDIDATE', 'AVG_SIMILARITY', 'HAS_ROUTING']):
                        important_cols.append(col)
                    if len(important_cols) >= 20:
                        break
                
                if important_cols:
                    columns = important_cols
                    df = df[columns]
                else:
                    columns = columns[:20]
                    df = df[columns]
            
            tree["columns"] = columns
        
            # 컬럼 헤더 설정
            for col in columns:
                safe_header = safe_text(col)
                tree.heading(col, text=safe_header)
                
                # 컬럼 너비 최적화
                if 'ROUT_NO' in col:
                    tree.column(col, width=100, minwidth=80, stretch=False)
                elif 'PREDICTION_TYPE' in col:
                    tree.column(col, width=100, minwidth=80, stretch=False)
                elif 'MESSAGE' in col:
                    tree.column(col, width=150, minwidth=100, stretch=True)
                elif 'HAS_ROUTING' in col:
                    tree.column(col, width=100, minwidth=80, stretch=False)
                elif 'ITEM_CD' in col or 'JOB_CD' in col:
                    tree.column(col, width=100, minwidth=80, stretch=False)
                elif 'TIME' in col or 'HOUR' in col:
                    tree.column(col, width=90, minwidth=70, stretch=False)
                elif 'SEQ' in col or 'FLG' in col:
                    tree.column(col, width=60, minwidth=50, stretch=False)
                elif 'NM' in col or 'NAME' in col:
                    tree.column(col, width=150, minwidth=100, stretch=True)
                elif 'SIMILARITY' in col or 'CONFIDENCE' in col:
                    tree.column(col, width=80, minwidth=60, stretch=False)
                elif 'AVG_SIMILARITY' in col or 'SAMPLES_USED' in col:
                    tree.column(col, width=100, minwidth=80, stretch=False)
                elif 'SOURCE_ITEMS' in col:
                    tree.column(col, width=200, minwidth=150, stretch=True)
                else:
                    tree.column(col, width=120, minwidth=80, stretch=False)
            
            # 태그 스타일 설정
            if has_prediction_type:
                tree.tag_configure('existing', background='#e8f5e9', foreground='#1b5e20')  # 녹색 계열
                tree.tag_configure('ml_based', background='#e3f2fd', foreground='#0d47a1')  # 파란색 계열
            
            # 후보 테이블에서 라우팅 존재 여부 스타일
            if cand_mode and 'HAS_ROUTING' in columns:
                tree.tag_configure('has_routing', background='#e8f5e9', foreground='#1b5e20')
                tree.tag_configure('no_routing', background='#ffebee', foreground='#b71c1c')
            
            # ROUT_NO 통일 스타일
            tree.tag_configure('predicted_routing', background='#fff3e0', foreground='#e65100')  # 주황색 계열
            
            # 데이터 삽입 최적화
            total_rows = len(df)
            
            # 라우팅 데이터인 경우 PROC_SEQ로 정렬
            if 'PROC_SEQ' in df.columns:
                # 품목 컬럼 찾기
                item_col = None
                if 'INPUT_ITEM_CD' in df.columns:
                    item_col = 'INPUT_ITEM_CD'
                elif 'ITEM_CD' in df.columns:
                    item_col = 'ITEM_CD'
                
                if item_col:
                    df = df.sort_values([item_col, 'PROC_SEQ'])
                else:
                    df = df.sort_values('PROC_SEQ')
                logger.info(f"[렌더링] 라우팅 데이터 정렬 완료: PROC_SEQ 기준")
            
            # 배치 처리 최적화
            batch_size = min(20, max(5, 100 // len(columns)))
            
            for i, (_, row) in enumerate(df.iterrows()):
                try:
                    values = []
                    for v in row:
                        if pd.isna(v):
                            values.append("")
                        elif isinstance(v, float):
                            if abs(v) < 0.01:
                                values.append("0")
                            elif abs(v) < 1:
                                values.append(f"{v:.2f}")
                            else:
                                values.append(f"{v:.1f}")
                        else:
                            text = safe_text(str(v))
                            if len(text) > 50:
                                text = text[:47] + "..."
                            values.append(text)
                    
                    # 태그 결정
                    tags = ()
                    
                    # ROUT_NO가 PREDICTED인 경우 강조
                    if 'ROUT_NO' in row and row['ROUT_NO'] == 'PREDICTED':
                        tags = ('predicted_routing',)
                    elif has_prediction_type:
                        pred_type = row.get('PREDICTION_TYPE', '')
                        if pred_type == 'EXISTING':
                            tags = ('existing',)
                        elif pred_type == 'ML_BASED':
                            tags = ('ml_based',)
                    
                    if cand_mode and 'HAS_ROUTING' in row:
                        routing_status = row.get('HAS_ROUTING', '')
                        if '있음' in routing_status:
                            tags = ('has_routing',)
                        elif '없음' in routing_status:
                            tags = ('no_routing',)
                    
                    # TreeView에 행 추가
                    tree.insert("", tk.END, values=values, tags=tags)
                    
                    # 주기적 GUI 업데이트
                    if i % batch_size == 0 and i > 0:
                        progress = min(90, int((i / total_rows) * 80) + 10)
                        self._update_status(safe_text(f"[렌더링] {progress}% 완료 ({i+1}/{total_rows}행)"))
                        self.root.update_idletasks()
                        
                except Exception as e:
                    logger.error(safe_log(f"행 {i} 삽입 오류: {e}"))
                    continue
            
            # 로그 출력 개선
            if 'PREDICTION_TYPE' in df.columns:
                existing_count = len(df[df['PREDICTION_TYPE'] == 'EXISTING'])
                ml_count = len(df[df['PREDICTION_TYPE'] == 'ML_BASED'])
                logger.info(f"[렌더링] 예측 타입: 기존 {existing_count}개, ML {ml_count}개")
            
            if 'ROUT_NO' in df.columns and not cand_mode:
                rout_info = df['ROUT_NO'].value_counts()
                logger.info(f"[렌더링] ROUT_NO 분포: {dict(rout_info)}")
            
            self._update_status(safe_text(f"[완료] 테이블 렌더링 완료 ({total_rows}행 × {len(columns)}컬럼)"))
            logger.info(safe_log(f"[렌더링] 테이블 완료: {total_rows}행 × {len(columns)}컬럼"))
            
        except Exception as e:
            logger.error(safe_log(f"테이블 렌더링 오류: {e}"))
            self._update_status(safe_text("[오류] 테이블 렌더링 실패"))

    def _on_candidate_double_click(self, event):
        """후보 테이블 더블클릭 처리 - 개선"""
        try:
            # 디바운싱: 0.5초 이내의 연속 클릭 방지
            current_time = time.time()
            if current_time - self.last_click_time < 0.5:
                logger.debug(safe_log("[디바운싱] 너무 빠른 더블클릭 무시"))
                return
            self.last_click_time = current_time
            
            # 이미 처리 중이면 무시
            if self.is_processing:
                logger.warning(safe_log("[경고] 이미 예측이 진행 중입니다. 더블클릭 무시"))
                self._update_status("이미 예측이 진행 중입니다. 잠시 기다려주세요.")
                # 메시지박스 대신 상태바에만 표시 (UX 개선)
                return
            
            # 선택된 아이템 확인
            item_id = self.candidate_table.focus()
            if not item_id:
                logger.debug(safe_log("[더블클릭] 선택된 항목 없음"))
                return
                
            values = self.candidate_table.item(item_id, "values")
            if not values:
                logger.debug(safe_log("[더블클릭] 값이 없음"))
                return
            
            # CANDIDATE_ITEM_CD 컬럼 찾기
            try:
                columns = self.candidate_table["columns"]
                if "CANDIDATE_ITEM_CD" in columns:
                    cand_index = columns.index("CANDIDATE_ITEM_CD")
                else:
                    logger.error(safe_log("[오류] CANDIDATE_ITEM_CD 컬럼을 찾을 수 없습니다"))
                    messagebox.showerror("오류", "후보 품목 컬럼을 찾을 수 없습니다.")
                    return
                    
                cand_code = values[cand_index]
                logger.info(safe_log(f"[더블클릭] 선택된 후보 품목: {cand_code}"))
                
            except (ValueError, IndexError) as e:
                logger.error(safe_log(f"[오류] 후보 품목 코드 추출 실패: {e}"))
                messagebox.showerror("오류", "후보 품목 정보를 가져올 수 없습니다.")
                return
            
            # 입력 필드 업데이트
            self.item_text.delete("1.0", tk.END)
            self.item_text.insert("1.0", cand_code)
            
            # UI 업데이트
            self._update_status(f"[준비] {cand_code} 예측 준비 중...")
            logger.info(safe_log(f"[더블클릭] {cand_code} 예측 시작"))
            
            # 예측 실행 - 약간의 딜레이를 주어 UI 업데이트 보장
            self.root.after(100, self._predict_single_item_ml)
            
        except Exception as e:
            logger.error(safe_log(f"후보 더블클릭 오류: {e}"))
            messagebox.showerror("오류", f"후보 품목 선택 중 오류가 발생했습니다:\n{str(e)}")
            # 오류 발생 시에도 is_processing 플래그 해제
            self.is_processing = False

    def _save_to_csv(self):
        """개선된 CSV 저장 기능 - Enhanced 모델 정보 포함"""
        if self.current_routing.empty:
            messagebox.showwarning("저장 오류", "저장할 결과가 없습니다.")
            return
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        similarity_threshold = self._get_current_similarity_threshold()
        mode = self._get_current_prediction_mode()
        mode_str = "detailed" if mode == "detailed" else "summary"
        model_type = "enhanced" if self.current_model_info.get('is_enhanced') else "basic"
        default_filename = f"ml_routing_{model_type}_{mode_str}_sim{similarity_threshold:.0%}_{timestamp}.csv"
        
        path = filedialog.asksaveasfilename(
            title="Enhanced ML 예측 결과 저장", 
            initialfile=default_filename,
            defaultextension=".csv",
            filetypes=[
                ("CSV 파일 (Excel 호환)", "*.csv"),
                ("Excel 파일", "*.xlsx"),
                ("모든 파일", "*.*")
            ]
        )
        if not path:
            return
        
        try:
            if path.lower().endswith('.xlsx'):
                # Excel 저장
                with pd.ExcelWriter(path, engine='openpyxl') as writer:
                    self.current_routing.to_excel(writer, sheet_name='ML_라우팅_예측', index=False)
                    if not self.current_candidates.empty:
                        self.current_candidates.to_excel(writer, sheet_name='유사품목', index=False)
                    
                    # 요약 시트 추가
                    if 'OPTIMAL_TIME' in self.current_routing.columns:
                        summary_data = {
                            '메트릭': ['총 공정 수', '총 최적 시간 (분)', 
                                      '총 표준 시간 (분)', '총 안전 시간 (분)',
                                      '평균 신뢰도', '평균 유사도', '유사도 임계값',
                                      '예측 모드', 'Top-K', '모델 타입'],
                            '값': [
                                len(self.current_routing),
                                self.current_routing['OPTIMAL_TIME'].sum(),
                                self.current_routing['STANDARD_TIME'].sum(),
                                self.current_routing['SAFE_TIME'].sum(),
                                self.current_routing.get('CONFIDENCE', [0]).mean(),
                                self.current_routing.get('AVG_SIMILARITY', [0]).mean(),
                                f"{similarity_threshold:.0%}",
                                '상세 라우팅' if mode == 'detailed' else '시간 요약',
                                self.topk_var.get(),
                                'Enhanced' if self.current_model_info.get('is_enhanced') else 'Basic'
                            ]
                        }
                        summary_df = pd.DataFrame(summary_data)
                        summary_df.to_excel(writer, sheet_name='예측_요약', index=False)
                        
                        # Enhanced ML 모델 정보 시트
                        if self.model_dir and self.current_model_info:
                            model_info = {
                                '항목': ['모델 경로', '특성 수', 'Enhanced 모델', 
                                       'PCA 적용', '분산 선택기', 'Feature 가중치',
                                       '벡터 차원', '학습 품목 수'],
                                '내용': [
                                    self.model_dir,
                                    len(self.feature_columns) if self.feature_columns else 'N/A',
                                    '예' if self.current_model_info.get('is_enhanced') else '아니오',
                                    '예' if self.current_model_info.get('has_pca') else '아니오',
                                    '예' if self.current_model_info.get('has_variance_selector') else '아니오',
                                    '예' if self.current_model_info.get('has_feature_weights') else '아니오',
                                    self.current_model_info.get('vector_dimension', 'N/A'),
                                    self.current_model_info.get('total_items', 'N/A')
                                ]
                            }
                            model_df = pd.DataFrame(model_info)
                            model_df.to_excel(writer, sheet_name='Enhanced_모델_정보', index=False)
                            
            else:
                # CSV 저장
                self.current_routing.to_csv(path, index=False, encoding="utf-8-sig")
                
                # 후보 결과도 별도 저장
                if not self.current_candidates.empty:
                    candidates_path = path.replace(".csv", "_candidates.csv")
                    self.current_candidates.to_csv(
                        candidates_path, index=False, encoding="utf-8-sig")
            
            logger.info(safe_log(f"[완료] Enhanced ML 예측 결과 저장: {path}"))
            logger.info(safe_log(f"[설정] 모드: {mode_str}, 유사도: {similarity_threshold:.0%}+, 모델: {model_type}"))
            
            messagebox.showinfo("저장 완료", 
                              f"Enhanced ML 예측 결과가 저장되었습니다!\n"
                              f"[파일] {path}\n\n"
                              f"[분석] 분석 정보: {len(self.current_routing)}행\n"
                              f"[후보] 후보 정보: {len(self.current_candidates)}행\n"
                              f"[모드] 예측 모드: {'상세 라우팅' if mode == 'detailed' else '시간 요약'}\n"
                              f"[모델] {'Enhanced' if self.current_model_info.get('is_enhanced') else 'Basic'} 모델\n"
                              f"[유사도] 필터링: {similarity_threshold:.0%}+ 적용")
            
            self._update_status(safe_text(f"Enhanced ML 예측 결과 저장 완료: {len(self.current_routing)}행"))
            
        except PermissionError:
            logger.error(safe_log("[오류] 파일 접근 권한 오류"))
            messagebox.showerror("저장 실패", 
                               "[오류] 파일 저장 권한이 없습니다!\n\n"
                               "해결 방법:\n"
                               "• 해당 파일이 다른 프로그램에서 열려있다면 닫아주세요\n"
                               "• 다른 폴더나 파일명으로 시도해보세요")
            self._update_status("저장 실패 - 권한 오류")
            
        except Exception as e:
            logger.exception(safe_log(f"[오류] 파일 저장 실패: {str(e)}"))
            messagebox.showerror("저장 실패", f"파일 저장 중 오류가 발생했습니다:\n{str(e)}")
            self._update_status("CSV 내보내기 실패")
            
    def _open_feature_weights_viewer(self):
        """Feature weights 뷰어 열기 - 체크박스 추가"""
        if not self.model_dir:
            messagebox.showwarning("모델 없음", 
                                "모델이 로드되지 않았습니다.\n"
                                "먼저 모델을 학습하거나 로드해주세요.")
            return
        
        try:
            # Feature manager 초기화
            if not hasattr(self, 'feature_manager'):
                self.feature_manager = FeatureWeightManager(self.model_dir)
            
            # 창 생성 - 크기 확대
            weights_window = tk.Toplevel(self.root)
            weights_window.title(safe_text("⚖️ Feature 선택 및 가중치 관리"))
            weights_window.geometry("1400x800")  # 창 크기 확대
            weights_window.configure(bg=KoreanThemeColors.WHITE)
            
            # 헤더
            header_frame = tk.Frame(weights_window, bg=KoreanThemeColors.PRIMARY, height=60)
            header_frame.pack(fill=tk.X)
            header_frame.pack_propagate(False)
            
            header_content = tk.Frame(header_frame, bg=KoreanThemeColors.PRIMARY)
            header_content.pack(fill=tk.BOTH, expand=True, padx=20, pady=15)
            
            tk.Label(
                header_content, text=safe_text("⚖️ Feature 선택 및 가중치 관리"),
                font=self.fonts["title"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
            ).pack(anchor="w")
            
            tk.Label(
                header_content, text="유사품 검색(예측) 시 사용할 피처를 선택합니다 (학습은 모든 피처 사용)",
                font=self.fonts["body"], bg=KoreanThemeColors.PRIMARY, fg=KoreanThemeColors.WHITE
            ).pack(anchor="w")
            
            # 메인 컨테이너
            main_container = tk.Frame(weights_window, bg=KoreanThemeColors.WHITE)
            main_container.pack(fill=tk.BOTH, expand=True)
            
            # 탭 생성
            style = ttk.Style()
            style.configure('Weights.TNotebook', background=KoreanThemeColors.WHITE)
            style.configure('Weights.TNotebook.Tab', padding=[12, 6], font=self.fonts["tab"])
            
            notebook = ttk.Notebook(main_container, style='Weights.TNotebook')
            notebook.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
            
            # =============== 1. Feature 선택 탭 (새로 추가) ===============
            selection_frame = tk.Frame(notebook, bg=KoreanThemeColors.WHITE)
            notebook.add(selection_frame, text="📋 Feature 선택")
            
            # 상단 요약 정보
            summary_frame = tk.LabelFrame(
                selection_frame, text="요약 정보 (예측 시에만 적용)", font=self.fonts["heading"],
                bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK,
                padx=15, pady=10
            )
            summary_frame.pack(fill=tk.X, padx=10, pady=(10, 5))
            
            summary_stats = self.feature_manager.get_summary_statistics()
            summary_text = f"""
    전체 피처: {summary_stats['total_features']}개
    활성화된 피처: {summary_stats['active_features']}개
    활성화 비율: {summary_stats['active_ratio']:.1%}
    평균 가중치: {summary_stats['weight_statistics']['mean']:.2f}
            """
            
            summary_label = tk.Label(
                summary_frame, text=summary_text.strip(),
                font=self.fonts["body"], bg=KoreanThemeColors.WHITE,
                justify=tk.LEFT
            )
            summary_label.pack(anchor="w")
            
            # 버튼 프레임
            button_frame = tk.Frame(selection_frame, bg=KoreanThemeColors.WHITE)
            button_frame.pack(fill=tk.X, padx=10, pady=5)
            
            # 자동 선택 버튼들
            auto_select_frame = tk.Frame(button_frame, bg=KoreanThemeColors.WHITE)
            auto_select_frame.pack(side=tk.LEFT)
            
            tk.Label(
                auto_select_frame, text="자동 선택:",
                font=self.fonts["body"], bg=KoreanThemeColors.WHITE
            ).pack(side=tk.LEFT, padx=(0, 10))
            
            def auto_select_important():
                """중요도 기반 자동 선택"""
                self.feature_manager.auto_select_features(threshold=0.7)
                refresh_checkboxes()
                update_summary()
                messagebox.showinfo("자동 선택", "중요도 0.7 이상의 피처를 선택했습니다.")
            
            auto_important_btn = tk.Button(
                auto_select_frame, text="🎯 중요 피처만",
                command=auto_select_important
            )
            self._configure_korean_button(auto_important_btn, "info")
            auto_important_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            def auto_select_essential():
                """핵심 피처만 선택"""
                self.feature_manager.auto_select_features(threshold=0.8)
                refresh_checkboxes()
                update_summary()
                messagebox.showinfo("자동 선택", "핵심 피처만 선택했습니다.")
            
            auto_essential_btn = tk.Button(
                auto_select_frame, text="⭐ 핵심만",
                command=auto_select_essential
            )
            self._configure_korean_button(auto_essential_btn, "warning")
            auto_essential_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            # 전체 선택/해제 버튼
            select_all_btn = tk.Button(
                button_frame, text="✅ 전체 선택",
                command=lambda: toggle_all(True)
            )
            self._configure_korean_button(select_all_btn, "success")
            select_all_btn.pack(side=tk.LEFT, padx=(20, 5))
            
            deselect_all_btn = tk.Button(
                button_frame, text="❌ 전체 해제",
                command=lambda: toggle_all(False)
            )
            self._configure_korean_button(deselect_all_btn, "error")
            deselect_all_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            # 스크롤 가능한 체크박스 영역
            canvas = tk.Canvas(selection_frame, bg=KoreanThemeColors.WHITE, highlightthickness=0)
            scrollbar = ttk.Scrollbar(selection_frame, orient="vertical", command=canvas.yview)
            scrollable_frame = tk.Frame(canvas, bg=KoreanThemeColors.WHITE)
            
            scrollable_frame.bind(
                "<Configure>",
                lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
            )
            
            canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
            canvas.configure(yscrollcommand=scrollbar.set)
            
            canvas.pack(side="left", fill="both", expand=True, padx=(10, 0))
            scrollbar.pack(side="right", fill="y", padx=(0, 10))
            
            # 체크박스 변수 저장
            checkbox_vars = {}
            checkbox_widgets = {}
            
            # Feature 그룹별로 체크박스 생성
            for group_name, features in self.feature_manager.FEATURE_GROUPS.items():
                # 그룹 프레임 - 크기 확대
                group_frame = tk.LabelFrame(
                    scrollable_frame, text=safe_text(group_name),
                    font=self.fonts["heading"], bg=KoreanThemeColors.WHITE,
                    fg=KoreanThemeColors.BLACK, padx=20, pady=15  # 패딩 증가
                )
                group_frame.pack(fill=tk.X, padx=15, pady=8, ipadx=80)  # 패딩과 내부 패딩 증가
                
                # 그룹 내 피처들
                for feature in features:
                    if feature in self.feature_manager.feature_weights:
                        # 피처 정보 가져오기
                        feature_info = self.feature_manager.get_feature_info(feature)
                        
                        # 체크박스 프레임
                        cb_frame = tk.Frame(group_frame, bg=KoreanThemeColors.WHITE)
                        cb_frame.pack(fill=tk.X, pady=3)  # 간격 증가
                        
                        # 체크박스 변수
                        var = tk.BooleanVar(value=feature_info['active'])
                        checkbox_vars[feature] = var
                        
                        # 체크박스
                        checkbox = tk.Checkbutton(
                            cb_frame, text="", variable=var,
                            bg=KoreanThemeColors.WHITE,
                            command=lambda: update_summary()
                        )
                        checkbox.pack(side=tk.LEFT, padx=(0, 10))  # 간격 증가
                        checkbox_widgets[feature] = checkbox
                        
                        # Feature 이름 (클릭하면 체크박스 토글) - 너비 증가
                        name_label = tk.Label(
                            cb_frame, text=feature, width=35, anchor="w",  # width 증가
                            font=self.fonts["body"], bg=KoreanThemeColors.WHITE,
                            cursor="hand2"
                        )
                        name_label.pack(side=tk.LEFT, padx=(0, 20))  # 간격 증가
                        name_label.bind("<Button-1>", lambda e, f=feature: toggle_feature(f))
                        
                        # 가중치 표시
                        weight_label = tk.Label(
                            cb_frame, text=f"가중치: {feature_info['weight']:.2f}",
                            width=15, font=self.fonts["small"],  # width 증가
                            bg=KoreanThemeColors.WHITE,
                            fg=KoreanThemeColors.DARK_GRAY
                        )
                        weight_label.pack(side=tk.LEFT, padx=(0, 20))  # 간격 증가
                        
                        # 중요도 표시 (있는 경우)
                        if feature_info['importance'] > 0:
                            # 중요도에 따른 색상
                            if feature_info['importance'] >= 0.8:
                                imp_color = KoreanThemeColors.SUCCESS
                            elif feature_info['importance'] >= 0.6:
                                imp_color = KoreanThemeColors.WARNING
                            else:
                                imp_color = KoreanThemeColors.INFO
                            
                            importance_label = tk.Label(
                                cb_frame, text=f"중요도: {feature_info['importance']:.2f}",
                                width=18, font=self.fonts["small"],  # width 증가
                                bg=KoreanThemeColors.WHITE, fg=imp_color
                            )
                            importance_label.pack(side=tk.LEFT)
                            
                            # 추천 레벨 표시
                            recommendations = self.feature_manager.get_feature_recommendation()
                            rec_level = ""
                            for level, features_list in recommendations.items():
                                if feature in features_list:
                                    rec_level = level.split(' ')[0]
                                    break
                            
                            if rec_level:
                                rec_label = tk.Label(
                                    cb_frame, text=f"[{rec_level}]",
                                    font=self.fonts["small"],
                                    bg=KoreanThemeColors.WHITE,
                                    fg=KoreanThemeColors.PRIMARY
                                )
                                rec_label.pack(side=tk.LEFT, padx=(15, 0))
            
            def toggle_feature(feature_name):
                """피처 체크박스 토글"""
                if feature_name in checkbox_vars:
                    current = checkbox_vars[feature_name].get()
                    checkbox_vars[feature_name].set(not current)
                    update_summary()
            
            def toggle_all(select: bool):
                """전체 선택/해제"""
                for var in checkbox_vars.values():
                    var.set(select)
                update_summary()
            
            def update_summary():
                """요약 정보 업데이트"""
                active_count = sum(var.get() for var in checkbox_vars.values())
                total_count = len(checkbox_vars)
                active_ratio = active_count/total_count if total_count > 0 else 0
                
                summary_text = f"""
    전체 피처: {total_count}개
    활성화된 피처: {active_count}개
    활성화 비율: {active_ratio:.1%}
                """
                summary_label.config(text=summary_text.strip())
            
            def refresh_checkboxes():
                """체크박스 상태 새로고침"""
                for feature, var in checkbox_vars.items():
                    var.set(self.feature_manager.active_features.get(feature, True))
            
            # =============== 2. 현재 가중치 탭 (기존 수정) ===============
            weights_frame = tk.Frame(notebook, bg=KoreanThemeColors.WHITE)
            notebook.add(weights_frame, text="⚖️ 가중치 현황")
            
            # 상단 요약 패널
            summary_panel = tk.Frame(weights_frame, bg=KoreanThemeColors.WHITE)
            summary_panel.pack(fill=tk.X, padx=15, pady=(10, 5))
            
            # 요약 통계 계산
            if self.feature_manager.feature_weights:
                active_weights = [w for f, w in self.feature_manager.feature_weights.items() 
                                if self.feature_manager.active_features.get(f, True)]
                active_importances = [self.feature_manager.feature_importance.get(f, 0) 
                                    for f in self.feature_manager.feature_weights 
                                    if self.feature_manager.active_features.get(f, True)]
                
                if active_weights:
                    avg_weight = sum(active_weights) / len(active_weights)
                    max_weight = max(active_weights)
                    min_weight = min(active_weights)
                else:
                    avg_weight = max_weight = min_weight = 0
                
                if active_importances:
                    avg_importance = sum(active_importances) / len(active_importances)
                    max_importance = max(active_importances)
                else:
                    avg_importance = max_importance = 0
                
                # 요약 정보 표시
                summary_info = tk.LabelFrame(
                    summary_panel, text="📊 전체 요약", font=self.fonts["heading"],
                    bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK,
                    padx=15, pady=10
                )
                summary_info.pack(fill=tk.X)
                
                # 2열 레이아웃
                left_col = tk.Frame(summary_info, bg=KoreanThemeColors.WHITE)
                left_col.pack(side=tk.LEFT, padx=(0, 50))
                
                right_col = tk.Frame(summary_info, bg=KoreanThemeColors.WHITE)
                right_col.pack(side=tk.LEFT)
                
                # 왼쪽 열 - 가중치 정보
                tk.Label(
                    left_col, text=f"평균 가중치: {avg_weight:.2f}",
                    font=self.fonts["body"], bg=KoreanThemeColors.WHITE
                ).pack(anchor="w")
                
                tk.Label(
                    left_col, text=f"최대 가중치: {max_weight:.2f}",
                    font=self.fonts["body"], bg=KoreanThemeColors.WHITE
                ).pack(anchor="w")
                
                tk.Label(
                    left_col, text=f"최소 가중치: {min_weight:.2f}",
                    font=self.fonts["body"], bg=KoreanThemeColors.WHITE
                ).pack(anchor="w")
                
                # 오른쪽 열 - 중요도 정보
                tk.Label(
                    right_col, text=f"평균 중요도: {avg_importance:.2f}",
                    font=self.fonts["body"], bg=KoreanThemeColors.WHITE
                ).pack(anchor="w")
                
                tk.Label(
                    right_col, text=f"최대 중요도: {max_importance:.2f}",
                    font=self.fonts["body"], bg=KoreanThemeColors.WHITE
                ).pack(anchor="w")
                
                # 중요 피처 수
                high_importance_count = sum(1 for imp in active_importances if imp >= 0.6)
                tk.Label(
                    right_col, text=f"핵심 피처 (중요도≥0.6): {high_importance_count}개",
                    font=self.fonts["body"], bg=KoreanThemeColors.WHITE,
                    fg=KoreanThemeColors.SUCCESS
                ).pack(anchor="w")
                
                # 범례 추가 (더 예쁘게)
                legend_frame = tk.Frame(summary_info, bg=KoreanThemeColors.WHITE)
                legend_frame.pack(fill=tk.X, pady=(15, 0))
                
                # 범례 컨테이너 (둥근 테두리 효과)
                legend_container = tk.Frame(
                    legend_frame, bg=KoreanThemeColors.LIGHT_GRAY,
                    relief="solid", bd=1
                )
                legend_container.pack(fill=tk.X, padx=5, pady=5)
                
                legend_inner = tk.Frame(legend_container, bg="#f8f9fa", padx=15, pady=8)
                legend_inner.pack(fill=tk.BOTH, expand=True, padx=1, pady=1)
                
                tk.Label(
                    legend_inner, text="🎨 시각적 가이드",
                    font=self.fonts["heading"], bg="#f8f9fa",
                    fg=KoreanThemeColors.BLACK
                ).pack(anchor="w", pady=(0, 8))
                
                # 가중치 범례
                weight_legend_frame = tk.Frame(legend_inner, bg="#f8f9fa")
                weight_legend_frame.pack(fill=tk.X, pady=(0, 5))
                
                tk.Label(
                    weight_legend_frame, text="가중치 범례:",
                    font=self.fonts["small"], bg="#f8f9fa",
                    fg=KoreanThemeColors.DARK_GRAY
                ).pack(side=tk.LEFT, padx=(0, 15))
                
                weight_legends = [
                    ("🔥 2.5+", KoreanThemeColors.ERROR, "매우 높음"),
                    ("⚡ 2.0-2.5", KoreanThemeColors.WARNING, "높음"),
                    ("✨ 1.5-2.0", KoreanThemeColors.SUCCESS, "적정"),
                    ("💫 1.5 미만", KoreanThemeColors.PRIMARY, "보통")
                ]
                
                for emoji_range, color, desc in weight_legends:
                    item_frame = tk.Frame(weight_legend_frame, bg="#f8f9fa")
                    item_frame.pack(side=tk.LEFT, padx=(0, 20))
                    
                    tk.Label(
                        item_frame, text=emoji_range,
                        font=self.fonts["small"], bg="#f8f9fa", fg=color
                    ).pack(side=tk.LEFT, padx=(0, 3))
                    
                    tk.Label(
                        item_frame, text=desc,
                        font=self.fonts["small"], bg="#f8f9fa",
                        fg=KoreanThemeColors.DARK_GRAY
                    ).pack(side=tk.LEFT)
                
                # 중요도 범례
                importance_legend_frame = tk.Frame(legend_inner, bg="#f8f9fa")
                importance_legend_frame.pack(fill=tk.X)
                
                tk.Label(
                    importance_legend_frame, text="중요도 범례:",
                    font=self.fonts["small"], bg="#f8f9fa",
                    fg=KoreanThemeColors.DARK_GRAY
                ).pack(side=tk.LEFT, padx=(0, 15))
                
                importance_legends = [
                    ("⭐ 0.8+", "#1e8449", "핵심"),
                    ("🌟 0.6-0.8", "#27ae60", "중요"),
                    ("✨ 0.4-0.6", "#3498db", "보통"),
                    ("💫 0.2-0.4", "#95a5a6", "낮음"),
                    ("☆ 0.2 미만", "#bdc3c7", "매우 낮음")
                ]
                
                for emoji_range, color, desc in importance_legends:
                    item_frame = tk.Frame(importance_legend_frame, bg="#f8f9fa")
                    item_frame.pack(side=tk.LEFT, padx=(0, 20))
                    
                    tk.Label(
                        item_frame, text=emoji_range,
                        font=self.fonts["small"], bg="#f8f9fa", fg=color
                    ).pack(side=tk.LEFT, padx=(0, 3))
                    
                    tk.Label(
                        item_frame, text=desc,
                        font=self.fonts["small"], bg="#f8f9fa",
                        fg=KoreanThemeColors.DARK_GRAY
                    ).pack(side=tk.LEFT)
            
            # 스크롤 가능한 영역
            weights_canvas = tk.Canvas(weights_frame, bg=KoreanThemeColors.WHITE, highlightthickness=0)
            weights_scrollbar = ttk.Scrollbar(weights_frame, orient="vertical", command=weights_canvas.yview)
            weights_scrollable_frame = tk.Frame(weights_canvas, bg=KoreanThemeColors.WHITE)
            
            weights_scrollable_frame.bind(
                "<Configure>",
                lambda e: weights_canvas.configure(scrollregion=weights_canvas.bbox("all"))
            )
            
            weights_canvas.create_window((0, 0), window=weights_scrollable_frame, anchor="nw")
            weights_canvas.configure(yscrollcommand=weights_scrollbar.set)
            
            weights_canvas.pack(side="left", fill="both", expand=True)
            weights_scrollbar.pack(side="right", fill="y")
            
            # Feature 그룹별로 표시 (활성화된 것만)
            for group_name, features in self.feature_manager.FEATURE_GROUPS.items():
                # 활성화된 피처만 필터링
                active_features = [f for f in features 
                                if f in self.feature_manager.feature_weights 
                                and self.feature_manager.active_features.get(f, True)]
                
                if not active_features:
                    continue
                
                # 그룹 헤더 - 크기 확대
                group_frame = tk.LabelFrame(
                    weights_scrollable_frame, text="",
                    font=self.fonts["heading"], bg=KoreanThemeColors.WHITE,
                    fg=KoreanThemeColors.BLACK, padx=20, pady=15
                )
                group_frame.pack(fill=tk.X, padx=15, pady=8)
                
                # 그룹 헤더 커스텀 (더 예쁘게)
                group_header = tk.Frame(group_frame, bg=KoreanThemeColors.WHITE)
                group_header.pack(fill=tk.X, pady=(0, 10))
                
                # 그룹 아이콘 결정
                group_icons = {
                    "품목 기본정보": "📋",
                    "씰 타입 정보": "🔧",
                    "치수 정보": "📏",
                    "소재 정보": "🏭",
                    "표준화 정보": "📊",
                    "회전 정보": "🔄",
                    "기타 정보": "📌"
                }
                
                group_icon = group_icons.get(group_name, "📁")
                
                tk.Label(
                    group_header, text=f"{group_icon} {group_name}",
                    font=self.fonts["heading"], bg=KoreanThemeColors.WHITE,
                    fg=KoreanThemeColors.BLACK
                ).pack(side=tk.LEFT)
                
                # 활성화 비율 표시 (배지 스타일)
                active_ratio = len(active_features) / len([f for f in features if f in self.feature_manager.feature_weights]) if features else 0
                
                if active_ratio >= 0.8:
                    badge_bg = "#d5f4e6"
                    badge_fg = "#1e8449"
                    badge_text = f"✅ {len(active_features)}개 활성"
                elif active_ratio >= 0.5:
                    badge_bg = "#fff3cd"
                    badge_fg = "#856404"
                    badge_text = f"⚡ {len(active_features)}개 활성"
                else:
                    badge_bg = "#f8d7da"
                    badge_fg = "#721c24"
                    badge_text = f"⚠️ {len(active_features)}개 활성"
                
                badge_frame = tk.Frame(
                    group_header, bg=badge_bg,
                    relief="solid", bd=1, highlightbackground=badge_fg
                )
                badge_frame.pack(side=tk.RIGHT)
                
                tk.Label(
                    badge_frame, text=badge_text,
                    font=self.fonts["small"], bg=badge_bg, fg=badge_fg,
                    padx=8, pady=2
                ).pack()
                
                # 각 feature 표시
                for feature in active_features:
                    weight = self.feature_manager.feature_weights[feature]
                    importance = self.feature_manager.feature_importance.get(feature, 0)
                    
                    # 메인 행 컨테이너
                    main_row = tk.Frame(group_frame, bg=KoreanThemeColors.WHITE)
                    main_row.pack(fill=tk.X, pady=5)
                    
                    # Feature 이름
                    feature_label = tk.Label(
                        main_row, text=feature, width=35, anchor="w",
                        font=self.fonts["body"], bg=KoreanThemeColors.WHITE
                    )
                    feature_label.pack(side=tk.LEFT, padx=(0, 25))
                    
                    # 그래프 영역 (가중치와 중요도를 가로로 배치)
                    graphs_frame = tk.Frame(main_row, bg=KoreanThemeColors.WHITE)
                    graphs_frame.pack(side=tk.LEFT, padx=(0, 20))
                    
                    # ========= 통합 그래프 행 (가로 배치) =========
                    graph_row = tk.Frame(graphs_frame, bg=KoreanThemeColors.WHITE)
                    graph_row.pack(fill=tk.X)
                    
                    # 가중치 라벨
                    tk.Label(
                        graph_row, text="가중치:", width=6, anchor="e",
                        font=self.fonts["small"], bg=KoreanThemeColors.WHITE,
                        fg=KoreanThemeColors.DARK_GRAY
                    ).pack(side=tk.LEFT, padx=(0, 5))
                    
                    # 가중치 바를 위한 Canvas (둥근 모서리 효과)
                    weight_canvas = tk.Canvas(
                        graph_row, width=120, height=20,
                        bg=KoreanThemeColors.WHITE, highlightthickness=0
                    )
                    weight_canvas.pack(side=tk.LEFT, padx=(0, 5))
                    
                    # 가중치 바 배경 (둥근 사각형)
                    weight_canvas.create_rectangle(
                        2, 2, 118, 18,
                        fill=KoreanThemeColors.LIGHT_GRAY,
                        outline="",
                        width=0
                    )
                    
                    # 가중치 바 전경 (그라데이션 효과를 위한 여러 사각형)
                    max_weight = 3.0
                    weight_ratio = min(weight / max_weight, 1.0)
                    weight_bar_width = int(114 * weight_ratio)
                    
                    # 가중치에 따른 색상
                    if weight >= 2.5:
                        bar_color = KoreanThemeColors.ERROR
                        emoji = "🔥"
                    elif weight >= 2.0:
                        bar_color = KoreanThemeColors.WARNING
                        emoji = "⚡"
                    elif weight >= 1.5:
                        bar_color = KoreanThemeColors.SUCCESS
                        emoji = "✨"
                    else:
                        bar_color = KoreanThemeColors.PRIMARY
                        emoji = "💫"
                    
                    if weight_bar_width > 0:
                        # 메인 바
                        weight_canvas.create_rectangle(
                            3, 3, 3 + weight_bar_width, 17,
                            fill=bar_color,
                            outline="",
                            width=0
                        )
                        
                        # 하이라이트 효과 (상단)
                        weight_canvas.create_rectangle(
                            3, 3, 3 + weight_bar_width, 6,
                            fill=self._lighten_color(bar_color, 0.3),
                            outline="",
                            width=0
                        )
                    
                    # 가중치 값
                    weight_text = f"{weight:.2f}"
                    if weight > 3.0:
                        weight_text = f"{weight:.2f}⚠️"
                        weight_color = KoreanThemeColors.ERROR
                    else:
                        weight_color = KoreanThemeColors.BLACK
                    
                    tk.Label(
                        graph_row, text=f"{emoji} {weight_text}", width=8,
                        font=self.fonts["small"], bg=KoreanThemeColors.WHITE,
                        fg=weight_color
                    ).pack(side=tk.LEFT, padx=(0, 15))
                    
                    # 구분선
                    tk.Label(
                        graph_row, text="│", 
                        font=self.fonts["small"], bg=KoreanThemeColors.WHITE,
                        fg=KoreanThemeColors.LIGHT_GRAY
                    ).pack(side=tk.LEFT, padx=(0, 15))
                    
                    # 중요도 라벨
                    tk.Label(
                        graph_row, text="중요도:", width=6, anchor="e",
                        font=self.fonts["small"], bg=KoreanThemeColors.WHITE,
                        fg=KoreanThemeColors.DARK_GRAY
                    ).pack(side=tk.LEFT, padx=(0, 5))
                    
                    # 중요도 바를 위한 Canvas
                    importance_canvas = tk.Canvas(
                        graph_row, width=120, height=20,
                        bg=KoreanThemeColors.WHITE, highlightthickness=0
                    )
                    importance_canvas.pack(side=tk.LEFT, padx=(0, 5))
                    
                    # 중요도 바 배경 (둥근 사각형)
                    importance_canvas.create_rectangle(
                        2, 2, 118, 18,
                        fill=KoreanThemeColors.LIGHT_GRAY,
                        outline="",
                        width=0
                    )
                    
                    # 중요도 바 전경
                    importance_bar_width = int(114 * importance)
                    
                    # 중요도에 따른 색상과 이모지
                    if importance >= 0.8:
                        importance_bar_color = "#1e8449"  # 더 진한 초록색
                        imp_emoji = "⭐"
                    elif importance >= 0.6:
                        importance_bar_color = "#27ae60"  # 초록색
                        imp_emoji = "🌟"
                    elif importance >= 0.4:
                        importance_bar_color = "#3498db"  # 파란색
                        imp_emoji = "✨"
                    elif importance >= 0.2:
                        importance_bar_color = "#95a5a6"  # 회색
                        imp_emoji = "💫"
                    else:
                        importance_bar_color = "#bdc3c7"  # 연한 회색
                        imp_emoji = "☆"
                    
                    if importance_bar_width > 0:
                        # 메인 바
                        importance_canvas.create_rectangle(
                            3, 3, 3 + importance_bar_width, 17,
                            fill=importance_bar_color,
                            outline="",
                            width=0
                        )
                        
                        # 하이라이트 효과
                        importance_canvas.create_rectangle(
                            3, 3, 3 + importance_bar_width, 6,
                            fill=self._lighten_color(importance_bar_color, 0.3),
                            outline="",
                            width=0
                        )
                    
                    # 중요도 값
                    importance_color = KoreanThemeColors.BLACK
                    if importance >= 0.8:
                        importance_color = "#1e8449"
                    elif importance >= 0.6:
                        importance_color = "#27ae60"
                    
                    tk.Label(
                        graph_row, text=f"{imp_emoji} {importance:.3f}", width=8,
                        font=self.fonts["small"], bg=KoreanThemeColors.WHITE,
                        fg=importance_color
                    ).pack(side=tk.LEFT)
                    
                    # ========= 추가 정보 (종합 점수) =========
                    # 종합 점수 계산 (가중치와 중요도 결합)
                    combined_score = importance * 0.6 + (weight / 3.0) * 0.4
                    
                    score_frame = tk.Frame(main_row, bg=KoreanThemeColors.WHITE)
                    score_frame.pack(side=tk.LEFT, padx=(15, 0))
                    
                    # 종합 점수에 따른 시각적 표현
                    if combined_score >= 0.8:
                        score_display = "🏆 최우수"
                        score_color = "#1e8449"
                        score_bg = "#d5f4e6"
                    elif combined_score >= 0.6:
                        score_display = "🥇 우수"
                        score_color = "#27ae60"
                        score_bg = "#e8f8f5"
                    elif combined_score >= 0.4:
                        score_display = "🥈 양호"
                        score_color = "#3498db"
                        score_bg = "#ebf5fb"
                    elif combined_score >= 0.2:
                        score_display = "🥉 보통"
                        score_color = "#95a5a6"
                        score_bg = "#f4f6f6"
                    else:
                        score_display = "📊 개선필요"
                        score_color = "#7f8c8d"
                        score_bg = "#f8f9f9"
                    
                    # 종합 점수 표시 (배지 스타일)
                    score_badge = tk.Frame(
                        score_frame, bg=score_bg,
                        relief="solid", bd=1, highlightbackground=score_color
                    )
                    score_badge.pack(side=tk.LEFT)
                    
                    tk.Label(
                        score_badge, text=score_display,
                        font=self.fonts["small"], bg=score_bg, fg=score_color,
                        padx=8, pady=2
                    ).pack()
                    
                    # 점수 값
                    tk.Label(
                        score_frame, text=f"{combined_score:.2f}",
                        font=self.fonts["small"], bg=KoreanThemeColors.WHITE,
                        fg=KoreanThemeColors.DARK_GRAY
                    ).pack(side=tk.LEFT, padx=(5, 0))
            
            # =============== 3. Feature Importance 탭 (기존) ===============
            importance_frame = tk.Frame(notebook, bg=KoreanThemeColors.WHITE)
            notebook.add(importance_frame, text="📊 중요도 분석")
            
            # TreeView로 표시
            tree_frame = tk.Frame(importance_frame, bg=KoreanThemeColors.WHITE)
            tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
            
            columns = ["Feature", "활성", "Importance", "Weight", "Combined Score", "Recommendation"]
            tree = ttk.Treeview(tree_frame, columns=columns, show="headings", height=20)
            
            # 컬럼 너비 설정 - 전체적으로 증가
            for col in columns:
                tree.heading(col, text=col)
                if col == "Feature":
                    tree.column(col, width=300)  # 너비 증가
                elif col == "활성":
                    tree.column(col, width=70)  # 너비 증가
                elif col == "Recommendation":
                    tree.column(col, width=200)  # 너비 증가
                else:
                    tree.column(col, width=140)  # 너비 증가
            
            # 데이터 삽입
            if self.feature_manager.feature_importance:
                sorted_features = sorted(
                    self.feature_manager.feature_importance.items(),
                    key=lambda x: x[1], reverse=True
                )
                
                recommendations = self.feature_manager.get_feature_recommendation()
                
                for feature, importance in sorted_features:
                    weight = self.feature_manager.feature_weights.get(feature, 1.0)
                    combined = importance * 0.6 + (weight / 3.0) * 0.4
                    active = self.feature_manager.active_features.get(feature, True)
                    
                    # 권장사항 찾기
                    rec = "일반"
                    for rec_type, features in recommendations.items():
                        if feature in features:
                            rec = rec_type.split(' ')[0]
                            break
                    
                    tree.insert("", tk.END, values=(
                        feature,
                        "✓" if active else "✗",
                        f"{importance:.3f}",
                        f"{weight:.2f}",
                        f"{combined:.3f}",
                        rec
                    ))
            
            tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            
            tree_scroll = ttk.Scrollbar(tree_frame, orient="vertical", command=tree.yview)
            tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
            tree.config(yscrollcommand=tree_scroll.set)
            
            # =============== 4. 권장사항 탭 (기존) ===============
            recommend_frame = tk.Frame(notebook, bg=KoreanThemeColors.WHITE)
            notebook.add(recommend_frame, text="💡 권장사항")
            
            recommend_text = tk.Text(
                recommend_frame, font=self.fonts["body"], wrap=tk.WORD,
                bg=KoreanThemeColors.LIGHT_GRAY, fg=KoreanThemeColors.BLACK,
                relief="solid", bd=1
            )
            recommend_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
            
            # 권장사항 텍스트 생성
            rec_content = "📊 Feature 사용 권장사항\n" + "="*50 + "\n\n"
            
            recommendations = self.feature_manager.get_feature_recommendation()
            for category, features in recommendations.items():
                if features:
                    rec_content += f"\n🔹 {category}:\n"
                    for i, feature in enumerate(features[:10]):  # 최대 10개만
                        weight = self.feature_manager.feature_weights.get(feature, 1.0)
                        importance = self.feature_manager.feature_importance.get(feature, 0)
                        active = self.feature_manager.active_features.get(feature, True)
                        status = "✓ 활성" if active else "✗ 비활성"
                        rec_content += f"   {i+1}. {feature} ({status}, 가중치: {weight:.2f}, 중요도: {importance:.3f})\n"
            
            # 씰 제조 특화 정보 추가
            rec_content += "\n\n💡 씰 제조 도메인 최적화 정보:\n" + "-"*40 + "\n"
            rec_content += """
    - SealTypeGrup, IN/OUT/MID_SEALTYPE_CD가 가장 중요
    - 치수 정보 (DIAMETER, THICKNESS)가 공정 시간에 큰 영향
    - RAW_MATL_KIND와 ITEM_MATERIAL이 가공 난이도 결정
    - STANDARD_YN이 'Y'인 경우 표준 공정 적용 가능
    - ROTATE 방향은 씰 장착 공정에 영향

    ⚡ 활성화 권장:
    - 중요도 0.6 이상의 피처는 반드시 활성화
    - 가중치 1.5 이상의 피처도 활성화 권장
    - 비활성화된 중요 피처가 있으면 예측 성능 저하 가능

    📌 참고사항:
    - 피처 활성화/비활성화는 예측(유사품 검색) 시에만 적용
    - 학습은 항상 모든 피처를 사용하여 진행
    - 도메인 지식을 활용해 불필요한 피처를 제외하면 더 정확한 예측 가능
            """
            
            recommend_text.insert("1.0", safe_text(rec_content))
            recommend_text.config(state=tk.DISABLED)
            
            # =============== 하단 버튼 ===============
            button_frame = tk.Frame(weights_window, bg=KoreanThemeColors.WHITE)
            button_frame.pack(fill=tk.X, padx=15, pady=(0, 15))
            
            # 씰 제조 최적화 버튼
            optimize_btn = tk.Button(button_frame, text="🔧 씰 제조 최적화 적용")
            self._configure_korean_button(optimize_btn, "warning")
            optimize_btn.configure(command=lambda: self._apply_seal_optimization(weights_window))
            optimize_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            # 적용 버튼 (새로 추가)
            def apply_selection():
                """선택한 피처 적용"""
                # 현재 체크박스 상태를 active_features에 반영
                new_active = {feature: var.get() for feature, var in checkbox_vars.items()}
                self.feature_manager.update_active_features(new_active)
                
                active_count = sum(new_active.values())
                total_count = len(new_active)
                
                messagebox.showinfo(
                    "적용 완료", 
                    f"Feature 선택이 적용되었습니다.\n\n"
                    f"활성화된 피처: {active_count}개 / {total_count}개\n"
                    f"비활성화된 피처는 예측(유사품 검색) 시 제외됩니다.\n\n"
                    f"※ 학습은 여전히 모든 피처를 사용합니다."
                )
                
                # 모델 상태 업데이트
                self._update_model_status()
            
            apply_btn = tk.Button(button_frame, text="✅ 선택 적용")
            self._configure_korean_button(apply_btn, "success")
            apply_btn.configure(command=apply_selection)
            apply_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            # 가중치 저장 버튼
            save_weights_btn = tk.Button(button_frame, text="💾 설정 저장")
            self._configure_korean_button(save_weights_btn, "success")
            save_weights_btn.configure(command=lambda: self._save_feature_weights())
            save_weights_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            # 초기화 버튼
            reset_btn = tk.Button(button_frame, text="🔄 초기화")
            self._configure_korean_button(reset_btn, "error")
            reset_btn.configure(
                command=lambda: self._reset_feature_settings(weights_window, checkbox_vars)
            )
            reset_btn.pack(side=tk.LEFT, padx=(0, 5))
            
            # 닫기 버튼
            close_btn = tk.Button(button_frame, text="닫기")
            self._configure_korean_button(close_btn, "secondary")
            close_btn.configure(command=weights_window.destroy)
            close_btn.pack(side=tk.RIGHT)
            
            logger.info(safe_log("⚖️ Feature 선택 뷰어가 열렸습니다"))
            
        except Exception as e:
            logger.error(safe_log(f"Feature weights 뷰어 오류: {e}"))
            messagebox.showerror("오류", f"Feature weights 표시 중 오류:\n{str(e)}")

    def _reset_feature_settings(self, parent_window, checkbox_vars):
        """Feature 설정 초기화"""
        if messagebox.askyesno("초기화 확인", 
                            "모든 Feature 설정을 초기값으로 되돌리시겠습니까?\n\n"
                            "가중치와 활성화 상태가 모두 초기화됩니다."):
            try:
                self.feature_manager.reset_to_defaults()
                self.feature_manager.save_weights()
                
                # 체크박스 상태 새로고침
                for feature, var in checkbox_vars.items():
                    var.set(self.feature_manager.active_features.get(feature, True))
                
                messagebox.showinfo("초기화 완료", "Feature 설정이 초기화되었습니다.")
                parent_window.destroy()
                self._open_feature_weights_viewer()  # 새로고침
                
            except Exception as e:
                logger.error(safe_log(f"초기화 오류: {e}"))
                messagebox.showerror("오류", f"초기화 중 오류:\n{str(e)}")

    def _update_model_status(self):
        """모델 상태 텍스트 업데이트 - Enhanced 정보 및 Feature 선택 정보 포함"""
        if not hasattr(self, 'model_status_text'):
            return
        
        try:
            if self.searcher is None:
                status_text = "모델이 로드되지 않았습니다.\n학습하거나 모델을 로드해주세요."
            else:
                # 기본 정보
                status_text = f"""[완료] Enhanced ML 모델 상태
    • 특성 수: {len(self.feature_columns)}개 차원"""
                
                # Enhanced 모델 정보
                if self.current_model_info:
                    status_text += f"""
    • Enhanced 모델: {'예' if self.current_model_info.get('is_enhanced') else '아니오'}
    • PCA 적용: {'예' if self.current_model_info.get('has_pca') else '아니오'}"""
                
                # Feature 선택 정보 추가
                if hasattr(self, 'feature_manager'):
                    total_features = len(self.feature_manager.feature_weights)
                    active_features = sum(self.feature_manager.active_features.values())
                    active_ratio = active_features / total_features if total_features > 0 else 0
                    
                    status_text += f"""
    • 활성 피처 (예측): {active_features}개 / {total_features}개 ({active_ratio:.1%})"""
                
                # 시간 정보
                status_text += f"""
    • 업데이트: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    • 상태: Enhanced ML 기반 라우팅 예측 준비 완료"""
            
            self.model_status_text.delete("1.0", tk.END)
            self.model_status_text.insert("1.0", status_text)
            
        except Exception as e:
            logger.error(f"모델 상태 업데이트 오류: {e}")

    def _apply_seal_optimization(self, parent_window):
        """씰 제조 최적화 가중치 적용"""
        if messagebox.askyesno("씰 제조 최적화", 
                            "씰 제조 도메인에 최적화된 가중치를 적용하시겠습니까?\n\n"
                            "이 작업은 기존 가중치를 덮어씁니다."):
            try:
                self.feature_manager.optimize_for_seal_manufacturing()
                self.feature_manager.save_weights()
                
                messagebox.showinfo("완료", "씰 제조 최적화 가중치가 적용되었습니다.")
                parent_window.destroy()
                self._open_feature_weights_viewer()  # 새로고침
                
            except Exception as e:
                logger.error(safe_log(f"씰 제조 최적화 적용 오류: {e}"))
                messagebox.showerror("오류", f"최적화 적용 중 오류:\n{str(e)}")

    def _save_feature_weights(self):
        """Feature weights 저장"""
        try:
            self.feature_manager.save_weights()
            messagebox.showinfo("저장 완료", "Feature weights가 저장되었습니다.")
            logger.info(safe_log("Feature weights 저장 완료"))
        except Exception as e:
            logger.error(safe_log(f"Feature weights 저장 오류: {e}"))
            messagebox.showerror("저장 오류", f"저장 중 오류 발생:\n{str(e)}")


# ═══════════════════════════════════════════════
# 🚀 메인 실행
# ═══════════════════════════════════════════════
def main():
    """Enhanced GUI 메인 실행 함수"""
    root = tk.Tk()
    
    # 기본 설정
    root.option_add('*tearOff', False)
    
    # DPI 스케일링 설정
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except:
        pass
    
    # Enhanced GUI 생성
    app = RoutingGUI(root)
    
    # 메인 루프 실행
    root.mainloop()


if __name__ == "__main__":
    main()