from fastapi import Depends
from onyx.auth.users import current_chat_accessible_user
from onyx.db.engine.sql_engine import get_session_with_current_tenant
from onyx.db.models import User
from onyx.db.budget import get_user_budget
from onyx.error_handling.error_codes import OnyxErrorCode
from onyx.error_handling.exceptions import OnyxError

def check_budget_limits(
    user: User = Depends(current_chat_accessible_user),
) -> None:
    """
    Dependency to check if the user has sufficient budget before performing a chat/query.
    """
    with get_session_with_current_tenant() as db_session:
        budget = get_user_budget(db_session, user.id)
        
        # If no budget record exists, we treat it as unlimited (admin handled).
        if not budget:
            return
            
        if not budget.is_active:
             raise OnyxError(
                 OnyxErrorCode.BUDGET_INACTIVE,
                 "Your account budget is inactive. Please contact your administrator."
             )
             
        if budget.balance <= 0:
             raise OnyxError(
                 OnyxErrorCode.BUDGET_EXCEEDED,
                 "Insufficient balance. Please recharge your account credits."
             )
