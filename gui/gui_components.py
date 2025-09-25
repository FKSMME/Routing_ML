"""
GUI Components and Utilities for FKSM Routing-ML
────────────────────────────────────────────────
재사용 가능한 GUI 컴포넌트, 유틸리티 함수, 테마 설정
"""

from __future__ import annotations

import logging
import tkinter as tk
from tkinter import messagebox, ttk, filedialog
import tkinter.font as tkFont
import json
import pandas as pd
import numpy as np

import sys
import os

# 프로젝트 루트를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.predictor_ml import (
    TimeScenarioConfig,
    get_scenario_config,
    set_scenario_config,
    reset_scenario_config,
)

from common.logger import get_logger

logger = get_logger("gui_components")

# ────────────────────────────────────────────────
# 🔧 인코딩 안전성 유틸리티 함수들
# ────────────────────────────────────────────────

def safe_text(text: str) -> str:
    """이모지 및 특수문자를 안전한 텍스트로 변환"""
    try:
        emoji_map = {
            "🚀": "[고속]",
            "⚡": "[즉시]", 
            "✅": "[완료]",
            "🔧": "[설정]",
            "📊": "[통계]",
            "🏁": "[종료]",
            "💾": "[저장]",
            "🗑️": "[삭제]",
            "🔄": "[새로고침]",
            "🚨": "[긴급]",
            "📈": "[분석]",
            "🔍": "[검색]",
            "📝": "[입력]",
            "⏹️": "[중지]",
            "📂": "[로드]",
            "🎛️": "[제어]",
            "📋": "[라우팅]",
            "🏆": "[후보]",
            "🎯": "[시나리오]",
            "🔀": "[FKSM]",
            "🌟": "[개선]",
            "🧠": "[ML]",
            "🛡️": "[안전]",
            "🟢": "[안정]",
            "🟡": "[보통]",
            "🟠": "[가변]",
            "🚫": "[금지]",
            "📏": "[측정]",
            "💡": "[제안]",
            "⏱️": "[시간]",
            "⚠️": "[경고]"
        }
        
        safe_text_result = text
        for emoji, replacement in emoji_map.items():
            safe_text_result = safe_text_result.replace(emoji, replacement)
        
        safe_text_result.encode('utf-8').decode('utf-8')
        return safe_text_result
        
    except UnicodeError:
        return text.encode('ascii', errors='ignore').decode('ascii')

def safe_log(message: str) -> str:
    """로깅용 안전한 메시지 변환"""
    try:
        safe_msg = safe_text(message)
        safe_msg = ''.join(char for char in safe_msg if ord(char) >= 32 or char in '\n\t')
        return safe_msg
    except Exception:
        return str(message).encode('ascii', errors='ignore').decode('ascii')

# ────────────────────────────────────────────────
# 🎨 Korean Theme Colors
# ────────────────────────────────────────────────
class KoreanThemeColors:
    """한국 사용자에게 친숙한 색상 팔레트"""
    PRIMARY = "#4285f4"
    PRIMARY_LIGHT = "#6fa8f5"
    PRIMARY_DARK = "#1a73e8"
    
    WHITE = "#ffffff"
    LIGHT_GRAY = "#f8fafc"
    GRAY = "#e2e8f0"
    DARK_GRAY = "#64748b"
    BLACK = "#1e293b"
    
    SUCCESS = "#10b981"
    WARNING = "#f59e0b"
    ERROR = "#ef4444"
    INFO = "#3b82f6"

# ────────────────────────────────────────────────
# 🌟 안전한 로깅 핸들러 (인코딩 문제 해결)
# ────────────────────────────────────────────────
class SafeModernTextHandler(logging.Handler):
    """인코딩 안전 로깅 핸들러 - 이모지 문제 완전 해결"""

    def __init__(self, widget: tk.Text, capacity: int = 1_000):
        super().__init__()
        self.widget = widget
        self.capacity = capacity
        self.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
        self._setup_tags()

    def _setup_tags(self):
        """색상 태그 설정"""
        try:
            self.widget.tag_configure("INFO", foreground="#3b82f6")
            self.widget.tag_configure("WARNING", foreground="#f59e0b")
            self.widget.tag_configure("ERROR", foreground="#ef4444")
            self.widget.tag_configure("DEBUG", foreground="#6b7280")
            self.widget.tag_configure("SUCCESS", foreground="#10b981")
        except Exception:
            pass

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            safe_msg = safe_log(msg)
            
            def safe_append() -> None:
                try:
                    if not self.widget.winfo_exists():
                        return
                    
                    tag = record.levelname
                    if "완료" in safe_msg or "성공" in safe_msg or "[완료]" in safe_msg:
                        tag = "SUCCESS"
                    
                    self.widget.insert("end", safe_msg + "\n", tag)
                    self.widget.see("end")
                    
                    try:
                        lines = int(self.widget.index("end-1c").split(".")[0])
                        if lines > self.capacity:
                            self.widget.delete("1.0", f"{lines - self.capacity}.0")
                    except Exception:
                        pass
                        
                except Exception as e:
                    print(f"[로그 핸들러 오류] {e}: {safe_msg}")

            try:
                self.widget.after(0, safe_append)
            except Exception:
                print(f"[로그] {safe_msg}")
            
        except Exception as e:
            print(f"[로깅 처리 실패] {e}")

# ────────────────────────────────────────────────
# 🎯 Statistical Configuration Widget
# ────────────────────────────────────────────────
class StatisticalConfigWidget:
    """통계 설정을 위한 전용 위젯"""
    
    def __init__(self, parent_frame: tk.Frame, fonts: dict):
        self.parent = parent_frame
        self.fonts = fonts
        self.config = get_scenario_config()
        self.vars = {}
        self._create_widgets()
        self._load_current_config()
    
    def _create_widgets(self):
        # 시나리오 계수 설정
        scenario_frame = tk.LabelFrame(
            self.parent, text="[시나리오] 시간 시나리오 계수",
            font=self.fonts["heading"], bg=KoreanThemeColors.WHITE,
            fg=KoreanThemeColors.BLACK, padx=10, pady=10
        )
        scenario_frame.pack(fill=tk.X, pady=(0, 10))
        
        self._create_slider_setting(
            scenario_frame, "optimal_sigma", "[고속] 최적 시그마 (75% 확률)", 
            0.1, 1.5, 0.67, "최적 시나리오를 위한 신뢰 수준"
        )
        
        self._create_slider_setting(
            scenario_frame, "safe_sigma", "[안전] 안전 시그마 (90% 확률)",
            0.5, 3.0, 1.28, "안전 시나리오를 위한 신뢰 수준"
        )
        
        # 유사도 가중치 설정
        similarity_frame = tk.LabelFrame(
            self.parent, text="[ML] 유사도 가중치 설정",
            font=self.fonts["heading"], bg=KoreanThemeColors.WHITE,
            fg=KoreanThemeColors.BLACK, padx=10, pady=10
        )
        similarity_frame.pack(fill=tk.X, pady=(0, 10))
        
        self._create_slider_setting(
            similarity_frame, "similarity_weight_power", "[가중치] 유사도 가중치 제곱",
            1.0, 4.0, 2.0, "높은 유사도에 더 많은 가중치 (1.0=선형, 4.0=강한 가중)"
        )
        
        # 품질 관리 설정
        quality_frame = tk.LabelFrame(
            self.parent, text="[검색] 품질 관리 설정",
            font=self.fonts["heading"], bg=KoreanThemeColors.WHITE,
            fg=KoreanThemeColors.BLACK, padx=10, pady=10
        )
        quality_frame.pack(fill=tk.X, pady=(0, 10))
        
        self._create_slider_setting(
            quality_frame, "process_overlap_threshold", "[새로고침] 공정 일치도 임계값",
            0.1, 1.0, 0.3, "데이터 포함을 위한 최소 공정 일치 비율"
        )
        
        # 이상치 제거 설정
        outlier_frame = tk.Frame(quality_frame, bg=KoreanThemeColors.WHITE)
        outlier_frame.pack(fill=tk.X, pady=5)
        
        self.vars["outlier_detection_enabled"] = tk.BooleanVar(value=True)
        tk.Checkbutton(
            outlier_frame, text="[금지] 이상치 감지 활성화",
            variable=self.vars["outlier_detection_enabled"],
            font=self.fonts["body"], bg=KoreanThemeColors.WHITE,
            command=self._on_outlier_toggle
        ).pack(side=tk.LEFT)
        
        self._create_slider_setting(
            quality_frame, "outlier_z_score_threshold", "[측정] Z-Score 임계값",
            1.0, 4.0, 2.5, "이상치 감지를 위한 Z-score 임계값"
        )
        
        # 액션 버튼들
        action_frame = tk.Frame(self.parent, bg=KoreanThemeColors.WHITE)
        action_frame.pack(fill=tk.X, pady=10)
        
        self.apply_btn = tk.Button(action_frame, text="[완료] 설정 적용")
        self._configure_korean_button(self.apply_btn, "success")
        self.apply_btn.configure(command=self._apply_settings)
        self.apply_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        self.reset_btn = tk.Button(action_frame, text="[새로고침] 기본값 복원")
        self._configure_korean_button(self.reset_btn, "warning")
        self.reset_btn.configure(command=self._reset_settings)
        self.reset_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        self.save_btn = tk.Button(action_frame, text="[저장] 설정 저장")
        self._configure_korean_button(self.save_btn, "secondary")
        self.save_btn.configure(command=self._save_config)
        self.save_btn.pack(side=tk.LEFT, padx=(0, 5))
        
        self.load_btn = tk.Button(action_frame, text="[로드] 설정 로드")
        self._configure_korean_button(self.load_btn, "secondary")
        self.load_btn.configure(command=self._load_config)
        self.load_btn.pack(side=tk.LEFT)
    
    def _create_slider_setting(self, parent: tk.Widget, var_name: str, label: str, 
                              min_val: float, max_val: float, default_val: float, 
                              tooltip: str = ""):
        frame = tk.Frame(parent, bg=KoreanThemeColors.WHITE)
        frame.pack(fill=tk.X, pady=3)
        
        label_frame = tk.Frame(frame, bg=KoreanThemeColors.WHITE)
        label_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        tk.Label(
            label_frame, text=label, font=self.fonts["body"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK, anchor="w"
        ).pack(side=tk.LEFT)
        
        if tooltip:
            tk.Label(
                label_frame, text=f" ({tooltip})", font=self.fonts["small"],
                bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.DARK_GRAY, anchor="w"
            ).pack(side=tk.LEFT)
        
        value_frame = tk.Frame(frame, bg=KoreanThemeColors.WHITE)
        value_frame.pack(side=tk.RIGHT)
        
        self.vars[var_name] = tk.DoubleVar(value=default_val)
        
        value_label = tk.Label(
            value_frame, textvariable=self.vars[var_name], width=6,
            font=self.fonts["body"], bg=KoreanThemeColors.LIGHT_GRAY,
            fg=KoreanThemeColors.BLACK, relief="solid", bd=1
        )
        value_label.pack(side=tk.RIGHT, padx=(5, 0))
        
        slider = tk.Scale(
            value_frame, from_=min_val, to=max_val, resolution=0.01,
            orient=tk.HORIZONTAL, variable=self.vars[var_name],
            length=150, font=self.fonts["small"],
            bg=KoreanThemeColors.WHITE, fg=KoreanThemeColors.BLACK,
            highlightthickness=0, bd=0, troughcolor=KoreanThemeColors.LIGHT_GRAY,
            command=lambda val, lbl=value_label: lbl.config(text=f"{float(val):.2f}")
        )
        slider.pack(side=tk.RIGHT, padx=(0, 5))
    
    def _configure_korean_button(self, btn: tk.Button, style: str = "primary"):
        styles = {
            "primary": {"bg": KoreanThemeColors.PRIMARY, "fg": KoreanThemeColors.WHITE},
            "success": {"bg": KoreanThemeColors.SUCCESS, "fg": KoreanThemeColors.WHITE},
            "warning": {"bg": KoreanThemeColors.WARNING, "fg": KoreanThemeColors.WHITE},
            "error": {"bg": KoreanThemeColors.ERROR, "fg": KoreanThemeColors.WHITE},
            "secondary": {"bg": KoreanThemeColors.GRAY, "fg": KoreanThemeColors.BLACK}
        }
        
        config = styles.get(style, styles["primary"])
        config.update({
            "font": self.fonts["body"], "relief": "flat", "bd": 0,
            "cursor": "hand2", "padx": 15, "pady": 6
        })
        btn.configure(**config)
    
    def _on_outlier_toggle(self):
        enabled = self.vars["outlier_detection_enabled"].get()
        logger.info(safe_log(f"이상치 감지: {'활성화' if enabled else '비활성화'}"))
    
    def _load_current_config(self):
        config = get_scenario_config()
        self.vars["optimal_sigma"].set(config.OPTIMAL_SIGMA)
        self.vars["safe_sigma"].set(config.SAFE_SIGMA)
        self.vars["similarity_weight_power"].set(config.SIMILARITY_WEIGHT_POWER)
        self.vars["process_overlap_threshold"].set(config.PROCESS_OVERLAP_THRESHOLD)
        self.vars["outlier_detection_enabled"].set(config.OUTLIER_DETECTION_ENABLED)
        self.vars["outlier_z_score_threshold"].set(config.OUTLIER_Z_SCORE_THRESHOLD)
    
    def _apply_settings(self):
        try:
            config = TimeScenarioConfig()
            config.OPTIMAL_SIGMA = self.vars["optimal_sigma"].get()
            config.SAFE_SIGMA = self.vars["safe_sigma"].get()
            config.SIMILARITY_WEIGHT_POWER = self.vars["similarity_weight_power"].get()
            config.PROCESS_OVERLAP_THRESHOLD = self.vars["process_overlap_threshold"].get()
            config.OUTLIER_DETECTION_ENABLED = self.vars["outlier_detection_enabled"].get()
            config.OUTLIER_Z_SCORE_THRESHOLD = self.vars["outlier_z_score_threshold"].get()
            
            set_scenario_config(config)
            logger.info(safe_log("[완료] 통계 설정이 성공적으로 적용되었습니다"))
            messagebox.showinfo("설정 적용", "통계 설정이 성공적으로 적용되었습니다!")
            
        except Exception as e:
            logger.error(safe_log(f"설정 적용 실패: {e}"))
            messagebox.showerror("설정 오류", f"설정 적용 중 오류가 발생했습니다:\n{str(e)}")
    
    def _reset_settings(self):
        if messagebox.askyesno("설정 초기화", "모든 설정을 기본값으로 초기화하시겠습니까?"):
            reset_scenario_config()
            self._load_current_config()
            logger.info(safe_log("[새로고침] 통계 설정이 기본값으로 초기화되었습니다"))
            messagebox.showinfo("초기화 완료", "설정이 기본값으로 초기화되었습니다!")
    
    def _save_config(self):
        filename = filedialog.asksaveasfilename(
            title="통계 설정 저장", initialfile="scenario_config.json",
            defaultextension=".json", filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not filename:
            return
        
        try:
            config_dict = {}
            for key, var in self.vars.items():
                config_dict[key] = var.get()
            
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(config_dict, f, indent=2, ensure_ascii=False)
            
            logger.info(safe_log(f"[저장] 설정이 저장되었습니다: {filename}"))
            messagebox.showinfo("저장 완료", f"설정이 저장되었습니다:\n{filename}")
            
        except Exception as e:
            logger.error(safe_log(f"설정 저장 실패: {e}"))
            messagebox.showerror("저장 실패", f"설정 저장 중 오류가 발생했습니다:\n{str(e)}")
    
    def _load_config(self):
        filename = filedialog.askopenfilename(
            title="통계 설정 로드", filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if not filename:
            return
        
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                config_dict = json.load(f)
            
            for key, value in config_dict.items():
                if key in self.vars:
                    self.vars[key].set(value)
            
            logger.info(safe_log(f"[로드] 설정이 로드되었습니다: {filename}"))
            messagebox.showinfo("로드 완료", f"설정이 로드되었습니다:\n{filename}\n\n'설정 적용'을 클릭하여 적용하세요.")
            
        except Exception as e:
            logger.error(safe_log(f"설정 로드 실패: {e}"))
            messagebox.showerror("로드 실패", f"설정 로드 중 오류가 발생했습니다:\n{str(e)}")

# ────────────────────────────────────────────────
# ✨ Enhanced Treeview with Copy Feature
# ────────────────────────────────────────────────
class EnhancedTreeview:
    """향상된 Treeview - 복사 기능 포함"""
    
    def __init__(self, tree: ttk.Treeview, parent_gui):
        self.tree = tree
        self.parent_gui = parent_gui
        self.selected_columns = set()  # 선택된 열 인덱스
        self.selection_mode = "row"  # "row", "column", "all"
        
        # 이벤트 바인딩
        self._setup_bindings()
        
        # 컨텍스트 메뉴 생성
        self._create_context_menu()
        
    def _setup_bindings(self):
        """이벤트 바인딩 설정"""
        # 우클릭 메뉴
        self.tree.bind("<Button-3>", self._show_context_menu)  # Windows/Linux
        self.tree.bind("<Button-2>", self._show_context_menu)  # macOS
        
        # 복사 단축키
        self.tree.bind("<Control-c>", lambda e: self._copy_selection())
        self.tree.bind("<Control-C>", lambda e: self._copy_selection())
        
        # 전체 선택
        self.tree.bind("<Control-a>", lambda e: self._select_all())
        self.tree.bind("<Control-A>", lambda e: self._select_all())
        
        # 열 헤더 클릭
        self.tree.bind("<Button-1>", self._on_click)
        
    def _create_context_menu(self):
        """컨텍스트 메뉴 생성"""
        self.context_menu = tk.Menu(self.tree, tearoff=0, font=self.parent_gui.fonts["body"])
        
        # 복사 옵션들
        self.context_menu.add_command(
            label="📋 선택한 행 복사", 
            command=lambda: self._copy_selection("row"),
            accelerator="Ctrl+C"
        )
        self.context_menu.add_command(
            label="📋 선택한 열 복사", 
            command=lambda: self._copy_selection("column")
        )
        self.context_menu.add_separator()
        self.context_menu.add_command(
            label="📋 전체 복사 (컬럼명 포함)", 
            command=lambda: self._copy_selection("all"),
            accelerator="Ctrl+A → Ctrl+C"
        )
        self.context_menu.add_command(
            label="☑️ 전체 선택", 
            command=self._select_all,
            accelerator="Ctrl+A"
        )
        self.context_menu.add_separator()
        self.context_menu.add_command(
            label="📊 CSV로 복사 (Excel 호환)", 
            command=lambda: self._copy_selection("csv")
        )
        self.context_menu.add_command(
            label="📊 TSV로 복사 (탭 구분)", 
            command=lambda: self._copy_selection("tsv")
        )
        
    def _show_context_menu(self, event):
        """컨텍스트 메뉴 표시"""
        try:
            # 메뉴 표시 위치
            self.context_menu.post(event.x_root, event.y_root)
            
            # 클릭한 위치의 행 선택
            item = self.tree.identify_row(event.y)
            if item:
                # 기존 선택 유지하면서 추가
                if item not in self.tree.selection():
                    self.tree.selection_set(item)
                    
        except Exception as e:
            logger.error(safe_log(f"컨텍스트 메뉴 오류: {e}"))
            
    def _on_click(self, event):
        """클릭 이벤트 처리 - 열 선택"""
        region = self.tree.identify_region(event.x, event.y)
        
        if region == "heading":
            # 열 헤더 클릭
            col = self.tree.identify_column(event.x)
            if col:
                col_idx = int(col.replace("#", "")) - 1
                
                # Ctrl 키 누른 상태면 다중 선택
                if event.state & 0x0004:  # Control key
                    if col_idx in self.selected_columns:
                        self.selected_columns.remove(col_idx)
                    else:
                        self.selected_columns.add(col_idx)
                else:
                    # 단일 선택
                    self.selected_columns = {col_idx}
                
                # 시각적 피드백
                self._highlight_columns()
                
    def _highlight_columns(self):
        """선택된 열 하이라이트 (시각적 피드백)"""
        # Treeview는 열 하이라이트를 직접 지원하지 않으므로
        # 상태바에 표시
        if self.selected_columns:
            col_names = [self.tree.heading(f"#{i+1}")["text"] 
                        for i in self.selected_columns]
            msg = f"선택된 열: {', '.join(col_names)}"
            self.parent_gui._update_status(safe_text(msg))
            
    def _select_all(self):
        """전체 선택"""
        all_items = self.tree.get_children()
        self.tree.selection_set(all_items)
        self.selection_mode = "all"
        self.parent_gui._update_status(safe_text("전체 테이블 선택됨 - Ctrl+C로 복사"))
        return "break"  # 기본 동작 방지
        
    def _copy_selection(self, mode="auto"):
        """선택된 내용을 클립보드로 복사"""
        try:
            if mode == "auto":
                # 현재 선택 상태에 따라 자동 결정
                if self.selected_columns:
                    mode = "column"
                elif self.tree.selection():
                    mode = "row"
                else:
                    mode = "all"
                    
            # 데이터 수집
            if mode == "row":
                data_to_copy = self._get_selected_rows_data()
            elif mode == "column":
                data_to_copy = self._get_selected_columns_data()
            elif mode == "all":
                data_to_copy = self._get_all_data()
            elif mode == "csv":
                data_to_copy = self._get_all_data(separator=",")
            elif mode == "tsv":
                data_to_copy = self._get_all_data(separator="\t")
            else:
                data_to_copy = self._get_selected_rows_data()
                
            if data_to_copy:
                # 클립보드에 복사
                self.tree.clipboard_clear()
                self.tree.clipboard_append(data_to_copy)
                
                # 피드백
                lines = len(data_to_copy.split("\n"))
                self.parent_gui._update_status(safe_text(f"[복사] {lines}행이 클립보드에 복사되었습니다"))
                logger.info(safe_log(f"[복사] 테이블 데이터 복사됨: {lines}행"))
            else:
                self.parent_gui._update_status(safe_text("[복사] 복사할 데이터가 없습니다"))
                
        except Exception as e:
            logger.error(safe_log(f"복사 오류: {e}"))
            self.parent_gui._update_status(safe_text("[복사] 복사 중 오류가 발생했습니다"))
            
    def _get_selected_rows_data(self, separator="\t"):
        """선택된 행 데이터 가져오기"""
        try:
            selected_items = self.tree.selection()
            if not selected_items:
                return ""
                
            columns = self.tree["columns"]
            
            # 헤더 추가
            headers = [self.tree.heading(col)["text"] for col in columns]
            lines = [separator.join(headers)]
            
            # 데이터 추가
            for item in selected_items:
                values = self.tree.item(item)["values"]
                # 값들을 문자열로 변환하고 안전하게 처리
                safe_values = []
                for v in values:
                    if pd.isna(v) or v == "":
                        safe_values.append("")
                    else:
                        # 탭이나 줄바꿈 문자 제거
                        safe_val = str(v).replace("\t", " ").replace("\n", " ").replace("\r", "")
                        safe_values.append(safe_val)
                        
                lines.append(separator.join(safe_values))
                
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(safe_log(f"행 데이터 가져오기 오류: {e}"))
            return ""
            
    def _get_selected_columns_data(self, separator="\t"):
        """선택된 열 데이터 가져오기"""
        try:
            if not self.selected_columns:
                return ""
                
            all_items = self.tree.get_children()
            if not all_items:
                return ""
                
            columns = self.tree["columns"]
            
            # 선택된 열의 헤더
            selected_headers = [self.tree.heading(columns[i])["text"] 
                              for i in self.selected_columns if i < len(columns)]
            lines = [separator.join(selected_headers)]
            
            # 각 행에서 선택된 열의 데이터만 추출
            for item in all_items:
                values = self.tree.item(item)["values"]
                selected_values = []
                
                for col_idx in sorted(self.selected_columns):
                    if col_idx < len(values):
                        v = values[col_idx]
                        if pd.isna(v) or v == "":
                            selected_values.append("")
                        else:
                            safe_val = str(v).replace("\t", " ").replace("\n", " ").replace("\r", "")
                            selected_values.append(safe_val)
                            
                lines.append(separator.join(selected_values))
                
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(safe_log(f"열 데이터 가져오기 오류: {e}"))
            return ""
            
    def _get_all_data(self, separator="\t"):
        """전체 데이터 가져오기"""
        try:
            all_items = self.tree.get_children()
            if not all_items:
                return ""
                
            columns = self.tree["columns"]
            
            # 헤더
            headers = [self.tree.heading(col)["text"] for col in columns]
            lines = [separator.join(headers)]
            
            # 모든 데이터
            for item in all_items:
                values = self.tree.item(item)["values"]
                safe_values = []
                
                for v in values:
                    if pd.isna(v) or v == "":
                        safe_values.append("")
                    else:
                        safe_val = str(v).replace("\t", " ").replace("\n", " ").replace("\r", "")
                        if separator == ",":
                            # CSV의 경우 쉼표가 포함된 값은 따옴표로 감싸기
                            if "," in safe_val or '"' in safe_val:
                                safe_val = '"' + safe_val.replace('"', '""') + '"'
                        safe_values.append(safe_val)
                        
                lines.append(separator.join(safe_values))
                
            return "\n".join(lines)
            
        except Exception as e:
            logger.error(safe_log(f"전체 데이터 가져오기 오류: {e}"))
            return ""