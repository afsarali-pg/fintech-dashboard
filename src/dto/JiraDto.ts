export interface PullRequest {
    branch_name: string;
    url: string;
    status: string;
    isDeployed: boolean;
    repositoryName: string;
    lastUpdate: Date;
    isApproved: boolean;
}

export interface JiraTicket {
    ticket_id: string;
    key: string;
    jira_title: string;
    team: string;
    reporter_name: string;
    dev_name: string;
    isDeployed: boolean;
    isMerged: boolean;
    isTested: boolean;
    isReviewed: boolean;
    isGuruland: boolean;
    isSymbiosis: boolean;
    pull_requests: PullRequest[];
}

export interface JiraTicketDto {
    upcomingGurulandDeploymentDate: Date;
    lastSymbiosisDeploymentDate: Date;
    lastFrontendDeploymentDate: Date;
    lastBackendDeploymentDate: Date;
    lastSalesforceDeploymentDate: Date | null;
    lastHomeOwnershipDeploymentDate: Date;
    jiraTickets: JiraTicket[];
}
