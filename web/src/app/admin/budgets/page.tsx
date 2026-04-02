"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { SWR_KEYS } from "@/lib/swr-keys";
import * as SettingsLayouts from "@/layouts/settings-layouts";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import {
  Table,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  TableHeader,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Text } from "@opal/components";
import Button from "@/refresh-components/buttons/Button";
import { toast } from "@/hooks/useToast";
import { topUpBudget, resetBudget } from "./lib";
import { SvgPlus, SvgHistory, SvgWallet } from "@opal/icons";

const route = ADMIN_ROUTES.BUDGETS;

interface BudgetView {
  user_id: string;
  user_email: string;
  balance: number;
  total_spent: number;
  is_active: boolean;
}

function BudgetManagement() {
  const { data: budgets, error, isLoading } = useSWR<BudgetView[]>(SWR_KEYS.budgets);
  const [topUpAmount, setTopUpAmount] = useState<Record<string, string>>({});

  const handleTopUp = async (userId: string) => {
    const amountStr = topUpAmount[userId] || "";
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await topUpBudget(userId, amount);
      toast.success("Budget topped up successfully");
      mutate(SWR_KEYS.budgets);
      setTopUpAmount(prev => ({ ...prev, [userId]: "" }));
    } catch (e: any) {
      toast.error("Failed to top up budget");
    }
  };

  const handleReset = async (userId: string) => {
    if (!confirm("Are you sure you want to reset this user's budget and spent amount?")) return;
    
    try {
      await resetBudget(userId);
      toast.success("Budget reset successfully");
      mutate(SWR_KEYS.budgets);
    } catch (e: any) {
      toast.error("Failed to reset budget");
    }
  };

  if (isLoading) return <p>Loading budgets...</p>;
  if (error) return <p className="text-destructive font-semibold">Error loading budgets. Please ensure migrations are applied.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 p-4 bg-surface-elevated rounded-lg shadow-sm border border-surface-overlay">
        <div className="p-3 bg-brand-soft rounded-full">
          <SvgWallet className="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-darker">Budget Overview</h2>
          <p className="text-sm text-subtle">Manage user spending and top up credits for LLM usage.</p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User Email</TableHead>
            <TableHead>Balance ($)</TableHead>
            <TableHead>Total Spent ($)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {budgets?.map((budget) => (
            <TableRow key={budget.user_id}>
              <TableCell className="font-medium">{budget.user_email}</TableCell>
              <TableCell>
                <Badge variant={budget.balance > 0 ? "success" : "destructive"}>
                  ${budget.balance.toFixed(2)}
                </Badge>
              </TableCell>
              <TableCell>${budget.total_spent.toFixed(2)}</TableCell>
              <TableCell>
                {budget.is_active ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="destructive">Suspended</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Input
                    className="w-24 h-9"
                    placeholder="Amt"
                    type="number"
                    value={topUpAmount[budget.user_id] || ""}
                    onChange={(e) => setTopUpAmount(prev => ({ ...prev, [budget.user_id]: e.target.value }))}
                  />
                  <Button 
                    action
                    secondary
                    size="md"
                    onClick={() => handleTopUp(budget.user_id)}
                    leftIcon={SvgPlus}
                  >
                    Top Up
                  </Button>
                  <Button 
                    danger
                    tertiary
                    size="md"
                    title="Reset Budget"
                    onClick={() => handleReset(budget.user_id)}
                    leftIcon={SvgHistory}
                  >
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!budgets?.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10">
                No budgets found. Users will appear here after their first activity or top-up.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Page() {
  return (
    <SettingsLayouts.Root>
      <SettingsLayouts.Header title={route.title} icon={route.icon} separator />
      <SettingsLayouts.Body>
        <BudgetManagement />
      </SettingsLayouts.Body>
    </SettingsLayouts.Root>
  );
}
