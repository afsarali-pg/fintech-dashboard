import axios from 'axios';
import {JiraTicket, JiraTicketDto, PullRequest} from "../dto/JiraDto";
import {GithubService} from "./github_service";
import * as fs from "node:fs";

export class JiraService{

    public async getAllPendingJiraTickets(): Promise<any[]>{

        //jql = project = FINTECH AND (fixversion = "Fintech Pending Deployment" OR sprint in openSprints()) AND issuetype != Test ORDER BY created DESC
        const jiraFilter= 'https://propertyguru.atlassian.net/rest/api/3/search?jql=project%20%3D%20FINTECH%20AND%20(fixversion%20%3D%20%22Fintech%20Pending%20Deployment%22%20OR%20sprint%20in%20openSprints())%20AND%20issuetype%20!%3D%20Test%20ORDER%20BY%20created%20DESC&maxResults=100';
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
            const isChildTicket = prDetails.some((pr: PullRequest) => pr.isChildPr);


            // TODO: For isTested, we need to check if the linked QA ticket is resolved
            // const isTested = ticket.fields.issuelinks.some((link: any) => link.type.name === 'Tested' && link.outwardIssue.fields.status.name === 'Done');

            const jiraTicket: JiraTicket = {
                ticket_id: ticket.id,
                key: ticket.key,
                jira_title: ticket.fields.summary,
                team: await this.getTeamName(ticket.fields.reporter.displayName), // TODO: also need to check based on Labels
                reporter_name: ticket.fields.reporter.displayName,
                dev_name: ticket.fields.assignee.displayName,
                isDeployed: false, //  Handled in updateDeploymentStatus
                isMerged: isMerged,
                isTested: false,
                isReviewed: isApproved,
                isGuruland: isGuruland,
                isSymbiosis: isSymbiosis,
                isChildTicket: isChildTicket,
                pull_requests: prDetails,
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
                destination_branch: pr.destination.branch,
                url: pr.url,
                status: pr.status,
                isDeployed: false, //TODO: To be updated later based on deployment date
                isChildPr: false, //TODO: To be updated later based on destination branch
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

        console.log('Guruland Deployment Date:', guruLandDeploymentDate.published_at);
        console.log('Symbiosis Deployment Date:', symbiosisDeploymentDate.published_at);
        console.log('Frontend Deployment Date:', frontendDeploymentDate.published_at);
        console.log('Backend Deployment Date:', backendDeploymentDate.published_at);
        console.log('Salesforce Deployment Date:', salesforceDeploymentDate.published_at);
        console.log('Home Ownership Deployment Date:', homeOwnershipDeploymentDate.published_at);


        const jiraStatusDto: JiraTicketDto = {
            upcomingGurulandDeploymentDate: new Date( await this.getGurulandDeploymentDate()),
            syncDate: new Date(),
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

        const upcomingGurulandDeploymentDate = new Date(jiraStatusDto.upcomingGurulandDeploymentDate);
        const lastGurulandDeploymentDate = new Date(upcomingGurulandDeploymentDate.getTime() - 14 * 24 * 60 * 60 * 1000);

        jiraTickets.forEach(ticket => {
            ticket.pull_requests.forEach(pr => {
                if(pr.repositoryName === 'pg-finance-backend' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastBackendDeploymentDate;
                } else if(pr.repositoryName === 'pg-finance-frontend' && pr.status === 'MERGED'){
                    //lastUpdate = "2024-07-10T07:14:07.000Z"
                    //lastFrontendDeploymentDate = "2024-07-09T08:47:37Z"

                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastFrontendDeploymentDate;
                } else if(pr.repositoryName === 'pg-finance-salesforce' && jiraStatusDto.lastSalesforceDeploymentDate && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastSalesforceDeploymentDate;
                } else if(pr.repositoryName === 'pg-finance-homeowner' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastHomeOwnershipDeploymentDate;
                } else if(pr.repositoryName === 'guruland' && lastGurulandDeploymentDate && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < lastGurulandDeploymentDate; // TODO: Need to get release date from Jenkins instead of Github
                } else if(pr.repositoryName === 'project-symbiosis' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastSymbiosisDeploymentDate;
                }else if(pr.repositoryName === 'project-symbiosis-config' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastSymbiosisDeploymentDate;
                }else if(pr.repositoryName === 'hive-ui-widgets' && pr.status === 'MERGED'){
                    pr.isDeployed = pr.lastUpdate < jiraStatusDto.lastSymbiosisDeploymentDate;
                }

                // Check if destination branch is other than main or dev, develop , then  set isChildPr = true
                pr.isChildPr = !['release','master','main', 'dev', 'develop'].includes(pr.destination_branch);
                ticket.isChildTicket = ticket.isChildTicket || pr.isChildPr;
            });
        });

        // Now update deployment status for each ticket
        for (const ticket of jiraTickets) {
            ticket.isDeployed = ticket.pull_requests.every(pr => pr.isDeployed);
        }
    }

    public async getGurulandDeploymentDate(){
        // If current date is 2024-07-20 then the upcoming deployment date is 2024-07-31
        // If current date is 2024-07-31 then the upcoming deployment date is 2024-07-31
        // If current date is 2024-08-01 then the upcoming deployment date is 2024-08-14

        // read json file
        const data = fs.readFileSync('./static/data/guruland_deployment.json');
        const deploymentDates: string[] = JSON.parse(data.toString());
        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().split('T')[0];

        // Find upcoming deployment date
        const upcomingDate: string | undefined =  deploymentDates.find((date: string) => date > formattedDate);
        return Date.parse(typeof upcomingDate === "string" ? upcomingDate : "");
    }

    private async getTeamName(reporterName: string){
        switch (reporterName) {
            case 'Lakshmi Bhandaram':
                return 'Growth';
            case 'Janice Lim':
            case 'Sandeep Mondal':
                return 'Core';
            case 'Khoo Shi Han':
                return 'Internal Tools';
            default:
                return 'NA';
        }
    }

}
