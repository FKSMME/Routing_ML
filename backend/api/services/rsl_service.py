"""Service layer for managing Rule Set Library (RSL) entities."""

from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from backend.api.pydantic_compat import ensure_forward_ref_compat

ensure_forward_ref_compat()


from backend.api.schemas import (
    RslExportBundle,
    RslGroupCreate,
    RslGroupListResponse,
    RslGroupModel,
    RslGroupStatus,
    RslGroupUpdate,
    RslImportRequest,
    RslImportResult,
    RslRuleRefCreate,
    RslRuleRefModel,
    RslStepCreate,
    RslStepModel,
    RslStepStatus,
    RslStepUpdate,
    RslValidationResponse,
)
from backend.database_rsl import (
    RslGroup,
    RslRuleRef,
    RslStep,
    bootstrap_schema,
    session_scope,
)
from common.logger import get_logger


_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")
_MAX_SLUG_LENGTH = 64
_GROUP_RELEASE_ORDER: Sequence[RslGroupStatus] = (
    "draft",
    "ready",
    "pending_review",
    "released",
    "archived",
)
_STEP_STATUS_ORDER: Sequence[RslStepStatus] = ("draft", "ready", "released")


class RslService:
    """Encapsulates business logic for the Rule Set Library."""

    def __init__(self) -> None:
        ensure_forward_ref_compat()

        bootstrap_schema()
        self._logger = get_logger("service.rsl")

    # ------------------------------------------------------------------
    # Utility helpers
    # ------------------------------------------------------------------
    def _slugify(self, value: str) -> str:
        base = _SLUG_PATTERN.sub("-", value.lower()).strip("-") or "group"
        if len(base) > _MAX_SLUG_LENGTH:
            base = base[:_MAX_SLUG_LENGTH]
        return base

    @staticmethod
    def _normalize_tags(tags: Optional[Sequence[str]]) -> List[str]:
        seen: List[str] = []
        if not tags:
            return []
        for tag in tags:
            cleaned = tag.strip()
            if not cleaned:
                continue
            if cleaned not in seen:
                seen.append(cleaned)
        return seen

    def _ensure_unique_slug(
        self, session, desired: str, *, current_id: Optional[int] = None
    ) -> str:
        slug = desired
        counter = 1
        while True:
            stmt = select(RslGroup).where(RslGroup.slug == slug)
            existing = session.execute(stmt).scalar_one_or_none()
            if not existing or (current_id is not None and existing.id == current_id):
                return slug
            counter += 1
            suffix = f"-{counter}"
            base = desired[: _MAX_SLUG_LENGTH - len(suffix)]
            slug = f"{base}{suffix}"

    def _load_group(self, session, group_id: int) -> RslGroup:
        stmt = (
            select(RslGroup)
            .options(
                selectinload(RslGroup.steps).selectinload(RslStep.rules)
            )
            .where(RslGroup.id == group_id)
        )
        group = session.execute(stmt).scalar_one_or_none()
        if group is None:
            raise ValueError("그룹을 찾을 수 없습니다")
        return group

    def _assert_owner(self, group: RslGroup, username: str) -> None:
        if group.owner != username:
            raise PermissionError("해당 그룹에 대한 수정 권한이 없습니다")

    def _to_rule_model(self, rule: RslRuleRef) -> RslRuleRefModel:
        return RslRuleRefModel(
            id=rule.id,
            rule_name=rule.rule_name,
            rule_version=rule.rule_version,
            metadata=dict(rule.payload or {}),
            is_optional=rule.is_optional,
            created_at=rule.created_at,
        )

    def _to_step_model(self, step: RslStep) -> RslStepModel:
        return RslStepModel(
            id=step.id,
            sequence=step.sequence,
            name=step.name,
            description=step.description,
            status=step.status,  # type: ignore[arg-type]
            tags=list(step.tags or []),
            config=dict(step.config or {}),
            created_at=step.created_at,
            updated_at=step.updated_at,
            rules=[self._to_rule_model(rule) for rule in step.rules],
        )

    def _to_group_model(self, group: RslGroup) -> RslGroupModel:
        ordered_steps = sorted(group.steps, key=lambda step: step.sequence)
        return RslGroupModel(
            id=group.id,
            slug=group.slug,
            name=group.name,
            description=group.description,
            owner=group.owner,
            tags=list(group.tags or []),
            status=group.status,  # type: ignore[arg-type]
            validation_errors=list(group.validation_errors or []),
            last_validated_at=group.last_validated_at,
            released_at=group.released_at,
            released_by=group.released_by,
            created_at=group.created_at,
            updated_at=group.updated_at,
            steps=[self._to_step_model(step) for step in ordered_steps],
        )

    def _next_step_sequence(self, group: RslGroup) -> int:
        if not group.steps:
            return 1
        return max(step.sequence for step in group.steps) + 1

    # ------------------------------------------------------------------
    # Core CRUD operations
    # ------------------------------------------------------------------
    def list_groups(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        owner: Optional[str] = None,
        tags: Optional[Sequence[str]] = None,
        status: Optional[RslGroupStatus] = None,
        search: Optional[str] = None,
    ) -> RslGroupListResponse:
        if page < 1:
            raise ValueError("페이지 번호는 1 이상이어야 합니다")
        if page_size < 1:
            raise ValueError("페이지 크기는 1 이상이어야 합니다")

        with session_scope() as session:
            stmt = (
                select(RslGroup)
                .options(selectinload(RslGroup.steps).selectinload(RslStep.rules))
                .order_by(RslGroup.updated_at.desc(), RslGroup.id.desc())
            )
            if owner:
                stmt = stmt.where(RslGroup.owner == owner)
            if status:
                stmt = stmt.where(RslGroup.status == status)

            groups = session.execute(stmt).scalars().all()

            if tags:
                tag_set = {tag.strip().lower() for tag in tags if tag.strip()}
                groups = [
                    group
                    for group in groups
                    if tag_set.issubset({(tag or "").lower() for tag in group.tags or []})
                ]

            if search:
                keyword = search.lower().strip()
                if keyword:
                    groups = [
                        group
                        for group in groups
                        if keyword in group.name.lower()
                        or keyword in group.slug.lower()
                        or (group.description or "").lower().find(keyword) >= 0
                    ]

            total = len(groups)
            start = (page - 1) * page_size
            end = start + page_size
            items = [self._to_group_model(group) for group in groups[start:end]]
            return RslGroupListResponse(
                total=total,
                page=page,
                page_size=page_size,
                items=items,
            )

    def create_group(self, payload: RslGroupCreate, *, owner: str) -> RslGroupModel:
        with session_scope() as session:
            desired_slug = payload.slug or self._slugify(payload.name)
            slug = self._ensure_unique_slug(session, desired_slug)
            group = RslGroup(
                slug=slug,
                name=payload.name.strip(),
                description=payload.description.strip() if payload.description else None,
                owner=owner,
                tags=self._normalize_tags(payload.tags),
                status="draft",
                validation_errors=[],
            )
            session.add(group)
            session.flush()
            session.refresh(group)
            self._logger.info(
                "rsl.group.create",
                extra={"group_id": group.id, "owner": owner, "slug": group.slug},
            )
            return self._to_group_model(group)

    def get_group(self, group_id: int, *, owner: Optional[str] = None) -> RslGroupModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            if owner is not None and group.owner != owner:
                raise PermissionError("해당 그룹에 접근할 수 없습니다")
            return self._to_group_model(group)

    def update_group(
        self, group_id: int, payload: RslGroupUpdate, *, owner: str
    ) -> RslGroupModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)

            if payload.name is not None:
                group.name = payload.name.strip()
            if payload.description is not None:
                group.description = payload.description.strip() or None
            if payload.tags is not None:
                group.tags = self._normalize_tags(payload.tags)
            if payload.slug is not None:
                desired = payload.slug.strip()
                if not desired:
                    raise ValueError("슬러그는 비어 있을 수 없습니다")
                group.slug = self._ensure_unique_slug(
                    session, self._slugify(desired), current_id=group.id
                )

            session.add(group)
            session.flush()
            session.refresh(group)
            self._logger.info(
                "rsl.group.update",
                extra={"group_id": group.id, "owner": owner},
            )
            return self._to_group_model(group)

    def delete_group(self, group_id: int, *, owner: str) -> None:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            session.delete(group)
            self._logger.info(
                "rsl.group.delete",
                extra={"group_id": group.id, "owner": owner},
            )

    def add_step(
        self, group_id: int, payload: RslStepCreate, *, owner: str
    ) -> RslStepModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            sequence = payload.sequence or self._next_step_sequence(group)

            step = RslStep(
                sequence=sequence,
                name=payload.name.strip(),
                description=payload.description.strip() if payload.description else None,
                status=(payload.status or "draft"),
                tags=self._normalize_tags(payload.tags),
                config=dict(payload.config or {}),
            )
            for rule_payload in payload.rules:
                step.rules.append(
                    RslRuleRef(
                        rule_name=rule_payload.rule_name.strip(),
                        rule_version=(rule_payload.rule_version or None),
                        payload=dict(rule_payload.metadata or {}),
                        is_optional=rule_payload.is_optional,
                    )
                )
            group.steps.append(step)

            try:
                session.flush()
            except IntegrityError as exc:  # duplicate sequence
                session.rollback()
                raise ValueError("중복된 공정 순번입니다") from exc

            session.refresh(step)
            self._logger.info(
                "rsl.step.create",
                extra={"group_id": group.id, "step_id": step.id, "owner": owner},
            )
            return self._to_step_model(step)

    def update_step(
        self, group_id: int, step_id: int, payload: RslStepUpdate, *, owner: str
    ) -> RslStepModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            step = next((item for item in group.steps if item.id == step_id), None)
            if step is None:
                raise ValueError("스텝을 찾을 수 없습니다")

            if payload.sequence is not None:
                step.sequence = payload.sequence
            if payload.name is not None:
                step.name = payload.name.strip()
            if payload.description is not None:
                step.description = payload.description.strip() or None
            if payload.status is not None:
                if payload.status not in _STEP_STATUS_ORDER:
                    raise ValueError("허용되지 않은 스텝 상태입니다")
                step.status = payload.status
            if payload.tags is not None:
                step.tags = self._normalize_tags(payload.tags)
            if payload.config is not None:
                step.config = dict(payload.config)

            try:
                session.flush()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("중복된 공정 순번입니다") from exc

            session.refresh(step)
            self._logger.info(
                "rsl.step.update",
                extra={"group_id": group.id, "step_id": step.id, "owner": owner},
            )
            return self._to_step_model(step)

    def delete_step(self, group_id: int, step_id: int, *, owner: str) -> None:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            step = next((item for item in group.steps if item.id == step_id), None)
            if step is None:
                raise ValueError("스텝을 찾을 수 없습니다")
            group.steps.remove(step)
            self._logger.info(
                "rsl.step.delete",
                extra={"group_id": group.id, "step_id": step.id, "owner": owner},
            )

    def add_rule(
        self,
        group_id: int,
        step_id: int,
        payload: RslRuleRefCreate,
        *,
        owner: str,
    ) -> RslRuleRefModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            step = next((item for item in group.steps if item.id == step_id), None)
            if step is None:
                raise ValueError("스텝을 찾을 수 없습니다")

            rule = RslRuleRef(
                rule_name=payload.rule_name.strip(),
                rule_version=payload.rule_version,
                payload=dict(payload.metadata or {}),
                is_optional=payload.is_optional,
            )
            step.rules.append(rule)

            try:
                session.flush()
            except IntegrityError as exc:
                session.rollback()
                raise ValueError("동일한 규칙이 이미 존재합니다") from exc

            session.refresh(rule)
            self._logger.info(
                "rsl.rule.create",
                extra={
                    "group_id": group.id,
                    "step_id": step.id,
                    "rule_id": rule.id,
                    "owner": owner,
                },
            )
            return self._to_rule_model(rule)

    def delete_rule(self, group_id: int, step_id: int, rule_id: int, *, owner: str) -> None:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            step = next((item for item in group.steps if item.id == step_id), None)
            if step is None:
                raise ValueError("스텝을 찾을 수 없습니다")
            rule = next((item for item in step.rules if item.id == rule_id), None)
            if rule is None:
                raise ValueError("규칙을 찾을 수 없습니다")
            step.rules.remove(rule)
            self._logger.info(
                "rsl.rule.delete",
                extra={
                    "group_id": group.id,
                    "step_id": step.id,
                    "rule_id": rule.id,
                    "owner": owner,
                },
            )

    # ------------------------------------------------------------------
    # Validation and release workflow
    # ------------------------------------------------------------------
    def _validate_group(self, group: RslGroup) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if not group.steps:
            errors.append("최소 1개의 스텝이 필요합니다")

        seen_sequences: set[int] = set()
        for step in sorted(group.steps, key=lambda item: item.sequence):
            if step.sequence in seen_sequences:
                errors.append(f"스텝 순번이 중복되었습니다: {step.sequence}")
            seen_sequences.add(step.sequence)
            if not step.rules:
                errors.append(f"스텝 '{step.name}'에 연결된 규칙이 없습니다")

        is_valid = len(errors) == 0
        group.validation_errors = errors
        group.last_validated_at = datetime.utcnow()
        return is_valid, errors

    def run_validation(self, group_id: int, *, owner: str) -> RslValidationResponse:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            ok, errors = self._validate_group(group)
            session.add(group)
            session.flush()
            session.refresh(group)
            return RslValidationResponse(
                group_id=group.id,
                is_valid=ok,
                errors=errors,
                validated_at=group.last_validated_at or datetime.utcnow(),
            )

    def release_group(self, group_id: int, *, owner: str) -> RslGroupModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            ok, errors = self._validate_group(group)
            if not ok:
                raise ValueError("검증 실패로 인해 배포할 수 없습니다: " + "; ".join(errors))
            group.status = "released"
            group.released_at = datetime.utcnow()
            group.released_by = owner
            session.add(group)
            session.flush()
            session.refresh(group)
            self._logger.info(
                "rsl.group.release",
                extra={"group_id": group.id, "owner": owner},
            )
            return self._to_group_model(group)

    def retract_group(self, group_id: int, *, owner: str) -> RslGroupModel:
        with session_scope() as session:
            group = self._load_group(session, group_id)
            self._assert_owner(group, owner)
            group.status = "draft"
            group.released_at = None
            group.released_by = None
            session.add(group)
            session.flush()
            session.refresh(group)
            self._logger.info(
                "rsl.group.retract",
                extra={"group_id": group.id, "owner": owner},
            )
            return self._to_group_model(group)

    # ------------------------------------------------------------------
    # Import / Export helpers
    # ------------------------------------------------------------------
    def export_groups(
        self,
        *,
        format: str,
        owner: Optional[str] = None,
        include_archived: bool = False,
    ) -> RslExportBundle:
        listing = self.list_groups(
            page=1,
            page_size=10_000,
            owner=owner,
            status=None,
        )

        items = [
            item
            for item in listing.items
            if include_archived or item.status != "archived"
        ]

        if format == "json":
            payload = json.dumps(
                [item.dict() for item in items], ensure_ascii=False, indent=2, default=str
            )
            return RslExportBundle(format="json", payload=payload)

        if format == "csv":
            buffer = io.StringIO()
            writer = csv.DictWriter(
                buffer,
                fieldnames=[
                    "group_slug",
                    "group_name",
                    "group_description",
                    "group_tags",
                    "group_status",
                    "step_sequence",
                    "step_name",
                    "step_description",
                    "step_status",
                    "step_tags",
                    "rule_name",
                    "rule_version",
                    "rule_optional",
                ],
            )
            writer.writeheader()
            for group in items:
                if not group.steps:
                    writer.writerow(
                        {
                            "group_slug": group.slug,
                            "group_name": group.name,
                            "group_description": group.description or "",
                            "group_tags": ",".join(group.tags),
                            "group_status": group.status,
                            "step_sequence": "",
                            "step_name": "",
                            "step_description": "",
                            "step_status": "",
                            "step_tags": "",
                            "rule_name": "",
                            "rule_version": "",
                            "rule_optional": "",
                        }
                    )
                for step in group.steps:
                    if not step.rules:
                        writer.writerow(
                            {
                                "group_slug": group.slug,
                                "group_name": group.name,
                                "group_description": group.description or "",
                                "group_tags": ",".join(group.tags),
                                "group_status": group.status,
                                "step_sequence": step.sequence,
                                "step_name": step.name,
                                "step_description": step.description or "",
                                "step_status": step.status,
                                "step_tags": ",".join(step.tags),
                                "rule_name": "",
                                "rule_version": "",
                                "rule_optional": "",
                            }
                        )
                    for rule in step.rules:
                        writer.writerow(
                            {
                                "group_slug": group.slug,
                                "group_name": group.name,
                                "group_description": group.description or "",
                                "group_tags": ",".join(group.tags),
                                "group_status": group.status,
                                "step_sequence": step.sequence,
                                "step_name": step.name,
                                "step_description": step.description or "",
                                "step_status": step.status,
                                "step_tags": ",".join(step.tags),
                                "rule_name": rule.rule_name,
                                "rule_version": rule.rule_version or "",
                                "rule_optional": "Y" if rule.is_optional else "N",
                            }
                        )
            return RslExportBundle(format="csv", payload=buffer.getvalue())

        raise ValueError("지원되지 않는 포맷입니다")

    def _apply_group_definition(
        self, group_data: Dict[str, Any], *, owner: str, result: RslImportResult
    ) -> None:
        name = group_data.get("name")
        if not name:
            result.errors.append("그룹 이름이 비어 있습니다")
            result.skipped += 1
            return

        slug = group_data.get("slug") or self._slugify(name)
        steps_data = group_data.get("steps", []) or []
        tags = self._normalize_tags(group_data.get("tags", []))

        with session_scope() as session:
            stmt = select(RslGroup).where(RslGroup.slug == slug)
            existing = session.execute(stmt).scalar_one_or_none()

            if existing and existing.owner != owner:
                result.errors.append(f"{slug}: 다른 소유자에게 속한 그룹입니다")
                result.skipped += 1
                return

            if existing is None:
                group = RslGroup(
                    slug=slug,
                    name=name,
                    description=group_data.get("description"),
                    owner=owner,
                    tags=tags,
                    status=group_data.get("status", "draft"),
                )
                session.add(group)
                created = True
            else:
                group = existing
                group.name = name
                group.description = group_data.get("description")
                group.tags = tags
                status = group_data.get("status") or group.status
                if status in _GROUP_RELEASE_ORDER:
                    group.status = status
                created = False

                # clear existing steps for idempotent import
                group.steps[:] = []
                session.flush()

            for step_idx, step_data in enumerate(steps_data, start=1):
                step_sequence = step_data.get("sequence") or step_idx
                step = RslStep(
                    sequence=step_sequence,
                    name=step_data.get("name", f"step-{step_idx}"),
                    description=step_data.get("description"),
                    status=step_data.get("status", "draft"),
                    tags=self._normalize_tags(step_data.get("tags", [])),
                    config=dict(step_data.get("config", {})),
                )
                for rule_data in step_data.get("rules", []) or []:
                    rule_name = rule_data.get("rule_name") or rule_data.get("name")
                    if not rule_name:
                        continue
                    step.rules.append(
                        RslRuleRef(
                            rule_name=rule_name,
                            rule_version=rule_data.get("rule_version"),
                            payload=dict(rule_data.get("metadata", {})),
                            is_optional=bool(rule_data.get("is_optional")),
                        )
                    )
                group.steps.append(step)

            session.flush()

            if created:
                result.created += 1
            else:
                result.updated += 1

    def import_groups(self, request: RslImportRequest, *, owner: str) -> RslImportResult:
        result = RslImportResult()

        if request.format == "json":
            try:
                data = json.loads(request.payload)
            except json.JSONDecodeError as exc:
                raise ValueError("JSON 파싱에 실패했습니다") from exc

            if not isinstance(data, list):
                raise ValueError("JSON 포맷은 리스트 형태여야 합니다")
            for entry in data:
                if not isinstance(entry, dict):
                    result.errors.append("잘못된 그룹 엔트리입니다")
                    result.skipped += 1
                    continue
                self._apply_group_definition(entry, owner=owner, result=result)
            return result

        if request.format == "csv":
            reader = csv.DictReader(io.StringIO(request.payload))
            temp: Dict[str, Dict[str, Any]] = {}
            for row in reader:
                slug = row.get("group_slug") or self._slugify(row.get("group_name", ""))
                if not slug:
                    result.errors.append("CSV 행에서 그룹 정보를 찾을 수 없습니다")
                    result.skipped += 1
                    continue
                group_entry = temp.setdefault(
                    slug,
                    {
                        "slug": slug,
                        "name": row.get("group_name") or slug,
                        "description": row.get("group_description") or None,
                        "tags": [tag.strip() for tag in (row.get("group_tags") or "").split(",") if tag.strip()],
                        "status": row.get("group_status", "draft"),
                        "steps": [],
                    },
                )

                step_name = row.get("step_name")
                if step_name:
                    step_sequence = row.get("step_sequence")
                    try:
                        sequence = int(step_sequence) if step_sequence else None
                    except ValueError:
                        sequence = None
                    tags = [
                        tag.strip()
                        for tag in (row.get("step_tags") or "").split(",")
                        if tag.strip()
                    ]
                    step_key = (sequence, step_name)
                    step_entry = next(
                        (
                            s
                            for s in group_entry["steps"]
                            if (s.get("sequence"), s.get("name")) == step_key
                        ),
                        None,
                    )
                    if step_entry is None:
                        step_entry = {
                            "sequence": sequence,
                            "name": step_name,
                            "description": row.get("step_description") or None,
                            "status": row.get("step_status") or "draft",
                            "tags": tags,
                            "rules": [],
                        }
                        group_entry["steps"].append(step_entry)
                    rule_name = row.get("rule_name")
                    if rule_name:
                        step_entry["rules"].append(
                            {
                                "rule_name": rule_name,
                                "rule_version": row.get("rule_version") or None,
                                "is_optional": (row.get("rule_optional", "N").upper() == "Y"),
                            }
                        )

            for entry in temp.values():
                self._apply_group_definition(entry, owner=owner, result=result)
            return result

        raise ValueError("지원되지 않는 포맷입니다")


rsl_service = RslService()


__all__ = ["RslService", "rsl_service"]

