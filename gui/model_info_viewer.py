"""
ML Model Information Viewer - Main UI Module
Provides comprehensive model analysis and visualization interface
"""

from __future__ import annotations

import os
import json
import logging
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

import numpy as np
import pandas as pd
import joblib
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

from gui.themes import ModernTheme, FontManager
from gui.model_visualizations import ModelVisualizer

logger = logging.getLogger("model_info_viewer")


class ModelInfoViewer:
    """Beautiful ML Model Information Viewer with Enhanced Design"""
    
    def __init__(
            self,
            parent: tk.Tk,
            model_dir: str,
            searcher=None,
            encoder=None,
            scaler=None,
            feature_columns=None,
            *,
            feature_manager=None, 
            extra_info: Optional[dict] = None,
            **kwargs,
    ):
        self.parent = parent
        self.model_dir = Path(model_dir) if model_dir else None
        self.searcher = searcher
        self.encoder = encoder
        self.scaler = scaler
        self.feature_columns = feature_columns or []
        self.feature_manager = feature_manager or kwargs.pop("feature_manager", None)
        self.embedding_vectors = None
        self.total_vector_count = 0
        self.is_sampled = False
        self.viz_type = None
        self.sample_size_var = None
        
        # Feature analysis data
        self.selected_feature = None
        self.feature_data_cache = {}
        
        # Enhanced model components
        self.pca = None
        self.variance_selector = None
        self.feature_weights = None
        self.active_features = None
        self.metadata = {}
        self.extra_info = extra_info or {}
        
        # Create window with modern styling
        self.window = tk.Toplevel(parent)
        self.window.title("✨ ML Model Analytics Dashboard")
        self.window.geometry("1400x900")
        self.window.configure(bg=ModernTheme.BG_PRIMARY)
        
        # Make window more modern
        self.window.overrideredirect(False)
        self.window.attributes('-alpha', 0.98)
        
        # Setup fonts
        self.fonts = FontManager.setup_fonts()
        
        # Initialize visualizer
        self.visualizer = ModelVisualizer(self)
        # ──────────────────────────────────────────────
        # feature_manager에서 가중치·중요도 가져오기
        if self.feature_manager is not None:
            if getattr(self.feature_manager, "feature_weights", None):
                self.feature_weights = self.feature_manager.feature_weights
            if getattr(self.feature_manager, "feature_importance", None):
                self.feature_importance = self.feature_manager.feature_importance
        # ──────────────────────────────────────────────
        
        # Load model info and components
        self._load_enhanced_components()
        self.model_info = self._load_model_info()
        
        # Build beautiful UI
        self._build_ui()
       
        # Display data
        self._display_model_info()
        
        # Center window
        self._center_window()
        
    def _center_window(self):
        """Center window on screen"""
        self.window.update_idletasks()
        width = self.window.winfo_width()
        height = self.window.winfo_height()
        x = (self.window.winfo_screenwidth() // 2) - (width // 2)
        y = (self.window.winfo_screenheight() // 2) - (height // 2)
        self.window.geometry(f"{width}x{height}+{x}+{y}")
    
    def _load_enhanced_components(self):
        """Load enhanced model components if available"""
        if not self.model_dir or not self.model_dir.exists():
            return
        
        try:
            # Load PCA if exists
            pca_path = self.model_dir / "pca.joblib"
            if pca_path.exists():
                self.pca = joblib.load(pca_path)
                logger.info("Loaded PCA component")
            
            # Load variance selector if exists
            var_selector_path = self.model_dir / "variance_selector.joblib"
            if var_selector_path.exists():
                self.variance_selector = joblib.load(var_selector_path)
                logger.info("Loaded variance selector")
            
            # Load feature weights
            weights_path = self.model_dir / "feature_weights.joblib"
            if weights_path.exists():
                self.feature_weights = joblib.load(weights_path)
                logger.info("Loaded feature weights")
            elif (self.model_dir / "feature_weights.npy").exists():
                # Legacy numpy format
                weights_array = np.load(self.model_dir / "feature_weights.npy")
                if self.feature_columns and len(weights_array) == len(self.feature_columns):
                    self.feature_weights = {col: float(weights_array[i]) 
                                          for i, col in enumerate(self.feature_columns)}
            
            # Load active features
            active_features_path = self.model_dir / "active_features.npy"
            if active_features_path.exists():
                self.active_features = np.load(active_features_path)
                logger.info("Loaded active features mask")
            
            # Load metadata files
            metadata_files = [
                "training_metadata.json",
                "feature_metadata.json",
                "model_metadata.json"
            ]
            
            for metadata_file in metadata_files:
                metadata_path = self.model_dir / metadata_file
                if metadata_path.exists():
                    with open(metadata_path, 'r', encoding='utf-8') as f:
                        metadata_key = metadata_file.replace('.json', '')
                        self.metadata[metadata_key] = json.load(f)
                        logger.info(f"Loaded {metadata_file}")
                        
        except Exception as e:
            logger.error(f"Error loading enhanced components: {e}")
    
    def _load_model_info(self) -> Dict[str, Any]:
        """Load model information including enhanced components"""
        info = {
            "model_path": str(self.model_dir) if self.model_dir else "N/A",
            "exists": False,
            "files": {},
            "feature_count": len(self.feature_columns) if self.feature_columns else 0,
            "creation_time": "N/A",
            "file_sizes": {},
            "statistics": {},
            "enhanced_components": {
                "has_pca": self.pca is not None,
                "has_variance_selector": self.variance_selector is not None,
                "has_feature_weights": self.feature_weights is not None,
                "has_active_features": self.active_features is not None,
                "has_metadata": bool(self.metadata)
            }
        }
        
        if self.model_dir and self.model_dir.exists():
            info["exists"] = True
            
            # Check standard model files
            model_files = [
                "similarity_engine.joblib",
                "encoder.joblib", 
                "scaler.joblib",
                "feature_columns.joblib"
            ]
            
            # Add enhanced component files
            enhanced_files = [
                "pca.joblib",
                "variance_selector.joblib",
                "feature_weights.joblib",
                "active_features.npy",
                "training_metadata.json",
                "feature_metadata.json",
                "model_metadata.json"
            ]
            
            all_files = model_files + enhanced_files
            
            for file_name in all_files:
                file_path = self.model_dir / file_name
                if file_path.exists():
                    stat = file_path.stat()
                    info["files"][file_name] = True
                    info["file_sizes"][file_name] = stat.st_size / (1024 * 1024)
                    
                    if file_name == "similarity_engine.joblib":
                        info["creation_time"] = datetime.fromtimestamp(
                            stat.st_mtime
                        ).strftime("%Y-%m-%d %H:%M:%S")
            
            # Extract statistics from metadata if available
            if "training_metadata" in self.metadata:
                training_info = self.metadata["training_metadata"].get("training_info", {})
                info["statistics"]["vector_count"] = training_info.get("total_items", 0)
                info["statistics"]["vector_dim"] = training_info.get("vector_dimension", 0)
                
                # Add PCA info if available
                if "pca_info" in self.metadata["training_metadata"]:
                    pca_info = self.metadata["training_metadata"]["pca_info"]
                    info["statistics"]["pca_components"] = pca_info.get("n_components", 0)
                    info["statistics"]["pca_variance_explained"] = pca_info.get("total_variance_explained", 0)
            
            # Fallback to direct inspection
            elif self.searcher:
                try:
                    if hasattr(self.searcher, 'vectors'):
                        info["statistics"]["vector_count"] = len(self.searcher.vectors)
                        info["statistics"]["vector_dim"] = self.searcher.vectors.shape[1]
                    elif hasattr(self.searcher, 'index'):
                        if hasattr(self.searcher.index, 'ntotal'):
                            info["statistics"]["vector_count"] = self.searcher.index.ntotal
                        if hasattr(self.searcher.index, 'd'):
                            info["statistics"]["vector_dim"] = self.searcher.index.d
                            
                    if hasattr(self.searcher, 'item_codes'):
                        info["statistics"]["item_count"] = len(self.searcher.item_codes)
                except Exception as e:
                    logger.error(f"Error collecting statistics: {e}")
        
        return info
    
    def _create_gradient_frame(self, parent, height=100):
        """Create a frame with gradient background"""
        frame = tk.Frame(parent, bg=ModernTheme.PRIMARY, height=height)
        frame.pack_propagate(False)
        return frame
    
    def _create_card(self, parent, title="", icon="", padding=20):
        """Create a modern card widget"""
        card = tk.Frame(parent, bg=ModernTheme.BG_CARD, highlightthickness=1, 
                       highlightbackground=ModernTheme.BG_TERTIARY)
        
        if title:
            header = tk.Frame(card, bg=ModernTheme.BG_CARD, height=50)
            header.pack(fill=tk.X, padx=padding, pady=(padding, 10))
            
            # Icon and title
            title_frame = tk.Frame(header, bg=ModernTheme.BG_CARD)
            title_frame.pack(anchor="w")
            
            if icon:
                tk.Label(title_frame, text=icon, font=self.fonts["icon"], 
                        bg=ModernTheme.BG_CARD, fg=ModernTheme.PRIMARY).pack(side=tk.LEFT, padx=(0, 10))
            
            tk.Label(title_frame, text=title, font=self.fonts["heading"], 
                    bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_PRIMARY).pack(side=tk.LEFT)
        
        content = tk.Frame(card, bg=ModernTheme.BG_CARD)
        content.pack(fill=tk.BOTH, expand=True, padx=padding, pady=(0, padding))
        
        return card, content
    
    def _create_stat_widget(self, parent, label, value, color=None):
        """Create a beautiful statistics widget"""
        stat_frame = tk.Frame(parent, bg=ModernTheme.BG_TERTIARY, relief="flat", bd=0)
        stat_frame.pack(fill=tk.X, pady=5)
        
        # Add hover effect simulation with padding
        inner_frame = tk.Frame(stat_frame, bg=ModernTheme.BG_TERTIARY)
        inner_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        # Label
        tk.Label(inner_frame, text=label, font=self.fonts["small"], 
                bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_MUTED).pack(anchor="w")
        
        # Value with color
        value_color = color or ModernTheme.TEXT_PRIMARY
        tk.Label(inner_frame, text=value, font=self.fonts["heading"], 
                bg=ModernTheme.BG_TERTIARY, fg=value_color).pack(anchor="w", pady=(5, 0))
        
        return stat_frame
    
    def _build_ui(self):
        """Build beautiful modern UI with vertical scrollbar"""
        # Main canvas for scrolling
        canvas = tk.Canvas(self.window, bg=ModernTheme.BG_PRIMARY, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.window, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=ModernTheme.BG_PRIMARY)

        # Configure canvas
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        # Pack canvas and scrollbar
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 마우스 휠 스크롤 바인딩 - 개선된 버전
        def _on_mousewheel(event):
            # 위젯이 존재하는지 확인
            try:
                if canvas.winfo_exists():
                    canvas.yview_scroll(-1 * (event.delta // 120), "units")
            except tk.TclError:
                # 위젯이 없으면 무시
                pass
        
        # bind_all 대신 특정 위젯에만 바인딩
        canvas.bind("<MouseWheel>", _on_mousewheel)  # Windows
        canvas.bind("<Button-4>", lambda e: canvas.winfo_exists() and canvas.yview_scroll(-1, "units"))  # Linux
        canvas.bind("<Button-5>", lambda e: canvas.winfo_exists() and canvas.yview_scroll(1, "units"))  # Linux
        
        # 윈도우가 닫힐 때 바인딩 해제
        def on_window_close():
            # 모든 바인딩 해제
            try:
                canvas.unbind("<MouseWheel>")
                canvas.unbind("<Button-4>")
                canvas.unbind("<Button-5>")
            except:
                pass
            self.window.destroy()
        
        self.window.protocol("WM_DELETE_WINDOW", on_window_close)

        # Main container inside scrollable frame
        main_container = tk.Frame(scrollable_frame, bg=ModernTheme.BG_PRIMARY)
        main_container.pack(fill=tk.BOTH, expand=True)

        # Header with gradient effect
        header = self._create_gradient_frame(main_container, height=120)
        header.pack(fill=tk.X)

        # Header content
        header_content = tk.Frame(header, bg=ModernTheme.PRIMARY)
        header_content.pack(expand=True)

        tk.Label(header_content, text="✨", font=self.fonts["hero"], 
                bg=ModernTheme.PRIMARY, fg=ModernTheme.WHITE).pack(pady=(20, 0))
        
        tk.Label(header_content, text="ML Model Analytics Dashboard", 
                font=self.fonts["title"], bg=ModernTheme.PRIMARY, 
                fg=ModernTheme.WHITE).pack()
        
        tk.Label(header_content, text="Comprehensive Model Analysis & Visualization", 
                font=self.fonts["small"], bg=ModernTheme.PRIMARY, 
                fg=ModernTheme.PRIMARY_LIGHT).pack(pady=(5, 0))
        
        # Content area
        content_frame = tk.Frame(main_container, bg=ModernTheme.BG_PRIMARY)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Modern notebook styling
        style = ttk.Style()
        style.theme_use('clam')
        
        style.configure('Modern.TNotebook', 
                    background=ModernTheme.BG_PRIMARY,
                    borderwidth=0,
                    relief='flat')
        
        style.configure('Modern.TNotebook.Tab',
                    background=ModernTheme.BG_SECONDARY,
                    foreground=ModernTheme.TEXT_SECONDARY,
                    padding=[25, 12],
                    font=self.fonts["body"],
                    borderwidth=0)
        
        style.map('Modern.TNotebook.Tab',
                background=[('selected', ModernTheme.PRIMARY)],
                foreground=[('selected', ModernTheme.WHITE)],
                padding=[('selected', [35, 18])],
                font=[('selected', self.fonts["heading"])])
        
        # Create notebook with rounded corners effect
        notebook_container = tk.Frame(content_frame, bg=ModernTheme.BG_SECONDARY, 
                                    highlightthickness=1, 
                                    highlightbackground=ModernTheme.BG_TERTIARY)
        notebook_container.pack(fill=tk.BOTH, expand=True)
        
        self.notebook = ttk.Notebook(notebook_container, style='Modern.TNotebook')
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
        
        # Tab 1: Overview
        self.info_frame = tk.Frame(self.notebook, bg=ModernTheme.BG_SECONDARY)
        self.notebook.add(self.info_frame, text="📊 Overview")
        
        # Tab 2: Features
        self.feature_frame = tk.Frame(self.notebook, bg=ModernTheme.BG_SECONDARY)
        self.notebook.add(self.feature_frame, text="🔧 Features")
        
        # Tab 3: Embeddings
        self.embedding_frame = tk.Frame(self.notebook, bg=ModernTheme.BG_SECONDARY)
        self.notebook.add(self.embedding_frame, text="🎨 Embeddings")
        
        # Tab 4: Performance
        self.performance_frame = tk.Frame(self.notebook, bg=ModernTheme.BG_SECONDARY)
        self.notebook.add(self.performance_frame, text="⚡ Performance")
        
        # Tab 5: Analysis
        self.analysis_frame = tk.Frame(self.notebook, bg=ModernTheme.BG_SECONDARY)
        self.notebook.add(self.analysis_frame, text="🔍 Analysis")
        
        # Tab 6: Enhanced Components (NEW)
        self.enhanced_frame = tk.Frame(self.notebook, bg=ModernTheme.BG_SECONDARY)
        self.notebook.add(self.enhanced_frame, text="🚀 Enhanced")
        
        # Bottom action bar
        action_bar = tk.Frame(main_container,
                            bg=ModernTheme.BG_SECONDARY,
                            height=80)
        action_bar.pack(fill=tk.X, side=tk.BOTTOM, anchor="s")
        action_bar.pack_propagate(False)

        self.action_bar = action_bar
        
        button_frame = tk.Frame(action_bar, bg=ModernTheme.BG_SECONDARY)
        button_frame.pack(expand=True)
        
        # Modern buttons
        self._create_modern_button(button_frame, "🔄 Refresh", self._refresh_info, 
                                ModernTheme.INFO).pack(side=tk.LEFT, padx=10)
        
        self._create_modern_button(button_frame, "💾 Export Report", self._save_report, 
                                ModernTheme.SUCCESS).pack(side=tk.LEFT, padx=10)
        
        self._create_modern_button(button_frame, "📈 Export Analysis", self._export_analysis, 
                                ModernTheme.ACCENT).pack(side=tk.LEFT, padx=10)
        
        self._create_modern_button(button_frame, "✖ Close", on_window_close,  # 변경: self.window.destroy → on_window_close
                                ModernTheme.ERROR).pack(side=tk.LEFT, padx=10)
    
    def _create_modern_button(self, parent, text, command, color):
        """Create a modern styled button"""
        btn = tk.Button(parent, text=text, command=command,
                       font=self.fonts["body"], bg=color, fg=ModernTheme.WHITE,
                       bd=0, relief="flat", padx=25, pady=12, cursor="hand2",
                       activebackground=color, activeforeground=ModernTheme.WHITE)
        
        # Hover effects
        def on_enter(e):
            btn.config(bg=ModernTheme.PRIMARY_LIGHT if color == ModernTheme.PRIMARY else color)
        
        def on_leave(e):
            btn.config(bg=color)
        
        btn.bind("<Enter>", on_enter)
        btn.bind("<Leave>", on_leave)
        
        return btn
    
    def _display_model_info(self):
        """Display model information"""
        self._display_basic_info()
        self._display_feature_analysis()
        self._display_embedding_visualization()
        self._display_performance_metrics()
        self._display_model_analysis()
        self._display_enhanced_components()
    
    def _display_basic_info(self):
        """Display basic information with beautiful design"""
        # Create scrollable container
        canvas = tk.Canvas(self.info_frame, bg=ModernTheme.BG_SECONDARY, 
                          highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.info_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=ModernTheme.BG_SECONDARY)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Grid layout for cards
        grid_frame = tk.Frame(scrollable_frame, bg=ModernTheme.BG_SECONDARY)
        grid_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Model Status Card
        status_card, status_content = self._create_card(grid_frame, "Model Status", "🎯")
        status_card.grid(row=0, column=0, sticky="nsew", padx=10, pady=10)
        
        status_color = ModernTheme.SUCCESS if self.model_info["exists"] else ModernTheme.ERROR
        status_text = "Model Loaded" if self.model_info["exists"] else "Model Not Found"
        
        self._create_stat_widget(status_content, "Status", status_text, status_color)
        self._create_stat_widget(status_content, "Created", self.model_info["creation_time"])
        
        # Enhanced Components Status
        if self.model_info["enhanced_components"]["has_metadata"]:
            self._create_stat_widget(status_content, "Type", "Enhanced Model", ModernTheme.SUCCESS)
        else:
            self._create_stat_widget(status_content, "Type", "Standard Model", ModernTheme.WARNING)
        
        # Model Statistics Card
        stats_card, stats_content = self._create_card(grid_frame, "Model Statistics", "📊")
        stats_card.grid(row=0, column=1, sticky="nsew", padx=10, pady=10)
        
        if self.model_info["statistics"]:
            if "vector_count" in self.model_info["statistics"]:
                self._create_stat_widget(stats_content, "Total Vectors", 
                                       f"{self.model_info['statistics']['vector_count']:,}")
            if "vector_dim" in self.model_info["statistics"]:
                self._create_stat_widget(stats_content, "Vector Dimension", 
                                       f"{self.model_info['statistics']['vector_dim']}D")
            if "item_count" in self.model_info["statistics"]:
                self._create_stat_widget(stats_content, "Total Items", 
                                       f"{self.model_info['statistics']['item_count']:,}")
            if "pca_components" in self.model_info["statistics"]:
                self._create_stat_widget(stats_content, "PCA Components", 
                                       f"{self.model_info['statistics']['pca_components']}")
            if "pca_variance_explained" in self.model_info["statistics"]:
                self._create_stat_widget(stats_content, "Variance Explained", 
                                       f"{self.model_info['statistics']['pca_variance_explained']*100:.1f}%")
        
        # Files Card
        files_card, files_content = self._create_card(grid_frame, "Model Files", "📁")
        files_card.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=10, pady=10)
        
        for file_name, exists in self.model_info["files"].items():
            file_frame = tk.Frame(files_content, bg=ModernTheme.BG_CARD)
            file_frame.pack(fill=tk.X, pady=3)
            
            # Status indicator
            status_color = ModernTheme.SUCCESS if exists else ModernTheme.ERROR
            status_icon = "✓" if exists else "✗"
            
            tk.Label(file_frame, text=status_icon, font=self.fonts["body"],
                    bg=ModernTheme.BG_CARD, fg=status_color).pack(side=tk.LEFT, padx=(0, 10))
            
            # File name
            tk.Label(file_frame, text=file_name, font=self.fonts["code"],
                    bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_PRIMARY).pack(side=tk.LEFT)
            
            # File size
            if file_name in self.model_info["file_sizes"]:
                size_text = f"{self.model_info['file_sizes'][file_name]:.2f} MB"
                tk.Label(file_frame, text=size_text, font=self.fonts["small"],
                        bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_MUTED).pack(side=tk.RIGHT)
        
        # Configure grid weights
        grid_frame.grid_columnconfigure(0, weight=1)
        grid_frame.grid_columnconfigure(1, weight=1)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
    
    def _display_enhanced_components(self):
        """Display enhanced model components information"""
        # Create scrollable container
        canvas = tk.Canvas(self.enhanced_frame, bg=ModernTheme.BG_SECONDARY, 
                          highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.enhanced_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=ModernTheme.BG_SECONDARY)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # Container
        container = tk.Frame(scrollable_frame, bg=ModernTheme.BG_SECONDARY)
        container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # PCA Information
        if self.pca is not None:
            pca_card, pca_content = self._create_card(container, "PCA Component", "📉")
            pca_card.pack(fill=tk.X, pady=(0, 20))
            
            self._create_stat_widget(pca_content, "Components", str(self.pca.n_components_))
            self._create_stat_widget(pca_content, "Variance Explained", 
                                   f"{np.sum(self.pca.explained_variance_ratio_)*100:.1f}%")
            
            # Plot variance explained
            fig = Figure(figsize=(8, 4), dpi=100, facecolor=ModernTheme.BG_CARD)
            ax = fig.add_subplot(111)
            
            var_explained = self.pca.explained_variance_ratio_
            cumvar = np.cumsum(var_explained)
            
            ax.bar(range(1, len(var_explained)+1), var_explained, 
                  color=ModernTheme.PRIMARY, alpha=0.7, label='Individual')
            ax.plot(range(1, len(var_explained)+1), cumvar, 
                   color=ModernTheme.ACCENT, marker='o', linewidth=2, label='Cumulative')
            
            ax.set_xlabel('Principal Component', color=ModernTheme.TEXT_PRIMARY)
            ax.set_ylabel('Variance Explained', color=ModernTheme.TEXT_PRIMARY)
            ax.set_title('PCA Variance Explained', color=ModernTheme.TEXT_PRIMARY)
            ax.legend()
            ax.grid(True, alpha=0.2)
            ax.set_facecolor(ModernTheme.BG_TERTIARY)
            
            fig.patch.set_facecolor(ModernTheme.BG_CARD)
            
            canvas_pca = FigureCanvasTkAgg(fig, master=pca_content)
            canvas_pca.draw()
            canvas_pca.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Feature Weights Information
        if self.feature_weights is not None:
            weights_card, weights_content = self._create_card(container, "Feature Weights", "⚖️")
            weights_card.pack(fill=tk.X, pady=(0, 20))
            
            # Top weighted features
            if isinstance(self.feature_weights, dict):
                sorted_weights = sorted(self.feature_weights.items(), 
                                      key=lambda x: x[1], reverse=True)[:20]
                
                fig = Figure(figsize=(8, 6), dpi=100, facecolor=ModernTheme.BG_CARD)
                ax = fig.add_subplot(111)
                
                features = [w[0] for w in sorted_weights]
                weights = [w[1] for w in sorted_weights]
                
                bars = ax.barh(range(len(features)), weights, color=ModernTheme.PRIMARY)
                ax.set_yticks(range(len(features)))
                ax.set_yticklabels(features)
                ax.set_xlabel('Weight', color=ModernTheme.TEXT_PRIMARY)
                ax.set_title('Top 20 Feature Weights', color=ModernTheme.TEXT_PRIMARY)
                ax.grid(True, axis='x', alpha=0.2)
                ax.set_facecolor(ModernTheme.BG_TERTIARY)
                
                # Color gradient
                for i, bar in enumerate(bars):
                    bar.set_alpha(0.4 + 0.6 * (1 - i/len(bars)))
                
                fig.tight_layout()
                fig.patch.set_facecolor(ModernTheme.BG_CARD)
                
                canvas_weights = FigureCanvasTkAgg(fig, master=weights_content)
                canvas_weights.draw()
                canvas_weights.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Training Metadata
        if "training_metadata" in self.metadata:
            meta_card, meta_content = self._create_card(container, "Training Metadata", "📊")
            meta_card.pack(fill=tk.X, pady=(0, 20))
            
            training_info = self.metadata["training_metadata"].get("training_info", {})
            
            # Display preprocessor config
            if "preprocessor_config" in training_info:
                config = training_info["preprocessor_config"]
                
                config_text = "Preprocessor Configuration:\n"
                config_text += f"• Normalize Output: {config.get('normalize_output', 'N/A')}\n"
                config_text += f"• STD Threshold: {config.get('std_prune_threshold', 'N/A')}\n"
                config_text += f"• Variance Threshold: {config.get('variance_threshold', 'N/A')}\n"
                config_text += f"• Use PCA: {config.get('use_pca', 'N/A')}\n"
                config_text += f"• Auto Feature Weights: {config.get('auto_feature_weights', 'N/A')}\n"
                config_text += f"• Balance Dimensions: {config.get('balance_dimensions', 'N/A')}\n"
                
                tk.Label(meta_content, text=config_text, font=self.fonts["code"],
                        bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_PRIMARY,
                        justify="left").pack(anchor="w", padx=10, pady=10)
            
            # Vector statistics
            if "vector_statistics" in self.metadata["training_metadata"]:
                vec_stats = self.metadata["training_metadata"]["vector_statistics"]
                
                stats_text = "\nVector Statistics:\n"
                stats_text += f"• Mean Norm: {vec_stats.get('mean_norm', 'N/A'):.4f}\n"
                stats_text += f"• STD Norm: {vec_stats.get('std_norm', 'N/A'):.4f}\n"
                stats_text += f"• Min Norm: {vec_stats.get('min_norm', 'N/A'):.4f}\n"
                stats_text += f"• Max Norm: {vec_stats.get('max_norm', 'N/A'):.4f}\n"
                
                tk.Label(meta_content, text=stats_text, font=self.fonts["code"],
                        bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_PRIMARY,
                        justify="left").pack(anchor="w", padx=10, pady=10)
        
        # Active Features Information
        if self.active_features is not None:
            active_card, active_content = self._create_card(container, "Active Features", "🎯")
            active_card.pack(fill=tk.X, pady=(0, 20))
            
            total_features = len(self.active_features)
            active_count = np.sum(self.active_features)
            removed_count = total_features - active_count
            
            self._create_stat_widget(active_content, "Total Features", str(total_features))
            self._create_stat_widget(active_content, "Active Features", 
                                   str(active_count), ModernTheme.SUCCESS)
            self._create_stat_widget(active_content, "Removed Features", 
                                   str(removed_count), ModernTheme.WARNING)
            self._create_stat_widget(active_content, "Active Ratio", 
                                   f"{active_count/total_features*100:.1f}%")
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
    
    def _display_feature_analysis(self):
        """Display feature analysis with individual feature details"""
        if not self.feature_columns:
            empty_label = tk.Label(self.feature_frame, text="No feature information available",
                                  font=self.fonts["body"], bg=ModernTheme.BG_SECONDARY,
                                  fg=ModernTheme.TEXT_MUTED)
            empty_label.pack(expand=True)
            return
        
        # Main container
        main_container = tk.Frame(self.feature_frame, bg=ModernTheme.BG_SECONDARY)
        main_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # Create 3-column layout
        main_container.grid_columnconfigure(0, weight=1, minsize=300)  # Feature list
        main_container.grid_columnconfigure(1, weight=2, minsize=400)  # Feature details
        main_container.grid_columnconfigure(2, weight=2, minsize=400)  # Feature visualization
        main_container.grid_rowconfigure(0, weight=1)
        
        # Left panel - Feature list with search
        left_card, left_content = self._create_card(main_container, f"Features ({len(self.feature_columns)})", "📋")
        left_card.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        
        # Search box
        search_frame = tk.Frame(left_content, bg=ModernTheme.BG_CARD)
        search_frame.pack(fill=tk.X, pady=(0, 10))
        
        tk.Label(search_frame, text="🔍", font=self.fonts["icon"],
                bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_MUTED).pack(side=tk.LEFT)
        
        self.search_var = tk.StringVar()
        search_entry = tk.Entry(search_frame, textvariable=self.search_var, font=self.fonts["body"],
                               bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_PRIMARY,
                               insertbackground=ModernTheme.TEXT_PRIMARY, relief="flat", bd=10)
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(10, 0))
        search_entry.bind('<KeyRelease>', self._filter_features)
        
        # Feature listbox frame
        list_frame = tk.Frame(left_content, bg=ModernTheme.BG_CARD)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        # Create custom scrollable feature list
        self.feature_list_frame = tk.Frame(list_frame, bg=ModernTheme.BG_TERTIARY)
        self.feature_list_frame.pack(fill=tk.BOTH, expand=True)
        
        # Scrollbar for feature list
        list_canvas = tk.Canvas(self.feature_list_frame, bg=ModernTheme.BG_TERTIARY, highlightthickness=0)
        list_scrollbar = ttk.Scrollbar(self.feature_list_frame, orient="vertical", command=list_canvas.yview)
        self.scrollable_feature_frame = tk.Frame(list_canvas, bg=ModernTheme.BG_TERTIARY)
        
        self.scrollable_feature_frame.bind(
            "<Configure>",
            lambda e: list_canvas.configure(scrollregion=list_canvas.bbox("all"))
        )
        
        list_canvas.create_window((0, 0), window=self.scrollable_feature_frame, anchor="nw")
        list_canvas.configure(yscrollcommand=list_scrollbar.set)
        
        list_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        list_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Populate feature list
        self.feature_buttons = []
        self._populate_feature_list()
        
        # Middle panel - Feature details
        middle_card, self.feature_details_content = self._create_card(main_container, "Feature Details", "📊")
        middle_card.grid(row=0, column=1, sticky="nsew", padx=10)
        
        # Right panel - Feature visualization
        right_card, self.feature_viz_content = self._create_card(main_container, "Feature Analysis", "📈")
        right_card.grid(row=0, column=2, sticky="nsew", padx=(10, 0))
        
        # Initialize with first feature selected
        if self.feature_columns:
            self._select_feature(self.feature_columns[0])
    
    def _populate_feature_list(self):
        """Populate the feature list with clickable items"""
        # Clear existing items
        for widget in self.scrollable_feature_frame.winfo_children():
            widget.destroy()
        self.feature_buttons = []
        
        # Get filtered features
        search_term = self.search_var.get().lower()
        filtered_features = [f for f in self.feature_columns if search_term in f.lower()]
        
        # Categorize features
        from backend.constants import NUMERIC_FEATURES
        
        # Create feature items
        for i, feature in enumerate(sorted(filtered_features)):
            feature_frame = tk.Frame(self.scrollable_feature_frame, bg=ModernTheme.BG_TERTIARY)
            feature_frame.pack(fill=tk.X, padx=5, pady=2)
            
            # Make the entire frame clickable
            feature_frame.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Feature button appearance
            inner_frame = tk.Frame(feature_frame, bg=ModernTheme.BG_SECONDARY, relief="flat", bd=1)
            inner_frame.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
            inner_frame.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Feature number and name
            label_frame = tk.Frame(inner_frame, bg=ModernTheme.BG_SECONDARY)
            label_frame.pack(fill=tk.X, padx=10, pady=8)
            label_frame.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Feature index
            index_label = tk.Label(label_frame, text=f"{i+1:3d}.", font=self.fonts["code"],
                                  bg=ModernTheme.BG_SECONDARY, fg=ModernTheme.TEXT_MUTED)
            index_label.pack(side=tk.LEFT, padx=(0, 10))
            index_label.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Feature name
            name_label = tk.Label(label_frame, text=feature, font=self.fonts["code"],
                                 bg=ModernTheme.BG_SECONDARY, fg=ModernTheme.TEXT_PRIMARY,
                                 anchor="w")
            name_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
            name_label.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Feature type badge
            is_numeric = feature in NUMERIC_FEATURES
            badge_text = "NUM" if is_numeric else "CAT"
            badge_color = ModernTheme.INFO if is_numeric else ModernTheme.ACCENT
            
            badge = tk.Label(label_frame, text=badge_text, font=self.fonts["small"],
                           bg=badge_color, fg=ModernTheme.WHITE,
                           padx=8, pady=2)
            badge.pack(side=tk.RIGHT, padx=(10, 0))
            badge.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Add weight badge if available
            if self.feature_weights and feature in self.feature_weights:
                weight = self.feature_weights[feature]
                weight_color = (ModernTheme.ERROR if weight > 2.0 else 
                              ModernTheme.WARNING if weight > 1.5 else 
                              ModernTheme.SUCCESS)
                
                weight_badge = tk.Label(label_frame, text=f"W:{weight:.1f}", 
                                      font=self.fonts["small"],
                                      bg=weight_color, fg=ModernTheme.WHITE,
                                      padx=8, pady=2)
                weight_badge.pack(side=tk.RIGHT, padx=(5, 0))
                weight_badge.bind("<Button-1>", lambda e, f=feature: self._select_feature(f))
            
            # Store reference
            self.feature_buttons.append({
                'feature': feature,
                'frame': feature_frame,
                'inner_frame': inner_frame,
                'labels': [index_label, name_label, badge]
            })
            
            # Hover effects
            def on_enter(e, frame=inner_frame):
                if frame.cget('bg') != ModernTheme.PRIMARY:
                    frame.config(bg=ModernTheme.BG_TERTIARY)
            
            def on_leave(e, frame=inner_frame):
                if frame.cget('bg') != ModernTheme.PRIMARY:
                    frame.config(bg=ModernTheme.BG_SECONDARY)
            
            inner_frame.bind("<Enter>", on_enter)
            inner_frame.bind("<Leave>", on_leave)
            for widget in [label_frame, index_label, name_label, badge]:
                widget.bind("<Enter>", on_enter)
                widget.bind("<Leave>", on_leave)
    
    def _filter_features(self, event=None):
        """Filter features based on search term"""
        self._populate_feature_list()
        
        # Re-select current feature if still visible
        if self.selected_feature:
            filtered_features = [btn['feature'] for btn in self.feature_buttons]
            if self.selected_feature in filtered_features:
                self._select_feature(self.selected_feature)
            elif filtered_features:
                self._select_feature(filtered_features[0])
    
    def _select_feature(self, feature_name):
        """Select a feature and display its details"""
        self.selected_feature = feature_name
        
        # Update visual selection
        for btn in self.feature_buttons:
            if btn['feature'] == feature_name:
                btn['inner_frame'].config(bg=ModernTheme.PRIMARY)
                for label in btn['labels']:
                    label.config(bg=ModernTheme.PRIMARY)
            else:
                btn['inner_frame'].config(bg=ModernTheme.BG_SECONDARY)
                for label in btn['labels'][:-1]:  # Exclude badge
                    label.config(bg=ModernTheme.BG_SECONDARY)
        
        # Display feature details
        self._display_feature_details(feature_name)
        
        # Display feature visualization
        self._display_feature_visualization(feature_name)
    
    def _display_feature_details(self, feature_name):
        """Display details for the selected feature"""
        # Clear previous content
        for widget in self.feature_details_content.winfo_children():
            widget.destroy()
        
        from backend.constants import NUMERIC_FEATURES
        
        # Feature name header
        header_frame = tk.Frame(self.feature_details_content, bg=ModernTheme.BG_CARD)
        header_frame.pack(fill=tk.X, pady=(0, 15))
        
        tk.Label(header_frame, text=feature_name, font=self.fonts["heading"],
                bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_PRIMARY).pack(anchor="w")
        
        # Feature type
        is_numeric = feature_name in NUMERIC_FEATURES
        type_text = "Numeric Feature" if is_numeric else "Categorical Feature"
        type_color = ModernTheme.INFO if is_numeric else ModernTheme.ACCENT
        
        tk.Label(header_frame, text=type_text, font=self.fonts["body"],
                bg=ModernTheme.BG_CARD, fg=type_color).pack(anchor="w", pady=(5, 0))
        
        # Feature weight if available
        if self.feature_weights and feature_name in self.feature_weights:
            weight = self.feature_weights[feature_name]
            weight_color = (ModernTheme.ERROR if weight > 2.0 else 
                          ModernTheme.WARNING if weight > 1.5 else 
                          ModernTheme.SUCCESS)
            
            weight_frame = tk.Frame(header_frame, bg=weight_color, relief="flat", bd=0)
            weight_frame.pack(anchor="w", pady=(10, 0))
            
            tk.Label(weight_frame, text=f"Weight: {weight:.2f}", 
                    font=self.fonts["body"], bg=weight_color, 
                    fg=ModernTheme.WHITE, padx=10, pady=5).pack()
        
        # Statistics frame
        stats_frame = tk.Frame(self.feature_details_content, bg=ModernTheme.BG_TERTIARY,
                              relief="flat", bd=1)
        stats_frame.pack(fill=tk.X, pady=10)
        
        stats_content = tk.Frame(stats_frame, bg=ModernTheme.BG_TERTIARY)
        stats_content.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)
        
        tk.Label(stats_content, text="Feature Statistics", font=self.fonts["subheading"],
                bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_PRIMARY).pack(anchor="w", pady=(0, 10))
        
        # Get feature metadata if available
        feature_meta = None
        if "feature_metadata" in self.metadata:
            features_dict = self.metadata["feature_metadata"].get("features", {})
            feature_meta = features_dict.get(feature_name, {})
        
        # Display statistics from metadata
        if feature_meta:
            if is_numeric and any(k in feature_meta for k in ['mean', 'std', 'min', 'max']):
                stat_items = [
                    ("Missing Count", f"{feature_meta.get('missing_count', 'N/A'):,}"),
                    ("Missing Ratio", f"{feature_meta.get('missing_ratio', 0)*100:.1f}%"),
                    ("Mean", f"{feature_meta.get('mean', 'N/A'):.4f}" if 'mean' in feature_meta else 'N/A'),
                    ("Std Dev", f"{feature_meta.get('std', 'N/A'):.4f}" if 'std' in feature_meta else 'N/A'),
                    ("Min", f"{feature_meta.get('min', 'N/A'):.4f}" if 'min' in feature_meta else 'N/A'),
                    ("Max", f"{feature_meta.get('max', 'N/A'):.4f}" if 'max' in feature_meta else 'N/A'),
                    ("Q25", f"{feature_meta.get('q25', 'N/A'):.4f}" if 'q25' in feature_meta else 'N/A'),
                    ("Median", f"{feature_meta.get('q50', 'N/A'):.4f}" if 'q50' in feature_meta else 'N/A'),
                    ("Q75", f"{feature_meta.get('q75', 'N/A'):.4f}" if 'q75' in feature_meta else 'N/A'),
                ]
            else:
                stat_items = [
                    ("Type", "Categorical"),
                    ("Missing Count", f"{feature_meta.get('missing_count', 'N/A'):,}"),
                    ("Missing Ratio", f"{feature_meta.get('missing_ratio', 0)*100:.1f}%"),
                    ("Unique Values", f"{feature_meta.get('unique_count', 'N/A'):,}"),
                ]
        else:
            # Fallback statistics
            stat_items = [
                ("Type", "Numeric" if is_numeric else "Categorical"),
                ("Encoded", "Yes" if self.encoder else "N/A"),
                ("Scaled", "Yes" if self.scaler else "N/A"),
            ]
        
        for label, value in stat_items:
            stat_row = tk.Frame(stats_content, bg=ModernTheme.BG_TERTIARY)
            stat_row.pack(fill=tk.X, pady=2)
            
            tk.Label(stat_row, text=f"{label}:", font=self.fonts["body"],
                    bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_SECONDARY).pack(side=tk.LEFT)
            
            tk.Label(stat_row, text=value, font=self.fonts["body"],
                    bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_PRIMARY).pack(side=tk.RIGHT)
    
    def _display_feature_visualization(self, feature_name):
        """Display visualization for selected feature"""
        # Clear previous content
        for widget in self.feature_viz_content.winfo_children():
            widget.destroy()
        
        from backend.constants import NUMERIC_FEATURES
        is_numeric = feature_name in NUMERIC_FEATURES
        
        # Try to load actual data if available
        actual_data = self._load_feature_data(feature_name)
        
        if actual_data is not None:
            # Use the visualizer to create feature visualization
            self.visualizer.create_feature_visualization(
                self.feature_viz_content, feature_name, actual_data, 
                is_numeric, self.feature_columns, self.feature_weights
            )
        else:
            # Show placeholder
            tk.Label(self.feature_viz_content,
                    text="Feature visualization requires data loading.\n"
                         "Feature metadata is available in the details panel.",
                    font=self.fonts["body"], bg=ModernTheme.BG_CARD,
                    fg=ModernTheme.TEXT_MUTED).pack(expand=True)
    
    def _load_feature_data(self, feature_name):
        """Try to load actual feature data from database or cache"""
        try:
            # Check if we have cached data
            if hasattr(self, 'raw_data') and self.raw_data is not None:
                if feature_name in self.raw_data.columns:
                    return self.raw_data[feature_name]
            
            # Try to load from database
            if self.model_dir and (self.model_dir / "training_data.csv").exists():
                df = pd.read_csv(self.model_dir / "training_data.csv")
                if feature_name in df.columns:
                    self.raw_data = df  # Cache for future use
                    return df[feature_name]
            
            return None
        except Exception as e:
            logger.error(f"Error loading feature data: {e}")
            return None
    
    def _display_embedding_visualization(self):
        """Display embedding visualization with modern design"""
        control_panel = tk.Frame(self.embedding_frame, bg=ModernTheme.BG_SECONDARY)
        control_panel.pack(fill=tk.X, padx=20, pady=(20, 10))

        # Sample size control
        sample_control = tk.Frame(control_panel, bg=ModernTheme.BG_TERTIARY, relief="flat", bd=1)
        sample_control.pack(fill=tk.X, pady=(0, 10))

        tk.Label(sample_control, text="Sample Size:",
                 font=self.fonts["body"], bg=ModernTheme.BG_TERTIARY,
                 fg=ModernTheme.TEXT_SECONDARY).pack(side=tk.LEFT, padx=15, pady=10)

        self.embedding_sample_size = tk.IntVar(value=10000)
        tk.Spinbox(sample_control, from_=1000, to=50000, increment=1000,
                   textvariable=self.embedding_sample_size, width=10,
                   font=self.fonts["body"], bg=ModernTheme.BG_TERTIARY,
                   fg=ModernTheme.TEXT_PRIMARY, buttonbackground=ModernTheme.BG_SECONDARY,
                   insertbackground=ModernTheme.TEXT_PRIMARY).pack(side=tk.LEFT, padx=(0, 15))

        load_btn = self._create_modern_button(sample_control, "Load Vectors",
                                              self._load_embedding_vectors, ModernTheme.INFO)
        load_btn.pack(side=tk.LEFT, padx=(0, 15), pady=5)

        # Loading result label
        self.sample_info_label = tk.Label(sample_control, text="",
                                          font=self.fonts["small"],
                                          bg=ModernTheme.BG_TERTIARY,
                                          fg=ModernTheme.TEXT_MUTED)
        self.sample_info_label.pack(side=tk.LEFT, padx=15)

        # Visualization type selection
        viz_frame = tk.Frame(control_panel, bg=ModernTheme.BG_TERTIARY, relief="flat", bd=1)
        viz_frame.pack(fill=tk.X)

        tk.Label(viz_frame, text="Visualization Type:", font=self.fonts["body"],
                 bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_SECONDARY).pack(side=tk.LEFT, padx=15, pady=10)

        self.viz_type = tk.StringVar(value="distribution")
        for text, value in [("Distribution", "distribution"), ("Heatmap", "heatmap"),
                            ("Statistics", "statistics"), ("t-SNE", "tsne"), 
                            ("PCA", "pca"), ("Feature STD", "feature_std")]:
            tk.Radiobutton(viz_frame, text=text, variable=self.viz_type, value=value,
                           font=self.fonts["body"], bg=ModernTheme.BG_TERTIARY,
                           fg=ModernTheme.TEXT_PRIMARY, selectcolor=ModernTheme.BG_TERTIARY,
                           activebackground=ModernTheme.BG_TERTIARY,
                           command=lambda v=value: self._update_embedding_viz(v)
                           ).pack(side=tk.LEFT, padx=10)

        # Visualization frame
        self.viz_frame = tk.Frame(self.embedding_frame, bg=ModernTheme.BG_SECONDARY)
        self.viz_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)

        tk.Label(self.viz_frame,
                 text="Click 'Load Vectors' to begin visualization",
                 font=self.fonts["body"], bg=ModernTheme.BG_SECONDARY,
                 fg=ModernTheme.TEXT_MUTED).pack(expand=True)

    def _load_embedding_vectors(self) -> None:
        """Load embedding vectors for visualization"""
        logger.debug("Loading embedding vectors...")
        for widget in self.viz_frame.winfo_children():
            widget.destroy()

        loading_lbl = tk.Label(self.viz_frame, text="Loading vectors…",
                            font=self.fonts["body"], bg=ModernTheme.BG_SECONDARY,
                            fg=ModernTheme.TEXT_SECONDARY)
        loading_lbl.pack(expand=True)
        self.window.update()

        try:
            vectors: Optional[np.ndarray] = None
            if hasattr(self.searcher, "vectors"):
                vectors = self.searcher.vectors
                self.total_vector_count = len(vectors)
            elif hasattr(self.searcher, "index") and hasattr(self.searcher.index, "reconstruct"):
                n_total = self.searcher.index.ntotal
                d = self.searcher.index.d
                self.total_vector_count = n_total
                samp_idx = np.random.choice(n_total, min(self.embedding_sample_size.get(), n_total), replace=False)
                vectors = np.empty((len(samp_idx), d), dtype=np.float32)
                for i, real_idx in enumerate(samp_idx):
                    vectors[i] = self.searcher.index.reconstruct(int(real_idx))
                    if i % 200 == 0:
                        loading_lbl.config(text=f"Loading vectors… {i + 1}/{len(samp_idx)}")
                        self.window.update_idletasks()

            if vectors is None or len(vectors) == 0:
                loading_lbl.config(text="No embedding vectors available")
                self.sample_info_label.config(text="")
                return

            sample_size = min(self.embedding_sample_size.get(), len(vectors))
            if sample_size < len(vectors):
                sel = np.random.choice(len(vectors), sample_size, replace=False)
                vectors = vectors[sel]
                self.is_sampled = True
            else:
                self.is_sampled = False

            self.embedding_vectors = vectors
            self.sample_info_label.config(text=f"Loaded: {len(vectors):,}/{self.total_vector_count:,} vectors")
        except Exception as e:
            logger.error("Vector load error: %s", e)
            loading_lbl.config(text=f"Load failed: {e}")
            self.sample_info_label.config(text="")
            return
        finally:
            loading_lbl.destroy()

        self._update_embedding_viz("distribution")

    def _update_embedding_viz(self, viz_type: str) -> None:
        """Redraw the embedding visualization area according to viz_type."""
        for widget in self.viz_frame.winfo_children():
            widget.destroy()

        if self.embedding_vectors is None:
            tk.Label(self.viz_frame, text="Please load vectors first",
                     font=self.fonts["body"], bg=ModernTheme.BG_SECONDARY,
                     fg=ModernTheme.TEXT_MUTED).pack(expand=True)
            return

        fig = Figure(figsize=(10, 6), dpi=100, facecolor=ModernTheme.BG_SECONDARY)

        # Delegate to visualizer
        if viz_type == "distribution":
            self.visualizer.plot_norm_distribution(fig, self.embedding_vectors)
        elif viz_type == "heatmap":
            self.visualizer.plot_dimension_heatmap(fig, self.embedding_vectors)
        elif viz_type == "statistics":
            self.visualizer.plot_statistics_summary(fig, self.embedding_vectors)
        elif viz_type == "tsne":
            self.visualizer.plot_tsne(fig, self.embedding_vectors)
        elif viz_type == "pca":
            self.visualizer.plot_pca(fig, self.embedding_vectors)
        elif viz_type == "feature_std":
            self.visualizer.plot_feature_std_distribution(fig, self.embedding_vectors)

        canvas = FigureCanvasTkAgg(fig, master=self.viz_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        toolbar_fr = tk.Frame(self.viz_frame, bg=ModernTheme.BG_TERTIARY, height=40)
        toolbar_fr.pack(fill=tk.X)
        toolbar_fr.pack_propagate(False)
        from matplotlib.backends.backend_tkagg import NavigationToolbar2Tk
        NavigationToolbar2Tk(canvas, toolbar_fr).update()
        
        # Keep action bar on top
        self.window.after_idle(self.action_bar.lift)
    
    def _display_performance_metrics(self):
        """Display performance metrics with modern UI"""
        config_card, config_content = self._create_card(self.performance_frame, 
                                                       "Performance Test Configuration", "⚙️")
        config_card.pack(fill=tk.X, padx=20, pady=(20, 10))
        
        options_frame = tk.Frame(config_content, bg=ModernTheme.BG_CARD)
        options_frame.pack(fill=tk.X)
        
        tk.Label(options_frame, text="Test Samples:", font=self.fonts["body"],
                bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_SECONDARY).pack(side=tk.LEFT, padx=(0, 10))
        
        self.sample_count_var = tk.IntVar(value=100)
        sample_spinbox = tk.Spinbox(options_frame, from_=10, to=1000, textvariable=self.sample_count_var,
                                   width=10, font=self.fonts["body"], bg=ModernTheme.BG_TERTIARY,
                                   fg=ModernTheme.TEXT_PRIMARY, buttonbackground=ModernTheme.BG_SECONDARY,
                                   insertbackground=ModernTheme.TEXT_PRIMARY)
        sample_spinbox.pack(side=tk.LEFT, padx=(0, 20))
        
        test_btn = self._create_modern_button(options_frame, "▶ Run Performance Test", 
                                            self._run_performance_test, ModernTheme.PRIMARY)
        test_btn.pack(side=tk.LEFT)
        
        self.perf_result_frame = tk.Frame(self.performance_frame, bg=ModernTheme.BG_SECONDARY)
        self.perf_result_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        tk.Label(self.perf_result_frame, 
                text="Click 'Run Performance Test' to begin analysis",
                font=self.fonts["body"], bg=ModernTheme.BG_SECONDARY,
                fg=ModernTheme.TEXT_MUTED).pack(expand=True)
    
    def _run_performance_test(self):
        """Run performance test with beautiful visualization"""
        if not self.searcher or not hasattr(self.searcher, 'find_similar'):
            messagebox.showwarning("Test Unavailable", "Model not loaded properly")
            return
        
        for widget in self.perf_result_frame.winfo_children():
            widget.destroy()
        
        progress_card, progress_content = self._create_card(self.perf_result_frame, 
                                                          "Testing in Progress...", "⏳")
        progress_card.pack(pady=20)
        
        progress_bar = ttk.Progressbar(progress_content, mode='indeterminate', 
                                      style='Modern.Horizontal.TProgressbar')
        progress_bar.pack(fill=tk.X, pady=10)
        progress_bar.start(10)
        
        self.window.update()
        
        try:
            import time
            
            sample_count = self.sample_count_var.get()
            
            # Get test vectors
            if hasattr(self.searcher, 'vectors'):
                vectors = self.searcher.vectors
                total_vectors = len(vectors)
            elif hasattr(self.searcher, 'index'):
                total_vectors = self.searcher.index.ntotal
                sample_indices = np.random.choice(total_vectors, 
                                                min(sample_count, total_vectors), 
                                                replace=False)
                vectors = []
                for idx in sample_indices:
                    vectors.append(self.searcher.index.reconstruct(int(idx)))
                vectors = np.array(vectors)
            else:
                raise Exception("Vector data not found")
            
            if hasattr(self.searcher, 'vectors'):
                sample_indices = np.random.choice(len(vectors), 
                                                min(sample_count, len(vectors)), 
                                                replace=False)
                test_vectors = vectors[sample_indices]
            else:
                test_vectors = vectors
            
            # Run performance tests
            times = []
            for i, query_vector in enumerate(test_vectors):
                start_time = time.time()
                self.searcher.find_similar(query_vector, top_k=10)
                elapsed_time = time.time() - start_time
                times.append(elapsed_time * 1000)
                
                if i % 10 == 0:
                    self.window.update()
            
            times_array = np.array(times)
            stats = {
                'avg': np.mean(times_array),
                'std': np.std(times_array),
                'min': np.min(times_array),
                'max': np.max(times_array),
                'p50': np.percentile(times_array, 50),
                'p95': np.percentile(times_array, 95),
                'p99': np.percentile(times_array, 99),
                'qps': 1000 / np.mean(times_array)
            }
            
            progress_card.destroy()
            
            # Display results using visualizer
            self.visualizer.plot_performance_results(self.perf_result_frame, times_array, stats)
            
        except Exception as e:
            logger.error(f"Performance test error: {e}")
            messagebox.showerror("Test Error", f"Performance test failed:\n{str(e)}")
    
    def _display_model_analysis(self):
        """Display comprehensive model analysis"""
        analysis_container = tk.Frame(self.analysis_frame, bg=ModernTheme.BG_SECONDARY)
        analysis_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        options_card, options_content = self._create_card(analysis_container, 
                                                         "Analysis Options", "🔍")
        options_card.pack(fill=tk.X, pady=(0, 20))
        
        self.analysis_type = tk.StringVar(value="summary")
        
        analysis_types = [
            ("Summary", "summary"),
            ("Feature Importance", "features"),
            ("Vector Quality", "quality"),
            ("Similarity Distribution", "similarity"),
            ("Top-k Similarity", "topk_similarity")
        ]
        
        for text, value in analysis_types:
            btn = tk.Radiobutton(options_content, text=text, variable=self.analysis_type, 
                               value=value, font=self.fonts["body"], 
                               bg=ModernTheme.BG_CARD, fg=ModernTheme.TEXT_PRIMARY,
                               selectcolor=ModernTheme.BG_CARD,
                               activebackground=ModernTheme.BG_CARD,
                               command=lambda: self._update_analysis(self.analysis_type.get()))
            btn.pack(side=tk.LEFT, padx=10)
        
        self.analysis_display = tk.Frame(analysis_container, bg=ModernTheme.BG_SECONDARY)
        self.analysis_display.pack(fill=tk.BOTH, expand=True)
        
        self._update_analysis("summary")
    
    def _update_analysis(self, analysis_type: str):
        """Update analysis display"""
        for widget in self.analysis_display.winfo_children():
            widget.destroy()
        
        if analysis_type == "summary":
            self._show_summary_analysis()
        elif analysis_type == "features":
            self._show_feature_importance()
        elif analysis_type == "quality":
            self._show_vector_quality()
        elif analysis_type == "similarity":
            self._show_similarity_distribution()
        elif analysis_type == "topk_similarity":
            self._show_topk_similarity_comparison()
    
    def _show_summary_analysis(self):
        """Show summary analysis"""
        summary_card, summary_content = self._create_card(self.analysis_display, 
                                                         "Model Summary Analysis", "📊")
        summary_card.pack(fill=tk.BOTH, expand=True)
        
        text_widget = tk.Text(summary_content, font=self.fonts["code"],
                            bg=ModernTheme.BG_TERTIARY, fg=ModernTheme.TEXT_PRIMARY,
                            relief="flat", bd=10, wrap=tk.WORD)
        text_widget.pack(fill=tk.BOTH, expand=True)
        
        analysis = self._generate_summary_analysis()
        text_widget.insert("1.0", analysis)
        text_widget.config(state=tk.DISABLED)
    
    def _generate_summary_analysis(self) -> str:
        """Generate comprehensive summary analysis"""
        from backend.constants import NUMERIC_FEATURES
        
        analysis = """
MODEL SUMMARY ANALYSIS
════════════════════════════════════════════════════

1. MODEL CONFIGURATION
────────────────────────────────────────────────────
"""
        
        if self.model_info["exists"]:
            analysis += f"✓ Model Status: ACTIVE\n"
            analysis += f"✓ Model Path: {self.model_info['model_path']}\n"
            analysis += f"✓ Created: {self.model_info['creation_time']}\n"
            
            # Enhanced components status
            if self.model_info["enhanced_components"]["has_metadata"]:
                analysis += f"✓ Model Type: ENHANCED (with metadata)\n"
            else:
                analysis += f"✓ Model Type: STANDARD\n"
                
            if self.model_info["enhanced_components"]["has_pca"]:
                analysis += f"✓ PCA: ENABLED\n"
            if self.model_info["enhanced_components"]["has_feature_weights"]:
                analysis += f"✓ Feature Weights: ENABLED\n"
            if self.model_info["enhanced_components"]["has_variance_selector"]:
                analysis += f"✓ Variance Selection: ENABLED\n"
            
            analysis += "\n"
        else:
            analysis += f"✗ Model Status: NOT FOUND\n\n"
        
        analysis += """2. FEATURE ENGINEERING
────────────────────────────────────────────────────
"""
        
        if self.feature_columns:
            numeric = [f for f in self.feature_columns if f in NUMERIC_FEATURES]
            categorical = [f for f in self.feature_columns if f not in NUMERIC_FEATURES]
            
            analysis += f"• Total Features: {len(self.feature_columns)}\n"
            analysis += f"• Numeric Features: {len(numeric)} ({len(numeric)/len(self.feature_columns)*100:.1f}%)\n"
            analysis += f"• Categorical Features: {len(categorical)} ({len(categorical)/len(self.feature_columns)*100:.1f}%)\n"
            
            # Add feature weights info if available
            if self.feature_weights:
                sorted_weights = sorted(self.feature_weights.items(), 
                                      key=lambda x: x[1], reverse=True)[:5]
                analysis += f"\n• Top 5 Weighted Features:\n"
                for feat, weight in sorted_weights:
                    analysis += f"  - {feat}: {weight:.2f}\n"
            
            analysis += "\n"
        
        analysis += """3. VECTOR SPACE ANALYSIS
────────────────────────────────────────────────────
"""
        
        if self.model_info["statistics"]:
            stats = self.model_info["statistics"]
            if "vector_count" in stats:
                analysis += f"• Total Vectors: {stats['vector_count']:,}\n"
            if "vector_dim" in stats:
                analysis += f"• Vector Dimension: {stats['vector_dim']}D\n"
                analysis += f"• Dimension Reduction: {len(self.feature_columns)} → {stats['vector_dim']}\n"
            if "item_count" in stats:
                analysis += f"• Unique Items: {stats['item_count']:,}\n"
            if "pca_components" in stats:
                analysis += f"• PCA Components: {stats['pca_components']}\n"
            if "pca_variance_explained" in stats:
                analysis += f"• PCA Variance Explained: {stats['pca_variance_explained']*100:.1f}%\n"
        
        if hasattr(self, 'embedding_vectors') and self.embedding_vectors is not None:
            norms = np.linalg.norm(self.embedding_vectors, axis=1)
            dim_stds = np.std(self.embedding_vectors, axis=0)
            dead_dims = np.sum(dim_stds < 0.01)
            active_dims = len(dim_stds) - dead_dims
            analysis += f"\n• Vector Norm Statistics:\n"
            analysis += f"  - Mean: {np.mean(norms):.4f}\n"
            analysis += f"  - Std Dev: {np.std(norms):.4f}\n"
            analysis += f"  - Min: {np.min(norms):.4f}\n"
            analysis += f"  - Max: {np.max(norms):.4f}\n"
            analysis += f"  - Active Dimensions: {active_dims}\n"
            analysis += f"  - Dead Dimensions: {dead_dims}\n"
        
        analysis += """\n4. MODEL QUALITY INDICATORS
────────────────────────────────────────────────────
"""
        
        if hasattr(self, 'embedding_vectors') and self.embedding_vectors is not None:
            norms = np.linalg.norm(self.embedding_vectors, axis=1)
            norm_variance = np.var(norms)
            
            dim_stds = np.std(self.embedding_vectors, axis=0)
            dead_dims = np.sum(dim_stds < 0.01)
            
            analysis += f"• Norm Variance: {norm_variance:.4f} "
            if norm_variance < 0.1:
                analysis += "(✓ Good - Low variance)\n"
            else:
                analysis += "(⚠ High variance detected)\n"
            
            analysis += f"• Dead Dimensions: {dead_dims} "
            if dead_dims == 0:
                analysis += "(✓ Excellent - All dimensions active)\n"
            elif dead_dims < 5:
                analysis += "(✓ Good - Few inactive dimensions)\n"
            else:
                analysis += "(⚠ Many inactive dimensions)\n"
            
            sparsity = np.mean(np.abs(self.embedding_vectors) < 0.01)
            analysis += f"• Sparsity: {sparsity*100:.1f}% "
            if sparsity < 0.1:
                analysis += "(✓ Good - Dense representations)\n"
            else:
                analysis += "(⚠ High sparsity detected)\n"
        
        # Add metadata-based quality indicators
        if "training_metadata" in self.metadata:
            training_info = self.metadata["training_metadata"].get("training_info", {})
            if "preprocessor_config" in training_info:
                config = training_info["preprocessor_config"]
                analysis += f"\n• Preprocessing Quality:\n"
                if config.get("normalize_output"):
                    analysis += f"  - Normalization: ✓ Enabled\n"
                if config.get("auto_feature_weights"):
                    analysis += f"  - Auto Feature Weights: ✓ Enabled\n"
                if config.get("use_pca"):
                    analysis += f"  - PCA Reduction: ✓ Enabled\n"
                if config.get("balance_dimensions"):
                    analysis += f"  - Dimension Balancing: ✓ Enabled\n"
        
        analysis += """\n5. RECOMMENDATIONS
────────────────────────────────────────────────────
"""
        
        recommendations = []
        
        if hasattr(self, 'embedding_vectors') and self.embedding_vectors is not None:
            if dead_dims > 5:
                recommendations.append("• Consider reducing vector dimensions")
            if norm_variance > 0.5:
                recommendations.append("• Consider normalizing vectors")
            if sparsity > 0.2:
                recommendations.append("• Review feature engineering pipeline")
        
        if not self.model_info["enhanced_components"]["has_metadata"]:
            recommendations.append("• Upgrade to enhanced model for better analysis")
        
        if not self.model_info["enhanced_components"]["has_pca"] and len(self.feature_columns) > 50:
            recommendations.append("• Consider enabling PCA for dimension reduction")
        
        if not self.model_info["enhanced_components"]["has_feature_weights"]:
            recommendations.append("• Enable feature weights for better performance")
        
        if not recommendations:
            recommendations.append("• Model appears well-configured")
            recommendations.append("• Continue monitoring performance")
        
        analysis += "\n".join(recommendations)
        
        return analysis
    
    def _show_feature_importance(self):
        """Show feature importance analysis"""
        card, content = self._create_card(self.analysis_display, 
                                         "Feature Importance Analysis", "🎯")
        card.pack(fill=tk.BOTH, expand=True)
        
        if self.feature_weights:
            # Create visualization of feature weights
            fig = Figure(figsize=(10, 8), dpi=100, facecolor=ModernTheme.BG_CARD)
            ax = fig.add_subplot(111)
            
            # Sort features by weight
            sorted_features = sorted(self.feature_weights.items(), 
                                   key=lambda x: x[1], reverse=True)[:30]
            
            features = [f[0] for f in sorted_features]
            weights = [f[1] for f in sorted_features]
            
            # Create horizontal bar chart
            bars = ax.barh(range(len(features)), weights)
            
            # Color gradient based on weight
            colors = []
            for w in weights:
                if w >= 2.5:
                    colors.append(ModernTheme.ERROR)
                elif w >= 2.0:
                    colors.append(ModernTheme.WARNING)
                elif w >= 1.5:
                    colors.append(ModernTheme.INFO)
                else:
                    colors.append(ModernTheme.PRIMARY)
            
            for bar, color in zip(bars, colors):
                bar.set_color(color)
                bar.set_alpha(0.7)
            
            ax.set_yticks(range(len(features)))
            ax.set_yticklabels(features)
            ax.set_xlabel('Feature Weight', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
            ax.set_title('Top 30 Feature Weights', fontsize=16, fontweight='bold',
                        color=ModernTheme.TEXT_PRIMARY, pad=20)
            ax.grid(True, axis='x', alpha=0.2)
            ax.set_facecolor(ModernTheme.BG_TERTIARY)
            
            # Add value labels
            for i, (feature, weight) in enumerate(sorted_features):
                ax.text(weight + 0.02, i, f'{weight:.2f}', 
                       va='center', fontsize=8, color=ModernTheme.TEXT_PRIMARY)
            
            fig.tight_layout()
            fig.patch.set_facecolor(ModernTheme.BG_CARD)
            
            canvas = FigureCanvasTkAgg(fig, master=content)
            canvas.draw()
            canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        else:
            tk.Label(content, text="Feature weights not available for this model\n"
                                  "Enable auto_feature_weights during training",
                    font=self.fonts["body"], bg=ModernTheme.BG_CARD,
                    fg=ModernTheme.TEXT_MUTED).pack(expand=True)
    
    def _show_vector_quality(self):
        """Show vector quality analysis"""
        if not hasattr(self, 'embedding_vectors') or self.embedding_vectors is None:
            card, content = self._create_card(self.analysis_display, 
                                             "Vector Quality Analysis", "💎")
            card.pack(fill=tk.BOTH, expand=True)
            
            tk.Label(content, text="No vector data available for analysis",
                    font=self.fonts["body"], bg=ModernTheme.BG_CARD,
                    fg=ModernTheme.TEXT_MUTED).pack(expand=True)
            return
        
        fig = Figure(figsize=(12, 8), dpi=100, facecolor=ModernTheme.BG_SECONDARY)
        self.visualizer.plot_vector_quality(fig, self.embedding_vectors)
        
        canvas = FigureCanvasTkAgg(fig, master=self.analysis_display)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
    
    def _show_similarity_distribution(self):
        """Show similarity distribution analysis"""
        if not hasattr(self, 'embedding_vectors') or self.embedding_vectors is None:
            card, content = self._create_card(self.analysis_display, 
                                             "Similarity Distribution", "🔗")
            card.pack(fill=tk.BOTH, expand=True)
            
            tk.Label(content, text="No vector data available for analysis",
                    font=self.fonts["body"], bg=ModernTheme.BG_CARD,
                    fg=ModernTheme.TEXT_MUTED).pack(expand=True)
            return
        
        n_samples = min(1000, len(self.embedding_vectors))
        indices = np.random.choice(len(self.embedding_vectors), n_samples, replace=False)
        sample_vectors = self.embedding_vectors[indices]
        
        from sklearn.metrics.pairwise import cosine_similarity
        similarities = []
        
        for i in range(min(100, n_samples)):
            for j in range(i+1, min(100, n_samples)):
                sim = cosine_similarity([sample_vectors[i]], [sample_vectors[j]])[0][0]
                similarities.append(sim)
        
        similarities = np.array(similarities)
        
        fig = Figure(figsize=(10, 6), dpi=100, facecolor=ModernTheme.BG_SECONDARY)
        ax = fig.add_subplot(111)
        
        n, bins, patches = ax.hist(similarities, bins=50, color=ModernTheme.PRIMARY, 
                                  alpha=0.7, edgecolor=ModernTheme.PRIMARY_DARK)
        
        mean_sim = np.mean(similarities)
        std_sim = np.std(similarities)
        
        ax.axvline(mean_sim, color=ModernTheme.ERROR, linestyle='--', linewidth=2,
                  label=f'Mean: {mean_sim:.3f}')
        ax.axvline(mean_sim - std_sim, color=ModernTheme.WARNING, linestyle=':', linewidth=2,
                  label=f'±1 STD: {std_sim:.3f}')
        ax.axvline(mean_sim + std_sim, color=ModernTheme.WARNING, linestyle=':', linewidth=2)
        
        ax.set_xlabel('Cosine Similarity', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel('Frequency', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_title('Pairwise Similarity Distribution', fontsize=16, fontweight='bold',
                    color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.legend(loc='upper right', framealpha=0.9, facecolor=ModernTheme.BG_TERTIARY,
                 edgecolor=ModernTheme.PRIMARY)
        ax.grid(True, alpha=0.2)
        ax.set_facecolor(ModernTheme.BG_TERTIARY)
        
        ax.text(0.02, 0.98, f'Based on {len(similarities):,} random pairs', 
               transform=ax.transAxes, fontsize=10, color=ModernTheme.TEXT_SECONDARY,
               verticalalignment='top')
        
        fig.patch.set_facecolor(ModernTheme.BG_SECONDARY)
        
        canvas = FigureCanvasTkAgg(fig, master=self.analysis_display)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def _show_topk_similarity_comparison(self):
        """Show top-k similarity comparison with and without normalization"""
        if not hasattr(self, 'embedding_vectors') or self.embedding_vectors is None:
            card, content = self._create_card(self.analysis_display, 
                                             "Top-k Similarity Comparison", "🔗")
            card.pack(fill=tk.BOTH, expand=True)
            
            tk.Label(content, text="No vector data available for analysis",
                    font=self.fonts["body"], bg=ModernTheme.BG_CARD,
                    fg=ModernTheme.TEXT_MUTED).pack(expand=True)
            return
        
        # Sample vectors
        n_samples = min(100, len(self.embedding_vectors))
        indices = np.random.choice(len(self.embedding_vectors), n_samples, replace=False)
        sample_vectors = self.embedding_vectors[indices]
        
        # Normalize vectors
        from sklearn.preprocessing import normalize
        norm_vectors = normalize(sample_vectors, norm='l2')
        
        from sklearn.metrics.pairwise import cosine_similarity
        top_k = 5
        similarities_raw = []
        similarities_norm = []
        
        for i in range(n_samples):
            # Raw similarities
            sim_raw = cosine_similarity([sample_vectors[i]], sample_vectors)[0]
            top_k_indices = np.argsort(sim_raw)[::-1][1:top_k+1]
            similarities_raw.extend(sim_raw[top_k_indices])
            
            # Normalized similarities
            sim_norm = cosine_similarity([norm_vectors[i]], norm_vectors)[0]
            top_k_indices = np.argsort(sim_norm)[::-1][1:top_k+1]
            similarities_norm.extend(sim_norm[top_k_indices])
        
        similarities_raw = np.array(similarities_raw)
        similarities_norm = np.array(similarities_norm)
        
        # Create visualization
        fig = Figure(figsize=(10, 6), dpi=100, facecolor=ModernTheme.BG_SECONDARY)
        ax = fig.add_subplot(111)
        
        # Plot histograms
        ax.hist(similarities_raw, bins=30, alpha=0.5, color=ModernTheme.PRIMARY,
                label='Raw Vectors', edgecolor=ModernTheme.PRIMARY_DARK)
        ax.hist(similarities_norm, bins=30, alpha=0.5, color=ModernTheme.ACCENT,
                label='Normalized Vectors', edgecolor=ModernTheme.ACCENT_DARK)
        
        # Add statistics
        mean_raw = np.mean(similarities_raw)
        mean_norm = np.mean(similarities_norm)
        
        ax.axvline(mean_raw, color=ModernTheme.PRIMARY_DARK, linestyle='--', 
                   label=f'Mean (Raw): {mean_raw:.3f}')
        ax.axvline(mean_norm, color=ModernTheme.ACCENT_DARK, linestyle='--',
                   label=f'Mean (Norm): {mean_norm:.3f}')
        
        ax.set_xlabel('Cosine Similarity', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel('Frequency', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_title(f'Top-{top_k} Similarity Comparison', fontsize=16, fontweight='bold',
                    color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.legend(loc='upper right', framealpha=0.9, facecolor=ModernTheme.BG_TERTIARY,
                 edgecolor=ModernTheme.PRIMARY)
        ax.grid(True, alpha=0.2)
        ax.set_facecolor(ModernTheme.BG_TERTIARY)
        
        ax.text(0.02, 0.98, f'Based on {n_samples} queries, top-{top_k} similarities', 
               transform=ax.transAxes, fontsize=10, color=ModernTheme.TEXT_SECONDARY,
               verticalalignment='top')
        
        fig.patch.set_facecolor(ModernTheme.BG_SECONDARY)
        
        canvas = FigureCanvasTkAgg(fig, master=self.analysis_display)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
    
    def _export_analysis(self):
        """Export detailed analysis report"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = filedialog.asksaveasfilename(
            title="Export Analysis Report",
            initialfile=f"model_analysis_{timestamp}.txt",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        
        if not filename:
            return
        
        try:
            analysis = self._generate_full_analysis()
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(analysis)
            
            messagebox.showinfo("Export Complete", f"Analysis exported to:\n{filename}")
            
        except Exception as e:
            logger.error(f"Export error: {e}")
            messagebox.showerror("Export Error", f"Failed to export analysis:\n{str(e)}")
    
    def _generate_full_analysis(self) -> str:
        """Generate comprehensive analysis report"""
        report = f"""
ML MODEL COMPREHENSIVE ANALYSIS REPORT
{'═' * 80}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Model Path: {self.model_info['model_path']}

{self._generate_summary_analysis()}

"""
        
        # Add enhanced component details
        if self.model_info["enhanced_components"]["has_metadata"]:
            report += """
6. ENHANCED MODEL COMPONENTS
────────────────────────────────────────────────────
"""
            if self.pca is not None:
                report += f"• PCA Components: {self.pca.n_components_}\n"
                report += f"• Variance Explained: {np.sum(self.pca.explained_variance_ratio_)*100:.1f}%\n\n"
            
            if self.feature_weights:
                report += f"• Feature Weights: {len(self.feature_weights)} features weighted\n"
                top_weights = sorted(self.feature_weights.items(), key=lambda x: x[1], reverse=True)[:10]
                report += "• Top 10 Weighted Features:\n"
                for feat, weight in top_weights:
                    report += f"  - {feat}: {weight:.2f}\n"
                report += "\n"
            
            if self.active_features is not None:
                active_count = np.sum(self.active_features)
                total_count = len(self.active_features)
                report += f"• Active Features: {active_count}/{total_count} ({active_count/total_count*100:.1f}%)\n\n"
        
        # Add metadata information
        if self.metadata:
            report += """
7. TRAINING METADATA
────────────────────────────────────────────────────
"""
            if "training_metadata" in self.metadata:
                training_info = self.metadata["training_metadata"].get("training_info", {})
                if "timestamp" in training_info:
                    report += f"• Training Time: {training_info['timestamp']}\n"
                if "preprocessor_config" in training_info:
                    config = training_info["preprocessor_config"]
                    report += f"• Preprocessor Configuration:\n"
                    for key, value in config.items():
                        report += f"  - {key}: {value}\n"
                report += "\n"
        
        report += f"""
{'═' * 80}
END OF REPORT
"""
        return report
    
    def _refresh_info(self):
        """Refresh model information"""
        # Reload components
        self._load_enhanced_components()
        self.model_info = self._load_model_info()
        
        # Clear all tabs
        for widget in self.info_frame.winfo_children():
            widget.destroy()
        for widget in self.feature_frame.winfo_children():
            widget.destroy()
        for widget in self.embedding_frame.winfo_children():
            widget.destroy()
        for widget in self.performance_frame.winfo_children():
            widget.destroy()
        for widget in self.analysis_frame.winfo_children():
            widget.destroy()
        for widget in self.enhanced_frame.winfo_children():
            widget.destroy()
        
        # Redisplay
        self._display_model_info()
        
        messagebox.showinfo("Refresh Complete", "Model information has been refreshed")
    
    def _save_report(self):
        """Save basic report"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = filedialog.asksaveasfilename(
            title="Save Model Report",
            initialfile=f"model_report_{timestamp}.txt",
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt"), ("All files", "*.*")]
        )
        
        if not filename:
            return
        
        try:
            report = self._generate_report()
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(report)
            
            messagebox.showinfo("Save Complete", f"Report saved to:\n{filename}")
            
        except Exception as e:
            logger.error(f"Save error: {e}")
            messagebox.showerror("Save Error", f"Failed to save report:\n{str(e)}")
    
    def _generate_report(self) -> str:
        """Generate basic report"""
        report = f"""
ML MODEL REPORT
{'=' * 60}
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

1. MODEL INFORMATION
{'─' * 40}
- Model Path: {self.model_info['model_path']}
- Status: {'Loaded' if self.model_info['exists'] else 'Not Found'}
- Created: {self.model_info['creation_time']}
- Type: {'Enhanced' if self.model_info['enhanced_components']['has_metadata'] else 'Standard'}

2. FILE INFORMATION
{'─' * 40}
"""
        for file_name, exists in self.model_info['files'].items():
            status = "✓" if exists else "✗"
            size = f" ({self.model_info['file_sizes'].get(file_name, 0):.2f} MB)" if file_name in self.model_info['file_sizes'] else ""
            report += f"• [{status}] {file_name}{size}\n"
        
        report += f"""
3. MODEL STATISTICS
{'─' * 40}
- Feature Dimensions: {self.model_info['feature_count']}
"""
        
        if self.model_info['statistics']:
            for key, value in self.model_info['statistics'].items():
                if isinstance(value, (int, float)):
                    if isinstance(value, float) and value < 1:
                        report += f"• {key}: {value:.4f}\n"
                    else:
                        report += f"• {key}: {value:,}\n"
                else:
                    report += f"• {key}: {value}\n"
        
        # Add enhanced components info
        if any(self.model_info['enhanced_components'].values()):
            report += f"""
4. ENHANCED COMPONENTS
{'─' * 40}
"""
            for component, enabled in self.model_info['enhanced_components'].items():
                status = "✓" if enabled else "✗"
                component_name = component.replace('has_', '').replace('_', ' ').title()
                report += f"• [{status}] {component_name}\n"
        
        report += f"""
5. FEATURE LIST ({len(self.feature_columns)} features)
{'─' * 40}
"""
        for i, feature in enumerate(sorted(self.feature_columns), 1):
            weight_str = ""
            if self.feature_weights and feature in self.feature_weights:
                weight_str = f" (weight: {self.feature_weights[feature]:.2f})"
            report += f"{i:3d}. {feature}{weight_str}\n"
        
        return report


def open_model_info_viewer(parent: tk.Tk, model_dir: str, **kwargs):
    """Open the beautiful model info viewer"""
    viewer = ModelInfoViewer(parent, model_dir, **kwargs)
    return viewer