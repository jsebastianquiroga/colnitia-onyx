from sqlalchemy import select
from sqlalchemy.orm import Session
from onyx.db.models import Budget
from uuid import UUID

def get_user_budget(db_session: Session, user_id: UUID) -> Budget | None:
    query = select(Budget).where(Budget.user_id == user_id)
    return db_session.scalars(query).first()

def create_or_update_budget(
    db_session: Session, 
    user_id: UUID, 
    balance: float, 
    is_active: bool = True
) -> Budget:
    budget = get_user_budget(db_session, user_id)
    if budget:
        budget.balance = balance
        budget.is_active = is_active
    else:
        budget = Budget(user_id=user_id, balance=balance, is_active=is_active)
        db_session.add(budget)
    db_session.commit()
    return budget

def deduct_from_budget(db_session: Session, user_id: UUID, amount: float) -> bool:
    budget = get_user_budget(db_session, user_id)
    # If no budget is set, we treat it as infinite/unlimited for now 
    # (or change this if policy is 'no budget = no access')
    if not budget:
        return True
        
    if not budget.is_active:
        return False
        
    if budget.balance < amount:
        return False
    
    budget.balance -= amount
    budget.total_spent += amount
    db_session.commit()
    return True
