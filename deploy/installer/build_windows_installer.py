"""Windows 설치 패키지 산출물을 생성하는 스크립트."""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PAYLOAD_DIR = PROJECT_ROOT / "build" / "windows" / "installer"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "build" / "windows"
LOG_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOG_DIR / "installer_build.log"

IGNORE_PATTERNS = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo", "*.log", "*.tmp")


class CommandError(RuntimeError):
    """명령 실행 실패."""


def configure_logging(level: str = "INFO") -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(LOG_FILE, encoding="utf-8"),
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )
    logging.info("설치 패키지 빌드 로그 파일: %s", LOG_FILE)


def read_version() -> str:
    version_file = PROJECT_ROOT / "config" / "version.json"
    if version_file.exists():
        try:
            payload = json.loads(version_file.read_text(encoding="utf-8"))
            version = payload.get("version")
            if isinstance(version, str) and version.strip():
                return version.strip()
        except json.JSONDecodeError:
            logging.warning("version.json 파싱 실패, 기본 버전 사용")
    return "0.0.0-dev"


def run_command(command: Iterable[str], cwd: Optional[Path] = None) -> None:
    command = list(command)
    logging.info("실행: %s", " ".join(command))
    completed = subprocess.run(command, cwd=str(cwd) if cwd else None, check=False)
    if completed.returncode != 0:
        raise CommandError(f"명령 실패(returncode={completed.returncode}): {' '.join(command)}")


def clean_directory(path: Path) -> None:
    if path.exists():
        logging.info("디렉터리 초기화: %s", path)
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def ensure_python_version() -> None:
    if sys.version_info[:2] != (3, 12):
        logging.warning(
            "Python 3.12.x 환경을 권장합니다. 현재 버전: %s.%s",
            sys.version_info.major,
            sys.version_info.minor,
        )


def ensure_pyinstaller() -> None:
    try:
        import PyInstaller  # type: ignore  # noqa: F401
    except ModuleNotFoundError as exc:  # pragma: no cover - 외부 의존성 설치
        logging.info("PyInstaller 미설치 감지, pip를 통해 자동 설치를 시도합니다.")
        run_command([sys.executable, "-m", "pip", "install", "pyinstaller"])
        try:
            import PyInstaller  # type: ignore  # noqa: F401
        except ModuleNotFoundError as retry_exc:
            raise CommandError(
                "PyInstaller 모듈을 자동으로 설치하지 못했습니다. "
                "수동으로 'pip install pyinstaller'를 실행한 뒤 다시 시도하세요."
            ) from retry_exc


def copy_tree(src: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    logging.info("디렉터리 복사: %s -> %s", src, dest)
    shutil.copytree(src, dest, ignore=IGNORE_PATTERNS)


def ensure_payload_structure(payload_dir: Path) -> None:
    for child in ["backend", "frontend", "models", "config", "scripts", "docs", "licenses"]:
        target = payload_dir / child
        target.mkdir(parents=True, exist_ok=True)
        logging.debug("폴더 준비: %s", target)


def build_backend_executable(payload_dir: Path, args: argparse.Namespace) -> Path:
    if args.backend_binary:
        binary_path = Path(args.backend_binary).resolve()
        if not binary_path.exists():
            raise FileNotFoundError(f"지정한 실행 파일을 찾을 수 없습니다: {binary_path}")
        logging.info("기존 빌드 결과 사용: %s", binary_path)
    else:
        if args.skip_backend_build:
            raise ValueError("--skip-backend-build 옵션과 --backend-binary 중 하나는 반드시 지정해야 합니다.")
        ensure_python_version()
        ensure_pyinstaller()
        pyinstaller_cmd = [
            sys.executable,
            "-m",
            "PyInstaller",
            "backend/run_api.py",
            "--name",
            "RoutingMLBackend",
            "--onefile",
            "--noconfirm",
            "--clean",
            "--collect-all",
            "backend",
            "--collect-all",
            "common",
            "--collect-all",
            "models",
            "--collect-all",
            "config",
            "--hidden-import",
            "uvicorn",
            "--hidden-import",
            "uvicorn.workers.asyncio",
        ]
        if args.pyinstaller_extra:
            pyinstaller_cmd.extend(args.pyinstaller_extra)
        run_command(pyinstaller_cmd, cwd=PROJECT_ROOT)
        binary_path = PROJECT_ROOT / "dist" / "RoutingMLBackend.exe"
        if not binary_path.exists():
            # PyInstaller는 Windows가 아닌 환경에서 .exe가 아닐 수 있으므로 보조 경로 확인
            alt_binary = PROJECT_ROOT / "dist" / "RoutingMLBackend"
            if alt_binary.exists():
                binary_path = alt_binary
        if not binary_path.exists():
            raise FileNotFoundError("PyInstaller 빌드 산출물을 찾을 수 없습니다. dist 디렉터리를 확인하세요.")
    destination = payload_dir / "backend" / binary_path.name
    shutil.copy2(binary_path, destination)
    logging.info("백엔드 실행 파일 복사: %s", destination)
    return destination


def build_frontend_assets(payload_dir: Path, args: argparse.Namespace) -> Path:
    frontend_dir = PROJECT_ROOT / "frontend"
    npm_cmd = args.npm_command or ("npm.cmd" if os.name == "nt" else "npm")
    if not args.skip_frontend_build:
        if not args.skip_npm_install:
            run_command([npm_cmd, "install"], cwd=frontend_dir)
        run_command([npm_cmd, "run", "build"], cwd=frontend_dir)
    dist_dir = frontend_dir / "dist"
    if not dist_dir.exists():
        raise FileNotFoundError("프런트엔드 빌드 결과(frontend/dist)가 존재하지 않습니다. npm run build 를 먼저 실행하세요.")
    copy_tree(dist_dir, payload_dir / "frontend")
    logging.info("프런트엔드 정적 리소스 복사 완료")
    return payload_dir / "frontend"


def copy_models(payload_dir: Path) -> None:
    models_src = PROJECT_ROOT / "models"
    if not models_src.exists():
        logging.warning("models 디렉터리가 존재하지 않아 건너뜁니다.")
        return
    copy_tree(models_src, payload_dir / "models")


def copy_config(payload_dir: Path) -> None:
    config_src = PROJECT_ROOT / "config"
    copy_tree(config_src, payload_dir / "config")


def copy_scripts_and_resources(payload_dir: Path) -> None:
    scripts_src = Path(__file__).resolve().parent / "scripts"
    copy_tree(scripts_src, payload_dir / "scripts")

    resources_src = Path(__file__).resolve().parent / "resources"
    if resources_src.exists():
        for child in resources_src.iterdir():
            if child.is_dir():
                copy_tree(child, payload_dir / child.name)
            else:
                shutil.copy2(child, payload_dir / child.name)

    docs_dest = payload_dir / "docs"
    docs_to_copy = [
        PROJECT_ROOT / "docs" / "install_guide_ko.md",
        PROJECT_ROOT / "docs" / "quickstart_guide.md",
        PROJECT_ROOT / "docs" / "TROUBLESHOOTING.md",
    ]
    for doc in docs_to_copy:
        if doc.exists():
            shutil.copy2(doc, docs_dest / doc.name)
            logging.debug("문서 복사: %s", doc)
        else:
            logging.warning("문서를 찾을 수 없습니다: %s", doc)


def write_manifest(payload_dir: Path, backend_binary: Path, version: str, args: argparse.Namespace) -> None:
    manifest = {
        "version": version,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "backend_binary": backend_binary.name,
        "frontend_files": sum(1 for _ in (payload_dir / "frontend").rglob("*")),
        "models_files": sum(1 for _ in (payload_dir / "models").rglob("*")) if (payload_dir / "models").exists() else 0,
        "config_files": sum(1 for _ in (payload_dir / "config").rglob("*")),
        "scripts": sorted(p.name for p in (payload_dir / "scripts").glob("*.ps1")),
        "options": {
            "skip_frontend_build": bool(args.skip_frontend_build),
            "skip_backend_build": bool(args.skip_backend_build),
            "npm_command": args.npm_command,
        },
    }
    manifest_path = payload_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    logging.info("매니페스트 작성: %s", manifest_path)


def generate_inno_setup_script(payload_dir: Path, output_dir: Path, version: str) -> Path:
    template_path = Path(__file__).resolve().parent / "templates" / "installer.iss.tpl"
    template = template_path.read_text(encoding="utf-8")
    payload_win_path = str(payload_dir.resolve()).replace("/", "\\")
    output_dir.mkdir(parents=True, exist_ok=True)
    output_win_path = str(output_dir.resolve()).replace("/", "\\")
    rendered = template.replace("{APP_VERSION}", version).replace("{PAYLOAD_DIR}", payload_win_path).replace("{OUTPUT_DIR}", output_win_path)
    target_path = output_dir / "RoutingMLInstaller.iss"
    target_path.write_text(rendered, encoding="utf-8")
    logging.info("Inno Setup 스크립트 생성: %s", target_path)
    return target_path


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Routing ML Windows 설치 패키지 준비 스크립트")
    parser.add_argument("--version", help="설치 파일 버전. 미지정 시 config/version.json 사용")
    parser.add_argument("--payload-dir", type=Path, default=DEFAULT_PAYLOAD_DIR, help="패키지 페이로드 출력 경로")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Inno Setup 스크립트 출력 경로")
    parser.add_argument("--skip-backend-build", action="store_true", help="PyInstaller 빌드를 건너뜁니다")
    parser.add_argument("--skip-frontend-build", action="store_true", help="npm run build 단계를 건너뜁니다")
    parser.add_argument("--skip-npm-install", action="store_true", help="npm install 단계를 건너뜁니다")
    parser.add_argument("--backend-binary", help="이미 빌드된 백엔드 실행 파일 경로")
    parser.add_argument("--npm-command", help="npm 명령어 대체 (예: yarn)")
    parser.add_argument("--pyinstaller-extra", nargs="*", help="PyInstaller 추가 인자")
    parser.add_argument("--log-level", default="INFO", help="로그 레벨")
    parser.add_argument("--clean", action="store_true", help="payload 디렉터리를 먼저 삭제")
    return parser.parse_args()


def main() -> None:
    args = parse_arguments()
    configure_logging(args.log_level)

    payload_dir: Path = args.payload_dir.resolve()
    output_dir: Path = args.output_dir.resolve()

    version = args.version or read_version()
    logging.info("패키지 버전: %s", version)

    if args.clean:
        clean_directory(payload_dir)
    payload_dir.mkdir(parents=True, exist_ok=True)

    ensure_payload_structure(payload_dir)

    backend_binary = build_backend_executable(payload_dir, args)
    build_frontend_assets(payload_dir, args)
    copy_models(payload_dir)
    copy_config(payload_dir)
    copy_scripts_and_resources(payload_dir)
    write_manifest(payload_dir, backend_binary, version, args)

    iss_path = generate_inno_setup_script(payload_dir, output_dir, version)
    logging.info("설치 패키지 준비 완료. Inno Setup에서 %s 를 빌드하세요.", iss_path)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pylint: disable=broad-except
        logging.exception("설치 패키지 생성 실패: %s", exc)
        sys.exit(1)
