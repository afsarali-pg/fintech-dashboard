import {JiraService} from "./services/jira_service";
import {GithubService} from "./services/github_service";
import * as fs from "node:fs";

async function run(){
    const jiraService = new JiraService();
    const github = new GithubService();
     // console.log(await github.getLastDeploymentDate("pg-finance-backend"));
   // const prDetails = await jiraService.pullRequestDetails()
    const jiraList  = await jiraService.buildJiraStatusDto();
    // Now store the jiraList in a json file

    const jsonData = JSON.stringify(jiraList, null, 2);
    fs.writeFileSync('jiraStatus.json', jsonData);

    console.log(jiraList);
}

run().then((r) => console.log("Done"))
    .catch((e) => console.error("Terminated with error: ", e.message || ""));
