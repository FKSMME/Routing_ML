"""품목(Item) 모델 정의."""
from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import declarative_base

from common.datetime_utils import utc_now_naive

Base = declarative_base()


class Item(Base):
    """품목 마스터 데이터 모델."""

    __tablename__ = "items"

    # 기본 키
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 품목 정보
    item_code = Column(String(50), unique=True, nullable=False, index=True)
    item_name = Column(String(200))
    material_code = Column(String(50), index=True)
    part_type = Column(String(50), index=True)
    drawing_number = Column(String(100), index=True)

    # 치수 정보
    dimension_length = Column(Float)
    dimension_width = Column(Float)
    dimension_height = Column(Float)
    dimension_diameter = Column(Float)
    dimension_thickness = Column(Float)

    # 분류 정보
    category = Column(String(100))
    sub_category = Column(String(100))

    # 설명 및 비고
    description = Column(Text)
    remarks = Column(Text)

    # 메타데이터
    created_at = Column(DateTime, default=utc_now_naive, nullable=False, index=True)
    updated_at = Column(DateTime, default=utc_now_naive, onupdate=utc_now_naive, nullable=False, index=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete support

    # 데이터 품질
    is_active = Column(Integer, default=1)  # 1=active, 0=inactive
    quality_checked = Column(Integer, default=0)  # 0=unchecked, 1=checked

    def __repr__(self) -> str:
        return f"<Item(id={self.id}, item_code='{self.item_code}', item_name='{self.item_name}')>"

    @property
    def is_complete(self) -> bool:
        """품목 정보가 완전한지 확인."""
        required_fields = [
            self.item_code,
            self.material_code,
            self.part_type,
        ]
        return all(field is not None and str(field).strip() for field in required_fields)

    @property
    def has_dimensions(self) -> bool:
        """치수 정보가 있는지 확인."""
        dimension_fields = [
            self.dimension_length,
            self.dimension_width,
            self.dimension_height,
            self.dimension_diameter,
            self.dimension_thickness,
        ]
        return any(field is not None for field in dimension_fields)
