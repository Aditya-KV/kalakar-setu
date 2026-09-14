"""
Kalakar Setu — Reference Data Schemas
"""

from pydantic import BaseModel


class CraftTypeResponse(BaseModel):
    id: str
    name_en: str
    name_hi: str
    icon: str | None
    model_config = {"from_attributes": True}


class StateResponse(BaseModel):
    code: str
    name_en: str
    name_hi: str
    model_config = {"from_attributes": True}


class DistrictResponse(BaseModel):
    code: str
    state_code: str
    name_en: str
    name_hi: str
    model_config = {"from_attributes": True}


class LanguageResponse(BaseModel):
    code: str
    name_en: str
    name_native: str
    model_config = {"from_attributes": True}


class ClusterResponse(BaseModel):
    id: str
    name: str
    craft_type: str
    state_code: str
    story: str
    member_craft_names: list[str] | None
    model_config = {"from_attributes": True}


class ClusterMemberResponse(BaseModel):
    id: str
    display_name: str | None
    district_code: str | None
    model_config = {"from_attributes": True}


class ClusterDetailResponse(ClusterResponse):
    members: list[ClusterMemberResponse]
