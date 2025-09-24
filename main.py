"""
FKSM Routing-ML Application Entry Point
══════════════════════════════════════════
ML 기반 제조 라우팅 예측 시스템의 메인 진입점
"""

import sys
import os
import tkinter as tk
from common.logger import get_logger

# GUI 모듈 임포트
from gui.routing_gui import RoutingGUI, safe_log

logger = get_logger("main")

def main():
    """메인 애플리케이션 진입점"""
    try:
        # 작업 디렉토리 설정
        if getattr(sys, 'frozen', False):
            # PyInstaller로 패키징된 경우
            application_path = os.path.dirname(sys.executable)
        else:
            # 일반 Python 스크립트로 실행된 경우
            application_path = os.path.dirname(os.path.abspath(__file__))
        
        os.chdir(application_path)
        logger.info(safe_log(f"작업 디렉토리: {application_path}"))
        
        # Tkinter 초기화
        root = tk.Tk()
        
        # 고해상도 디스플레이 지원
        try:
            root.tk.call('tk', 'scaling', 1.2)
        except:
            pass
        
        # GUI 생성
        app = RoutingGUI(root)
        
        # 시작 로그
        logger.info(safe_log("[시작] FKSM Routing-ML GUI 시작됨 - ML 최적화 버전"))
        logger.info(safe_log(f"[설정] 초기 유사도 임계값: {app.similarity_threshold_var.get():.0%}"))
        logger.info(safe_log(f"[설정] 초기 예측 모드: {app.prediction_mode_var.get()}"))
        logger.info(safe_log("[전체화면] F11 키로 전체 화면 전환, ESC 키로 해제"))
        logger.info(safe_log("[복사] Ctrl+C로 테이블 복사, Ctrl+A로 전체 선택"))
        logger.info(safe_log("[ML] ML 모델 기반 유사품 라우팅 예측 시스템"))
        
        # 메인 루프 시작
        root.mainloop()
        
    except Exception as e:
        print(f"[치명적 오류] 애플리케이션 시작 실패: {e}")
        import traceback
        traceback.print_exc()
        
        # 긴급 메시지 박스
        try:
            import tkinter.messagebox as mb
            mb.showerror("시작 실패", 
                        f"애플리케이션을 시작할 수 없습니다.\n\n"
                        f"오류: {str(e)}\n\n"
                        f"로그를 확인하고 관리자에게 문의하세요.")
        except:
            pass
        
        sys.exit(1)

if __name__ == "__main__":
    main()
