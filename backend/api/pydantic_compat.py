"""Runtime compatibility helpers for Pydantic on Python 3.12."""
from __future__ import annotations

import inspect
from typing import Any, cast


def ensure_forward_ref_compat() -> None:
    """Patch Pydantic's ForwardRef evaluator when running on Python 3.12+.

    Python 3.12 changed :func:`typing.ForwardRef._evaluate` to require the
    ``recursive_guard`` keyword argument.  Pydantic v1.10.x still calls the old
    positional signature, which raises ``TypeError`` during FastAPI import.  We
    monkey-patch :func:`pydantic.typing.evaluate_forwardref` to supply the new
    keyword-only argument while keeping backwards compatibility for older
    Python versions.

    NOTE: This patch is only needed for Pydantic v1. For Pydantic v2, this is a no-op.
    """

    # Check Pydantic version - if v2, skip patching
    try:
        import pydantic
        pydantic_version = tuple(int(x) for x in pydantic.__version__.split('.')[:2])
        if pydantic_version >= (2, 0):
            # Pydantic v2 doesn't need this patch
            return
    except Exception:
        return

    try:
        import typing
        from pydantic import typing as pydantic_typing
    except Exception:  # pragma: no cover - defensive
        return

    forward_ref = getattr(typing, "ForwardRef", None)
    if forward_ref is None:
        return

    # Inspect the low-level signature to decide whether we need the patch.
    try:
        signature = inspect.signature(forward_ref("_compat")._evaluate)
    except Exception:  # pragma: no cover - signature probing failed
        return

    needs_recursive_guard = "recursive_guard" in signature.parameters

    if not needs_recursive_guard:
        return

    original = getattr(pydantic_typing, "evaluate_forwardref", None)

    def _patched_evaluate_forwardref(type_: Any, globalns: Any, localns: Any) -> Any:
        try:
            return cast(Any, type_)._evaluate(
                globalns,
                localns,
                recursive_guard=set(),
            )
        except TypeError:
            if original is not None and original is not _patched_evaluate_forwardref:
                return original(type_, globalns, localns)
            return cast(Any, type_)._evaluate(globalns, localns, set())

    pydantic_typing.evaluate_forwardref = _patched_evaluate_forwardref


__all__ = ["ensure_forward_ref_compat"]
