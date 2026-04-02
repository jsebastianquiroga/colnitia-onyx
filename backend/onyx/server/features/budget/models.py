from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class BudgetBase(BaseModel):
    user_id: UUID
    balance: float
    is_active: bool = True

class BudgetUpdate(BaseModel):
    balance: float
    is_active: Optional[bool] = None

class BudgetResponse(BudgetBase):
    total_spent: float
    updated_at: datetime

    class Config:
        from_attributes = True
