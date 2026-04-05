"use client";

import React from "react";
import { IllustrationContent } from "@opal/layouts";
import { Button } from "@opal/components";
import { SvgRefreshCw } from "@opal/icons";

interface TabErrorBoundaryProps {
  children: React.ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
}

/**
 * React error boundary for each tab panel in MobileShell.
 * On error, renders an error state with a retry button.
 */
class TabErrorBoundary extends React.Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  constructor(props: TabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): TabErrorBoundaryState {
    return { hasError: true };
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <IllustrationContent
            title="Something went wrong"
            description="An unexpected error occurred in this tab."
          />
          <Button
            variant="default"
            prominence="secondary"
            icon={SvgRefreshCw}
            onClick={this.handleRetry}
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default TabErrorBoundary;
