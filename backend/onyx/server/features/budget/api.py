from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from typing import List, Optional

from onyx.auth.users import current_admin_user, current_user
from onyx.db.engine.sql_engine import get_session
from onyx.db.models import User
from onyx.db.budget import get_user_budget, create_or_update_budget
from onyx.server.features.budget.models import BudgetResponse, BudgetUpdate

router = APIRouter(prefix="/budget", tags=["budget"])
admin_router = APIRouter(prefix="/admin/budget", tags=["admin", "budget"])

@router.get("/me")
async def get_my_budget(
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session)
):
    budget = get_user_budget(db_session, user.id)
    if not budget:
        # Return a dummy unlimited budget if none exists
        return {
            "user_id": user.id,
            "balance": 999999.0,
            "total_spent": 0.0,
            "is_active": True,
            "updated_at": datetime.now()
        }
    return BudgetResponse.from_orm(budget)

@admin_router.put("/{user_id}")
async def update_user_budget(
    user_id: UUID,
    budget_update: BudgetUpdate,
    admin: User = Depends(current_admin_user),
    db_session: Session = Depends(get_session)
):
    budget = create_or_update_budget(
        db_session, 
        user_id, 
        budget_update.balance, 
        budget_update.is_active if budget_update.is_active is not None else True
    )
    return BudgetResponse.from_orm(budget)
