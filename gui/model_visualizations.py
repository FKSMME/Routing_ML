"""
Visualization components for ML Model Analytics Dashboard
"""

import logging
import numpy as np
import tkinter as tk
from tkinter import ttk
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
import matplotlib.pyplot as plt

try:
    from scipy import stats as scipy_stats
except ImportError:
    scipy_stats = None

from gui.themes import ModernTheme, setup_matplotlib_style

logger = logging.getLogger("model_info_viewer")

# ---------------------------------------------------------------------
# GLOBAL SETTINGS
# ---------------------------------------------------------------------
setup_matplotlib_style()


# ---------------------------------------------------------------------
# HELPER: 깨끗한 축 생성 (이전 축 겹침 방지)
# ---------------------------------------------------------------------
def _init_ax(fig, *subplot_args):
    """
    fig.clf()로 그림을 초기화한 뒤 새 축을 반환한다.
    subplot_args 예: (111) 또는 (2,2,1)
    """
    fig.clf()
    ax = fig.add_subplot(*subplot_args)
    ax.set_facecolor(ModernTheme.BG_TERTIARY)
    return ax


class ModelVisualizer:
    """Handles all visualization tasks for the model viewer"""

    # -----------------------------------------------------------------
    # 컨스트럭터
    # -----------------------------------------------------------------
    def __init__(self, parent_viewer):
        self.viewer = parent_viewer
        self.fonts = parent_viewer.fonts

    # -----------------------------------------------------------------
    # 벡터 품질 / 임베딩 통계 관련
    # -----------------------------------------------------------------
    def plot_norm_distribution(self, fig, embedding_vectors):
        ax = _init_ax(fig, 111)
        norms = np.linalg.norm(embedding_vectors, axis=1)
        ax.hist(norms, bins=50, color=ModernTheme.PRIMARY,
                alpha=0.7, edgecolor=ModernTheme.PRIMARY_DARK)
        ax.set_xlabel("Vector Norm", color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel("Frequency", color=ModernTheme.TEXT_PRIMARY)
        ax.set_title("Embedding Vector Norm Distribution",
                     color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.grid(alpha=0.2, color=ModernTheme.GRAY_DARK)
        fig.tight_layout()

    def plot_dimension_heatmap(self, fig, embedding_vectors):
        ax = _init_ax(fig, 111)
        dim_means = np.mean(embedding_vectors, axis=0)[:50]
        im = ax.imshow(dim_means.reshape(1, -1), aspect='auto',
                       cmap='plasma', interpolation='bilinear')
        ax.set_xlabel('Feature Dimension', color=ModernTheme.TEXT_PRIMARY)
        ax.set_title('Dimension-wise Mean Values',
                     color=ModernTheme.TEXT_PRIMARY, pad=20)
        cbar = fig.colorbar(im, ax=ax)
        cbar.ax.tick_params(colors=ModernTheme.TEXT_SECONDARY)
        fig.tight_layout()

    def plot_statistics_summary(self, fig, embedding_vectors):
        ax = _init_ax(fig, 111)
        ax.axis('off')
        norms = np.linalg.norm(embedding_vectors, axis=1)
        dim_stds = np.std(embedding_vectors, axis=0)
        dead_dims = np.sum(dim_stds < 0.01)
        active_dims = len(dim_stds) - dead_dims

        stats_lines = [
            ("Total vectors", f"{len(embedding_vectors):,}"),
            ("Dimension", f"{embedding_vectors.shape[1]}"),
            ("Active Dimensions", f"{active_dims}"),
            ("Dead Dimensions", f"{dead_dims}"),
            ("Mean norm", f"{np.mean(norms):.4f}"),
            ("Std norm", f"{np.std(norms):.4f}"),
            ("Min norm", f"{np.min(norms):.4f}"),
            ("Max norm", f"{np.max(norms):.4f}"),
        ]

        y = 0.9
        for k, v in stats_lines:
            ax.text(0.05, y, f"{k}:", color=ModernTheme.TEXT_SECONDARY,
                    transform=ax.transAxes, fontsize=11, ha='left')
            ax.text(0.35, y, v, color=ModernTheme.TEXT_PRIMARY,
                    transform=ax.transAxes, fontsize=11, ha='left')
            y -= 0.07
        fig.tight_layout()

    def plot_tsne(self, fig, embedding_vectors):
        ax = _init_ax(fig, 111)
        try:
            from sklearn.manifold import TSNE
            sample_sz = min(1000, len(embedding_vectors))
            sample_vecs = (embedding_vectors if sample_sz == len(embedding_vectors)
                           else embedding_vectors[np.random.choice(len(embedding_vectors),
                                                                   sample_sz,
                                                                   replace=False)])
            embeddings_2d = TSNE(n_components=2, init='random',
                                 random_state=42, perplexity=30).fit_transform(sample_vecs)
            sc = ax.scatter(embeddings_2d[:, 0], embeddings_2d[:, 1],
                            c=np.arange(sample_sz), cmap='viridis',
                            alpha=0.6, s=25, edgecolors='none')
            ax.set_title(f"t-SNE Visualization ({sample_sz:,} samples)",
                         color=ModernTheme.TEXT_PRIMARY, pad=20)
            ax.set_xlabel('Component 1', color=ModernTheme.TEXT_PRIMARY)
            ax.set_ylabel('Component 2', color=ModernTheme.TEXT_PRIMARY)
            cbar = fig.colorbar(sc, ax=ax)
            cbar.ax.tick_params(colors=ModernTheme.TEXT_SECONDARY)
            ax.grid(alpha=0.2)
        except ImportError:
            ax.text(0.5, 0.5, "scikit-learn not installed",
                    ha='center', va='center', color=ModernTheme.WARNING)
        except Exception as e:
            ax.text(0.5, 0.5, f"t-SNE error:\n{e}",
                    ha='center', va='center', color=ModernTheme.ERROR)
        fig.tight_layout()

    def plot_pca(self, fig, embedding_vectors):
        ax = _init_ax(fig, 111)
        try:
            from sklearn.decomposition import PCA
            pca = PCA(n_components=2, random_state=42)
            embeddings_2d = pca.fit_transform(embedding_vectors)
            sc = ax.scatter(embeddings_2d[:, 0], embeddings_2d[:, 1],
                            c=np.arange(len(embeddings_2d)), cmap='plasma',
                            alpha=0.5, s=20, edgecolors='none')
            var_ratio = pca.explained_variance_ratio_
            ax.set_xlabel(f'PC1 ({var_ratio[0]:.1%})',
                          color=ModernTheme.TEXT_PRIMARY)
            ax.set_ylabel(f'PC2 ({var_ratio[1]:.1%})',
                          color=ModernTheme.TEXT_PRIMARY)
            ax.set_title('PCA Visualization',
                         color=ModernTheme.TEXT_PRIMARY, pad=20)
            cbar = fig.colorbar(sc, ax=ax)
            cbar.ax.tick_params(colors=ModernTheme.TEXT_SECONDARY)
            ax.grid(alpha=0.2)
        except ImportError:
            ax.text(0.5, 0.5, "scikit-learn not installed",
                    ha='center', va='center', color=ModernTheme.WARNING)
        except Exception as e:
            ax.text(0.5, 0.5, f"PCA error:\n{e}",
                    ha='center', va='center', color=ModernTheme.ERROR)
        fig.tight_layout()

    def plot_feature_std_distribution(self, fig, embedding_vectors):
        ax = _init_ax(fig, 111)
        if embedding_vectors is None:
            ax.text(0.5, 0.5, "No embedding vectors available",
                    ha='center', va='center', color=ModernTheme.WARNING)
            fig.tight_layout()
            return

        dim_stds = np.std(embedding_vectors, axis=0)
        ax.hist(dim_stds, bins=50, color=ModernTheme.ACCENT,
                alpha=0.7, edgecolor=ModernTheme.ACCENT_DARK)
        ax.set_xlabel("Standard Deviation", color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel("Frequency", color=ModernTheme.TEXT_PRIMARY)
        ax.set_title("Feature Standard Deviation Distribution",
                     color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.grid(alpha=0.2, color=ModernTheme.GRAY_DARK)
        fig.tight_layout()

    # -----------------------------------------------------------------
    # NEW: Feature Importance Bar Chart
    # -----------------------------------------------------------------
    def plot_feature_importance(self, fig, importance_dict,
                                weights_dict=None, top_k=30):
        """
        importance_dict : {feature: importance(0~1)}
        weights_dict    : {feature: weight} (optional)
        """
        ax = _init_ax(fig, 111)

        if not importance_dict:
            ax.text(0.5, 0.5, "Run importance analysis first",
                    ha='center', va='center', color=ModernTheme.WARNING)
            fig.tight_layout()
            return

        # 상위 k개 선택
        items = sorted(importance_dict.items(),
                       key=lambda x: -x[1])[:top_k]
        labels, imps = zip(*items)
        y_pos = np.arange(len(labels))[::-1]

        bars = ax.barh(y_pos, imps, color=ModernTheme.PRIMARY,
                       alpha=0.8, edgecolor=ModernTheme.PRIMARY_DARK)

        # (선택) 가중치 숫자 표시
        if weights_dict:
            for i, feat in enumerate(labels):
                w = weights_dict.get(feat, 0)
                ax.text(imps[i] + 0.01, y_pos[i],
                        f"w={w:.2f}", va='center',
                        fontsize=9, color=ModernTheme.TEXT_SECONDARY)

        ax.set_yticks(y_pos)
        ax.set_yticklabels(labels)
        ax.set_xlabel("Importance (normalized)",
                      color=ModernTheme.TEXT_PRIMARY)
        ax.set_title(f"Top-{len(labels)} Feature Importance",
                     color=ModernTheme.TEXT_PRIMARY, pad=15)
        ax.grid(alpha=0.2, color=ModernTheme.GRAY_DARK)
        fig.subplots_adjust(left=0.30, right=0.95)
        fig.tight_layout()

    def plot_performance_results(self, parent_frame, times_array, stats):
        """Plot performance test results"""
        # Statistics cards
        stats_row = tk.Frame(parent_frame, bg=ModernTheme.BG_SECONDARY)
        stats_row.pack(fill=tk.X, pady=(0, 20))
        
        stat_cards = [
            ("Average", f"{stats['avg']:.2f} ms", ModernTheme.PRIMARY),
            ("P95", f"{stats['p95']:.2f} ms", ModernTheme.WARNING),
            ("P99", f"{stats['p99']:.2f} ms", ModernTheme.ERROR),
            ("QPS", f"{stats['qps']:.1f}", ModernTheme.SUCCESS)
        ]
        
        for i, (label, value, color) in enumerate(stat_cards):
            card_frame = tk.Frame(stats_row, bg=color, relief="flat", bd=0)
            card_frame.grid(row=0, column=i, sticky="nsew", padx=5)
            stats_row.grid_columnconfigure(i, weight=1)
            
            inner = tk.Frame(card_frame, bg=color)
            inner.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
            
            tk.Label(inner, text=label, font=self.fonts["small"],
                    bg=color, fg=ModernTheme.WHITE).pack(pady=(15, 5))
            tk.Label(inner, text=value, font=self.fonts["heading"],
                    bg=color, fg=ModernTheme.WHITE).pack(pady=(0, 15))
        
        # Distribution plot
        fig = Figure(figsize=(10, 5), dpi=100, facecolor=ModernTheme.BG_SECONDARY)
        ax = fig.add_subplot(111)
        
        n, bins, patches = ax.hist(times_array, bins=30, color=ModernTheme.PRIMARY, 
                                  alpha=0.7, edgecolor=ModernTheme.PRIMARY_DARK)
        
        for i, patch in enumerate(patches):
            patch.set_alpha(0.5 + 0.5 * (i / len(patches)))
        
        ax.axvline(stats['avg'], color=ModernTheme.ERROR, linestyle='--', linewidth=2,
                  label=f"Average: {stats['avg']:.2f}ms")
        ax.axvline(stats['p95'], color=ModernTheme.WARNING, linestyle='--', linewidth=2,
                  label=f"P95: {stats['p95']:.2f}ms")
        
        ax.set_xlabel('Response Time (ms)', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel('Frequency', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_title('Response Time Distribution', fontsize=16, fontweight='bold',
                    color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.legend(loc='upper right', framealpha=0.9, facecolor=ModernTheme.BG_TERTIARY,
                 edgecolor=ModernTheme.PRIMARY)
        ax.grid(True, alpha=0.2, color=ModernTheme.GRAY_DARK)
        ax.set_facecolor(ModernTheme.BG_TERTIARY)
        
        fig.patch.set_facecolor(ModernTheme.BG_SECONDARY)
        
        canvas = FigureCanvasTkAgg(fig, master=parent_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def create_feature_visualization(self, parent_frame, feature_name, data, is_numeric, 
                                   feature_columns, feature_weights=None):
        """Create comprehensive feature visualization"""
        fig = Figure(figsize=(8, 6), dpi=100, facecolor=ModernTheme.BG_CARD)
        
        if is_numeric:
            self._plot_numeric_feature(fig, feature_name, data)
        else:
            self._plot_categorical_feature(fig, feature_name, data)
        
        fig.patch.set_facecolor(ModernTheme.BG_CARD)
        
        canvas = FigureCanvasTkAgg(fig, master=parent_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        # Add interaction toolbar
        toolbar_frame = tk.Frame(parent_frame, bg=ModernTheme.BG_TERTIARY, height=40)
        toolbar_frame.pack(fill=tk.X)
        toolbar_frame.pack_propagate(False)
        
        NavigationToolbar2Tk(canvas, toolbar_frame).update()

    def _plot_numeric_feature(self, fig, feature_name, data):
        """Plot numeric feature distribution"""
        ax = fig.add_subplot(111)
        
        # Remove NaN values
        clean_data = data.dropna()
        
        # Create histogram
        n, bins, patches = ax.hist(clean_data, bins=50, density=True,
                                  color=ModernTheme.PRIMARY, alpha=0.7,
                                  edgecolor=ModernTheme.PRIMARY_DARK)
        
        # Add KDE if scipy available
        if scipy_stats is not None:
            try:
                kde = scipy_stats.gaussian_kde(clean_data)
                x_range = np.linspace(clean_data.min(), clean_data.max(), 200)
                ax.plot(x_range, kde(x_range), color=ModernTheme.ACCENT,
                       linewidth=2, label='KDE')
            except:
                pass
        
        # Add statistics
        mean_val = clean_data.mean()
        median_val = clean_data.median()
        
        ax.axvline(mean_val, color=ModernTheme.ERROR, linestyle='--',
                  linewidth=2, label=f'Mean: {mean_val:.3f}')
        ax.axvline(median_val, color=ModernTheme.WARNING, linestyle=':',
                  linewidth=2, label=f'Median: {median_val:.3f}')
        
        # Styling
        ax.set_xlabel(feature_name, fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel('Density', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_title(f'Distribution of {feature_name}', fontsize=14,
                    fontweight='bold', color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.legend(loc='best', framealpha=0.9, facecolor=ModernTheme.BG_TERTIARY)
        ax.grid(True, alpha=0.2)
        ax.set_facecolor(ModernTheme.BG_TERTIARY)
        
        # Add text box with statistics
        stats_text = f'Count: {len(clean_data):,}\n'
        stats_text += f'Missing: {len(data) - len(clean_data):,}\n'
        stats_text += f'Std Dev: {clean_data.std():.3f}\n'
        stats_text += f'Skewness: {clean_data.skew():.3f}\n'
        stats_text += f'Kurtosis: {clean_data.kurtosis():.3f}'
        
        ax.text(0.02, 0.98, stats_text, transform=ax.transAxes,
               fontsize=10, verticalalignment='top',
               bbox=dict(boxstyle='round', facecolor=ModernTheme.BG_SECONDARY,
                       edgecolor=ModernTheme.PRIMARY, alpha=0.8),
               color=ModernTheme.TEXT_PRIMARY)

    def _plot_categorical_feature(self, fig, feature_name, data):
        """Plot categorical feature frequency"""
        ax = fig.add_subplot(111)
        
        # Get value counts
        value_counts = data.value_counts()
        
        # Limit to top 20 if too many categories
        if len(value_counts) > 20:
            value_counts = value_counts.head(20)
            title_suffix = " (Top 20)"
        else:
            title_suffix = ""
        
        # Create bar chart
        bars = ax.bar(range(len(value_counts)), value_counts.values,
                      color=ModernTheme.PRIMARY, alpha=0.7,
                      edgecolor=ModernTheme.PRIMARY_DARK)
        
        # Color gradient for bars
        for i, bar in enumerate(bars):
            bar.set_alpha(0.4 + 0.6 * (1 - i / len(bars)))
        
        # Set labels
        ax.set_xticks(range(len(value_counts)))
        ax.set_xticklabels(value_counts.index, rotation=45, ha='right')
        ax.set_xlabel('Categories', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_ylabel('Frequency', fontsize=12, color=ModernTheme.TEXT_PRIMARY)
        ax.set_title(f'Frequency Distribution of {feature_name}{title_suffix}',
                    fontsize=14, fontweight='bold', color=ModernTheme.TEXT_PRIMARY, pad=20)
        ax.grid(True, axis='y', alpha=0.2)
        ax.set_facecolor(ModernTheme.BG_TERTIARY)
        
        # Add value labels on bars
        for i, (idx, count) in enumerate(value_counts.items()):
            ax.text(i, count + max(value_counts) * 0.01, str(count),
                   ha='center', va='bottom', fontsize=9,
                   color=ModernTheme.TEXT_PRIMARY)
        
        # Add statistics
        total = len(data)
        unique = data.nunique()
        missing = data.isna().sum()
        
        stats_text = f'Total: {total:,}\n'
        stats_text += f'Unique: {unique:,}\n'
        stats_text += f'Missing: {missing:,}\n'
        stats_text += f'Mode: {data.mode()[0] if len(data.mode()) > 0 else "N/A"}'
        
        ax.text(0.98, 0.98, stats_text, transform=ax.transAxes,
               fontsize=10, verticalalignment='top', ha='right',
               bbox=dict(boxstyle='round', facecolor=ModernTheme.BG_SECONDARY,
                       edgecolor=ModernTheme.PRIMARY, alpha=0.8),
               color=ModernTheme.TEXT_PRIMARY)
        
        fig.tight_layout()

    def plot_vector_quality(self, fig, embedding_vectors):
        """Plot comprehensive vector quality analysis"""
        ax1 = fig.add_subplot(2, 2, 1)
        dim_stds = np.std(embedding_vectors, axis=0)
        ax1.plot(dim_stds, color=ModernTheme.PRIMARY, linewidth=2)
        ax1.fill_between(range(len(dim_stds)), dim_stds, alpha=0.3, color=ModernTheme.PRIMARY)
        ax1.set_xlabel('Dimension', color=ModernTheme.TEXT_PRIMARY)
        ax1.set_ylabel('Standard Deviation', color=ModernTheme.TEXT_PRIMARY)
        ax1.set_title('Dimension Activity', fontsize=14, fontweight='bold', color=ModernTheme.TEXT_PRIMARY)
        ax1.grid(True, alpha=0.2)
        ax1.set_facecolor(ModernTheme.BG_TERTIARY)
        ax1.axhline(y=0.01, color=ModernTheme.ERROR, linestyle='--', linewidth=2, 
                   label='Dead Dimension Threshold')
        ax1.legend()
        
        ax2 = fig.add_subplot(2, 2, 2)
        norms = np.linalg.norm(embedding_vectors, axis=1)
        ax2.hist(norms, bins=50, color=ModernTheme.ACCENT, alpha=0.7, edgecolor=ModernTheme.ACCENT_DARK)
        ax2.set_xlabel('Vector Norm', color=ModernTheme.TEXT_PRIMARY)
        ax2.set_ylabel('Count', color=ModernTheme.TEXT_PRIMARY)
        ax2.set_title('Norm Distribution', fontsize=14, fontweight='bold', color=ModernTheme.TEXT_PRIMARY)
        ax2.grid(True, alpha=0.2)
        ax2.set_facecolor(ModernTheme.BG_TERTIARY)
        
        ax3 = fig.add_subplot(2, 2, 3)
        sparsity_per_dim = np.mean(np.abs(embedding_vectors) < 0.01, axis=0)
        ax3.bar(range(len(sparsity_per_dim)), sparsity_per_dim, 
               color=ModernTheme.WARNING, alpha=0.7)
        ax3.set_xlabel('Dimension', color=ModernTheme.TEXT_PRIMARY)
        ax3.set_ylabel('Sparsity Ratio', color=ModernTheme.TEXT_PRIMARY)
        ax3.set_title('Sparsity by Dimension', fontsize=14, fontweight='bold', color=ModernTheme.TEXT_PRIMARY)
        ax3.grid(True, alpha=0.2)
        ax3.set_facecolor(ModernTheme.BG_TERTIARY)
        
        ax4 = fig.add_subplot(2, 2, 4)
        ax4.axis('off')
        
        # Calculate quality score
        quality_score = 100
        if np.var(norms) > 0.5:
            quality_score -= 20
        dead_dims = np.sum(dim_stds < 0.01)
        if dead_dims > 0:
            quality_score -= (dead_dims / len(dim_stds)) * 30
        avg_sparsity = np.mean(sparsity_per_dim)
        if avg_sparsity > 0.1:
            quality_score -= avg_sparsity * 50
        
        quality_score = max(0, quality_score)
        
        colors = [ModernTheme.ERROR, ModernTheme.WARNING, ModernTheme.SUCCESS]
        color_idx = 0 if quality_score < 60 else (1 if quality_score < 80 else 2)
        
        ax4.text(0.5, 0.7, f'{quality_score:.0f}%', fontsize=48, fontweight='bold',
                ha='center', va='center', color=colors[color_idx])
        ax4.text(0.5, 0.4, 'Quality Score', fontsize=16, ha='center', va='center',
                color=ModernTheme.TEXT_PRIMARY)
        
        quality_text = "Poor" if quality_score < 60 else ("Good" if quality_score < 80 else "Excellent")
        ax4.text(0.5, 0.2, quality_text, fontsize=14, ha='center', va='center',
                color=colors[color_idx])
        
        # Add detailed metrics
        metrics_text = f"Active Dims: {len(dim_stds) - dead_dims}/{len(dim_stds)}\n"
        metrics_text += f"Norm Variance: {np.var(norms):.3f}\n"
        metrics_text += f"Avg Sparsity: {avg_sparsity*100:.1f}%"
        
        ax4.text(0.5, 0.05, metrics_text, fontsize=10, ha='center', va='center',
                color=ModernTheme.TEXT_SECONDARY)
        
        fig.tight_layout()
        fig.patch.set_facecolor(ModernTheme.BG_SECONDARY)