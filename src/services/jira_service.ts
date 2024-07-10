import axios from 'axios';
import {JiraTicket, JiraTicketDto, PullRequest} from "../dto/JiraDto";
import {GithubService} from "./github_service";

export class JiraService{

    public async getAllPendingJiraTickets(): Promise<any[]>{

        //jql = project = FINTECH AND fixversion = "Fintech Pending Deployment" ORDER BY created DESC
        const jiraFilter= 'https://propertyguru.atlassian.net/rest/api/3/search?jql=project=FINTECH%20AND%20fixversion%20=%20%22Fintech%20Pending%20Deployment%22%20ORDER%20BY%20created%20DESC'
        const response = await axios.get(jiraFilter, {
            headers: this.getHeaders()
        });

        return response.data.issues;
    }

    public async getAllJiraTicketsWIthPR(){
        const allPendingJiraTickets = await this.getAllPendingJiraTickets();
        const jiraTickets: JiraTicket[] = [];
        // exclude tickets without PR
        const filterTickets  = allPendingJiraTickets.filter((ticket: any) => ticket.fields.customfield_11800 !== null && ticket.fields.customfield_11800 !== "{}")

        for (const ticket of filterTickets){

            const prDetails = await this.pullRequestDetails(ticket.id)
            const isGuruland = prDetails.some((pr: PullRequest) => pr.repositoryName === 'guruland');
            const isSymbiosis = prDetails.some((pr: PullRequest) => pr.repositoryName === 'project-symbiosis' || pr.repositoryName === 'project-symbiosis-config' || pr.repositoryName === 'hive-ui-widgets');
            // Check if any one of the PRs is not merged and already approved
            const isApproved = prDetails.every((pr: PullRequest) => pr.isApproved);
            // Check all PRs are merged
            const isMerged = prDetails.every((pr: PullRequest) => pr.status === 'MERGED');


            // TODO: For isTested, we need to check if the linked QA ticket is resolved
            // const isTested = ticket.fields.issuelinks.some((link: any) => link.type.name === 'Tested' && link.outwardIssue.fields.status.name === 'Done');

            const jiraTicket: JiraTicket = {
                ticket_id: ticket.id,
                key: ticket.key,
                jira_title: ticket.fields.summary,
                team: ticket.fields.labels[0] || 'NA', //TODO: [0] is temporary, need to update to [1] or [2] based on the actual team label
                reporter_name: ticket.fields.reporter.displayName,
                dev_name: ticket.fields.assignee.displayName,
                isDeployed: false, //  Handled in updateDeploymentStatus
                isMerged: isMerged,
                isTested: false,
                isReviewed: isApproved,
                isGuruland: isGuruland,
                isSymbiosis: isSymbiosis,
                pull_requests: prDetails
            }
            jiraTickets.push(jiraTicket);
        }
        return jiraTickets;

    }

    public async getLinkedPullRequests(issueId: string){
        const response = await axios.get(`https://propertyguru.atlassian.net/rest/dev-status/latest/issue/detail?issueId=${issueId}&applicationType=GitHub&dataType=pullrequest`, {
            headers: this.getHeaders()
        });
        return response.data;
    }
    public async pullRequestDetails(jiraId: string) : Promise<PullRequest[]>{

        // const issueDetails = await  this.getJiraIssueDetails('FINTECH-5563');
        const devStatus = await this.getLinkedPullRequests(jiraId);

        const PRs = devStatus.detail[0].pullRequests as any[];

        const pullRequests : PullRequest[] = [];
        PRs.forEach(pr => {
            pullRequests.push({
                branch_name: pr.source.branch,
                url: pr.url,
                status: pr.status,
                isDeployed: false, //TODO: To be updated later based on deployment date
                repositoryName: pr.repositoryName.replace('propertyguru/', ''),
                lastUpdate: new Date(pr.lastUpdate),
                isApproved: pr.reviewers.some((reviewer: any) => reviewer.approved)
            });
        });

        return pullRequests;
    }
    public async getJiraIssueDetails(issueId: string){
        const response = await axios.get(`https://propertyguru.atlassian.net/rest/api/3/issue/${issueId}`, {
            headers: this.getHeaders()
        });
        return response.data;
    }
    private getHeaders() {
        return {
            Accept: 'application/json',
            Authorization: `Basic ${process.env.JIRA_AUTH_TOKEN}`
        }
    }

    public async buildJiraStatusDto(){

        const jiraTickets = await this.getAllJiraTicketsWIthPR();
        const githubService = new GithubService();

        const guruLandDeploymentDate = await githubService.getLastDeploymentDate('guruland') as {url: string, tag_name: string, published_at: string};
        const symbiosisDeploymentDate = await githubService.getLastDeploymentDate('project-symbiosis') as {url: string, tag_name: string, published_at: string};
        const frontendDeploymentDate = await githubService.getLastDeploymentDate('pg-finance-frontend') as {url: string, tag_name: string, published_at: string};
        const backendDeploymentDate = await githubService.getLastDeploymentDate('pg-finance-backend') as {url: string, tag_name: string, published_at: string};
        const salesforceDeploymentDate = await githubService.getLastDeploymentDate('pg-finance-salesforce') as {url: string, tag_name: string, published_at: string};
        const homeOwnershipDeploymentDate = await githubService.getLastDeploymentDate('pg-finance-homeowner') as {url: string, tag_name: string, published_at: string};

        const jiraStatusDto: JiraTicketDto = {
            lastGurulandDeploymentDate: new Date(guruLandDeploymentDate.published_at), // TODO: Need to get release date from Jenkins instead of Github
            lastSymbiosisDeploymentDate: new Date(symbiosisDeploymentDate.published_at),
            lastFrontendDeploymentDate: new Date(frontendDeploymentDate.published_at),
            lastBackendDeploymentDate: new Date(backendDeploymentDate.published_at),
            lastSalesforceDeploymentDate: new Date(salesforceDeploymentDate.published_at),
            lastHomeOwnershipDeploymentDate: new Date(homeOwnershipDeploymentDate.published_at),
            jiraTickets: jiraTickets
        }
        await this.updateDeploymentStatus(jiraStatusDto);
        return jiraStatusDto;
    }

    private async updateDeploymentStatus(jiraStatusDto: JiraTicketDto){
        const jiraTickets = jiraStatusDto.jiraTickets;
        jiraTickets.forEach(ticket => {
            ticket.pull_requests.forEach(pr => {
                if(pr.repositoryName === 'pg-finance-backend' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastBackendDeploymentDate;
                } else if(pr.repositoryName === 'pg-finance-frontend' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastFrontendDeploymentDate;
                } else if(pr.repositoryName === 'pg-finance-salesforce' && jiraStatusDto.lastSalesforceDeploymentDate && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastSalesforceDeploymentDate;
                } else if(pr.repositoryName === 'pg-finance-homeowner' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastHomeOwnershipDeploymentDate;
                } else if(pr.repositoryName === 'guruland' && jiraStatusDto.lastGurulandDeploymentDate && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastGurulandDeploymentDate;
                } else if(pr.repositoryName === 'project-symbiosis' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastSymbiosisDeploymentDate;
                }else if(pr.repositoryName === 'project-symbiosis-config' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastSymbiosisDeploymentDate;
                }else if(pr.repositoryName === 'hive-ui-widgets' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate > jiraStatusDto.lastSymbiosisDeploymentDate;
                }
            });
        });

        // Now update deployment status for each ticket
        for (const ticket of jiraTickets) {
            ticket.isDeployed = ticket.pull_requests.every(pr => pr.isDeployed);
        }
    }

}
