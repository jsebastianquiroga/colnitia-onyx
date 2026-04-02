const API_PREFIX = "/api/budget";

export const topUpBudget = async (userId: string, amount: number) => {
  return await fetch(`${API_PREFIX}/user/${userId}/topup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });
};

export const resetBudget = async (userId: string) => {
  return await fetch(`${API_PREFIX}/user/${userId}/reset`, {
    method: "POST",
  });
};

export const toggleBudgetStatus = async (userId: string, isActive: boolean) => {
  // Assuming a future endpoint or using a general update if available
  // For now, we'll just implement what we have in the backend
  return await fetch(`${API_PREFIX}/user/${userId}/update`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ is_active: isActive }),
  });
};
